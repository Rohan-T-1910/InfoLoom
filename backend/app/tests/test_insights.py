import io
import pytest
from fastapi.testclient import TestClient

from app.schemas.insight import (
    InsightCategory,
    InsightDirection,
    InsightSeverity,
    StructuredInsightFact,
)
from app.services.insights_service import BusinessInsightsService, InsightConfig
from app.services.llm_polisher import LLMPolisher

# 20 rows of business transaction data with upward revenue trend, categorical dominance, and correlated marketing spend
SAMPLE_SALES_CSV = b"""transaction_id,region,revenue,marketing_spend,units_sold,discount
1,North,100.0,20.0,10,0.0
2,North,110.0,22.0,11,0.0
3,North,115.0,23.5,12,0.0
4,North,125.0,25.0,13,0.0
5,North,130.0,26.0,13,0.0
6,North,140.0,28.0,14,0.0
7,North,155.0,31.0,15,0.0
8,North,160.0,32.5,16,0.0
9,North,175.0,35.0,17,0.0
10,North,185.0,37.0,18,0.0
11,North,200.0,40.0,20,5.0
12,North,210.0,42.0,21,5.0
13,South,225.0,45.0,22,5.0
14,South,235.0,47.0,23,5.0
15,South,250.0,50.0,25,5.0
16,South,260.0,52.0,26,10.0
17,South,275.0,55.0,27,10.0
18,South,290.0,58.0,29,10.0
19,South,310.0,62.0,31,10.0
20,West,325.0,65.0,32,10.0
"""

SAMPLE_TINY_CSV = b"""id,val\n1,10.0\n2,12.0\n"""

def test_percentage_changes_and_zero_baseline():
    """Validates percentage change detection, below-threshold suppression, and zero baseline handling."""
    import pandas as pd
    service = BusinessInsightsService()

    # 1. Dataset with clear >15% increase in val, but below 15% in stable_val
    df = pd.DataFrame({
        "revenue": [100.0, 105.0, 102.0, 110.0, 190.0, 205.0, 210.0, 220.0],
        "stable_val": [100.0, 101.0, 102.0, 101.0, 102.0, 103.0, 102.0, 104.0],
        "zero_baseline": [0.0, 0.0, 0.0, 0.0, 50.0, 60.0, 55.0, 65.0],
    })

    facts = service._extract_percentage_changes(df, ["revenue", "stable_val", "zero_baseline"], threshold=15.0)

    # Must detect percentage increase for revenue
    rev_facts = [f for f in facts if f.feature == "revenue"]
    assert len(rev_facts) == 1
    assert rev_facts[0].direction == InsightDirection.UPWARD.value
    assert rev_facts[0].change_pct is not None
    assert rev_facts[0].change_pct > 80.0
    assert "increased" in rev_facts[0].explanation.lower()

    # Must NOT detect percentage change for stable_val (change is ~2%, below 15% threshold)
    stable_facts = [f for f in facts if f.feature == "stable_val"]
    assert len(stable_facts) == 0

    # Must safely handle zero baseline without division-by-zero error
    zero_facts = [f for f in facts if f.feature == "zero_baseline"]
    assert len(zero_facts) == 1
    assert zero_facts[0].change_pct is None  # Cannot divide by zero
    assert zero_facts[0].change_abs is not None
    assert "zero baseline" in zero_facts[0].explanation.lower()

def test_top_contributors_and_pareto_concentration():
    """Validates categorical share dominance and Pareto (80/20) volume concentration."""
    import pandas as pd
    service = BusinessInsightsService()

    # Region 'North' is 12/20 = 60% of records
    # Pareto: top 2 records have 90% of revenue
    df = pd.DataFrame({
        "department": ["Electronics"] * 14 + ["Clothing"] * 4 + ["Grocery"] * 2,
        "revenue": [50000.0, 40000.0] + [100.0] * 18,
    })

    facts = service._extract_top_contributors(df, ["department"], ["revenue"])

    # Categorical dominance
    cat_facts = [f for f in facts if f.feature == "department"]
    assert len(cat_facts) == 1
    assert "Electronics" in cat_facts[0].explanation
    assert cat_facts[0].current_value == 70.0  # 14/20 = 70%
    assert cat_facts[0].direction == InsightDirection.CONCENTRATED.value

    # Pareto concentration
    num_facts = [f for f in facts if f.feature == "revenue"]
    assert len(num_facts) == 1
    assert "Pareto" in num_facts[0].title
    assert num_facts[0].current_value is not None
    assert num_facts[0].current_value >= 70.0

def test_trend_detection_upward_and_downward():
    """Validates linear trend discovery with R² goodness-of-fit."""
    import pandas as pd
    service = BusinessInsightsService()

    # Perfect upward and downward lines
    df = pd.DataFrame({
        "sales_growth": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0],
        "churn_drop": [100.0, 90.0, 80.0, 70.0, 60.0, 50.0, 40.0, 30.0, 20.0, 10.0],
        "pure_noise": [50.0, 52.0, 48.0, 51.0, 49.0, 50.0, 51.0, 49.0, 50.0, 50.0],
    })

    facts = service._extract_trends(df, ["sales_growth", "churn_drop", "pure_noise"])

    # Sales growth: upward trend
    growth_facts = [f for f in facts if f.feature == "sales_growth"]
    assert len(growth_facts) == 1
    assert growth_facts[0].direction == InsightDirection.UPWARD.value
    assert growth_facts[0].severity == InsightSeverity.POSITIVE.value
    assert "upward" in growth_facts[0].explanation.lower()

    # Churn drop: downward trend
    drop_facts = [f for f in facts if f.feature == "churn_drop"]
    assert len(drop_facts) == 1
    assert drop_facts[0].direction == InsightDirection.DOWNWARD.value
    assert drop_facts[0].severity == InsightSeverity.WARNING.value
    assert "downward" in drop_facts[0].explanation.lower()

    # Pure noise: no linear trend
    noise_facts = [f for f in facts if f.feature == "pure_noise"]
    assert len(noise_facts) == 0

def test_distribution_and_correlation_insights():
    """Validates skewness, zero-inflation, and non-causal Pearson correlation."""
    import pandas as pd
    service = BusinessInsightsService()

    # High right-skewed feature + correlated features
    x = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
    y = [2.0 * val + 1.0 for val in x]
    skewed = [10.0, 11.0, 10.5, 12.0, 11.2, 10.8, 11.5, 12.1, 10.9, 1500.0]  # Massive outlier

    df = pd.DataFrame({"ad_spend": x, "conversions": y, "skewed_metric": skewed})

    dist_facts = service._extract_distribution_observations(df, ["skewed_metric"])
    assert len(dist_facts) >= 1
    assert any("right-skewed" in f.explanation.lower() for f in dist_facts)

    corr_facts = service._extract_correlation_observations(df, ["ad_spend", "conversions"])
    assert len(corr_facts) == 1
    assert corr_facts[0].current_value >= 0.99
    assert "correlation rather than confirmed direct causation" in corr_facts[0].explanation

def test_insight_prioritization_and_deduplication():
    """Validates duplicate key suppression and priority ordering."""
    service = BusinessInsightsService()

    f1 = StructuredInsightFact(
        id="fact_1",
        category="trend",
        title="Revenue Trend",
        severity=InsightSeverity.INFO.value,
        direction=InsightDirection.UPWARD.value,
        feature="revenue",
        confidence=0.70,
        explanation="Trend 1",
    )
    # Exact same analytical key, higher confidence
    f2 = StructuredInsightFact(
        id="fact_2",
        category="trend",
        title="Revenue Trend High Confidence",
        severity=InsightSeverity.INFO.value,
        direction=InsightDirection.UPWARD.value,
        feature="revenue",
        confidence=0.95,
        explanation="Trend 2 Higher Confidence",
    )
    # Critical severity fact
    f3 = StructuredInsightFact(
        id="fact_3",
        category="percentage_change",
        title="Revenue Drop Critical",
        severity=InsightSeverity.CRITICAL.value,
        direction=InsightDirection.DOWNWARD.value,
        feature="revenue_drop",
        confidence=0.90,
        explanation="Revenue dropped severely",
    )

    deduped = service._deduplicate_and_prioritize([f1, f2, f3])
    # Duplicate (trend, revenue) must collapse into 1 item, keeping f2 (confidence 0.95)
    assert len(deduped) == 2
    # Critical fact f3 must be prioritized first
    assert deduped[0].severity == InsightSeverity.CRITICAL.value
    assert deduped[1].id == "fact_2"

def test_llm_polish_and_safety_guardrails():
    """
    Tests LLM polisher:
    1. Polishes when enabled and consistent.
    2. Rejects candidate if numbers are altered or hallucinated.
    3. Rejects candidate if direction is inverted.
    4. Rejects candidate if speculative causal language is used.
    """
    polisher = LLMPolisher(enabled=True, provider="mock")

    fact = StructuredInsightFact(
        id="test_fact",
        category="trend",
        title="Revenue Upward",
        severity="positive",
        direction="upward",
        feature="revenue",
        confidence=0.90,
        explanation="Revenue increased by 18.4% across the analyzed sequence.",
    )

    # 1. Normal polish
    polished = polisher.polish_insight(fact)
    assert polished.is_llm_polished is True
    assert polished.polished_explanation is not None
    assert "18.4%" in polished.polished_explanation

    # 2. Guardrail test: number altered (e.g. 18.4% changed to 25.0%)
    invalid_candidate = "Revenue increased by 25.0% across the analyzed sequence."
    assert polisher._validate_factual_consistency(fact, invalid_candidate) is False

    # 3. Guardrail test: direction inverted (increased -> decreased)
    inverted_candidate = "Revenue decreased by 18.4% across the analyzed sequence."
    assert polisher._validate_factual_consistency(fact, inverted_candidate) is False

    # 4. Guardrail test: unsupported causal claim
    causal_candidate = "Revenue increased by 18.4% because of marketing campaign success."
    assert polisher._validate_factual_consistency(fact, causal_candidate) is False

def test_insights_api_end_to_end_and_multi_tenant_isolation(
    client: TestClient,
    auth_headers_user_a,
    auth_headers_user_b,
):
    """
    End-to-end test of /datasets/{id}/insights:
    1. Upload dataset under User A.
    2. Retrieve insights (deterministic rules triggered).
    3. User B cannot access User A's insights (404/403).
    4. Filter insights by category and severity.
    5. Retrieve insights summary.
    6. Delete insights.
    """
    # 1. Upload dataset as User A
    upload_res = client.post(
        "/api/v1/datasets/upload",
        headers=auth_headers_user_a,
        files={"file": ("sales_data.csv", io.BytesIO(SAMPLE_SALES_CSV), "text/csv")},
    )
    assert upload_res.status_code == 201
    dataset_id = upload_res.json()["id"]

    # 2. Get Insights for User A
    res = client.get(
        f"/api/v1/datasets/{dataset_id}/insights",
        headers=auth_headers_user_a,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] == dataset_id
    assert data["total_insights"] > 0
    assert len(data["insights"]) > 0

    # Verify structured attributes exist on every insight
    for item in data["insights"]:
        assert "id" in item
        assert "category" in item
        assert "severity" in item
        assert "explanation" in item
        assert "supporting_evidence" in item
        assert item["confidence"] > 0.0

    # 3. Multi-Tenant Isolation: User B cannot access User A's dataset insights
    forbidden_res = client.get(
        f"/api/v1/datasets/{dataset_id}/insights",
        headers=auth_headers_user_b,
    )
    assert forbidden_res.status_code == 404

    # 4. Category and severity filtering
    filtered_res = client.get(
        f"/api/v1/datasets/{dataset_id}/insights?category=trend",
        headers=auth_headers_user_a,
    )
    assert filtered_res.status_code == 200
    filtered_data = filtered_res.json()
    for item in filtered_data["insights"]:
        assert item["category"] == "trend"

    # 5. Summary endpoint
    summary_res = client.get(
        f"/api/v1/datasets/{dataset_id}/insights/summary",
        headers=auth_headers_user_a,
    )
    assert summary_res.status_code == 200
    summary_data = summary_res.json()
    assert summary_data["has_report"] is True
    assert summary_data["total_insights"] > 0
    assert summary_data["kpi_summary"] is not None

    # 6. Delete insights
    delete_res = client.delete(
        f"/api/v1/datasets/{dataset_id}/insights",
        headers=auth_headers_user_a,
    )
    assert delete_res.status_code == 200
    assert delete_res.json()["deleted_count"] >= 1
