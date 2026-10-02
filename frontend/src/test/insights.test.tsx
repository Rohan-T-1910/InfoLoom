import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsightCard } from '../components/insights/InsightCard';
import { InsightSummaryCards } from '../components/insights/InsightSummaryCards';
import { InsightFilterBar } from '../components/insights/InsightFilterBar';
import { StructuredInsightFact, InsightKPISummary } from '../types';

describe('Phase 8 Business Insights Frontend Components', () => {
  const sampleFactTrend: StructuredInsightFact = {
    id: 'trend_revenue_upward',
    category: 'trend',
    title: 'Consistent Upward Trend in Revenue',
    severity: 'positive',
    direction: 'upward',
    feature: 'revenue',
    current_value: 325.0,
    comparison_value: 100.0,
    change_pct: 110.5,
    change_abs: 225.0,
    confidence: 0.94,
    explanation: "Average 'revenue' displays a consistent upward trajectory across observations (R² = 0.82).",
    polished_explanation: "Analysis confirms that average 'revenue' displays a consistent upward trajectory across observations (R² = 0.82).",
    supporting_evidence: {
      r_squared: 0.824,
      slope: 11.84,
      total_span_delta: 225.0,
      observation_count: 20,
    },
    is_llm_polished: true,
  };

  const sampleFactCritical: StructuredInsightFact = {
    id: 'anomaly_prevalence_1',
    category: 'anomaly',
    title: 'Elevated Outlier Density Flagged',
    severity: 'critical',
    direction: 'anomalous',
    feature: 'error_rate',
    current_value: 6.5,
    comparison_value: 1.0,
    change_pct: null,
    change_abs: null,
    confidence: 0.96,
    explanation: "6.5% of records were isolated as extreme outliers, driven primarily by 'error_rate' (+18.4σ).",
    supporting_evidence: {
      anomaly_percentage: 6.5,
      total_samples: 500,
      top_feature: 'error_rate',
    },
    is_llm_polished: false,
  };

  const sampleKPI: InsightKPISummary = {
    total_insights: 8,
    critical_count: 1,
    warning_count: 2,
    positive_count: 3,
    info_count: 2,
    categories_covered: ['trend', 'anomaly', 'top_contributor', 'correlation'],
  };

  it('renders InsightCard with category, severity, metrics, and explanation', () => {
    render(<InsightCard fact={sampleFactTrend} showPolished={true} />);

    expect(screen.getByText('Consistent Upward Trend in Revenue')).toBeInTheDocument();
    expect(screen.getByText('Trend Direction')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText(/Delta: \+110.5%/i)).toBeInTheDocument();

    // Check AI phrased text is displayed
    expect(
      screen.getByText(/Analysis confirms that average 'revenue'/i)
    ).toBeInTheDocument();

    // Toggle template view
    fireEvent.click(screen.getByText('AI Phrased'));
    expect(screen.getByText('Template Text')).toBeInTheDocument();
  });

  it('expands supporting evidence and mathematical verification in InsightCard', () => {
    render(<InsightCard fact={sampleFactCritical} />);

    expect(screen.getByText('Elevated Outlier Density Flagged')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();

    // Click to expand mathematical basis
    const expandBtn = screen.getByText(/Supporting Evidence & Analytical Basis/i);
    fireEvent.click(expandBtn);

    expect(screen.getByText('Deterministic Rule Verification')).toBeInTheDocument();
    expect(screen.getByText('100% Data Backed')).toBeInTheDocument();
    expect(screen.getAllByText('error_rate').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('top feature')).toBeInTheDocument();
  });

  it('renders InsightSummaryCards with exact counts', () => {
    render(<InsightSummaryCards kpi={sampleKPI} />);

    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/4 dimensions covered/i)).toBeInTheDocument();
  });

  it('handles filtering, search, and LLM toggle in InsightFilterBar', () => {
    const onSelectCat = vi.fn();
    const onSelectSev = vi.fn();
    const onSearch = vi.fn();
    const onToggle = vi.fn();
    const onRefresh = vi.fn();

    render(
      <InsightFilterBar
        categories={['trend', 'anomaly']}
        selectedCategory="all"
        onSelectCategory={onSelectCat}
        selectedSeverity="all"
        onSelectSeverity={onSelectSev}
        searchTerm=""
        onSearchChange={onSearch}
        includeLLM={false}
        onToggleLLM={onToggle}
        onRefresh={onRefresh}
        isRefreshing={false}
        totalFilteredCount={8}
      />
    );

    // Click a category pill
    fireEvent.click(screen.getByText('Trends'));
    expect(onSelectCat).toHaveBeenCalledWith('trend');

    // Click a severity pill
    fireEvent.click(screen.getByText('critical'));
    expect(onSelectSev).toHaveBeenCalledWith('critical');

    // Type in search
    const searchInput = screen.getByPlaceholderText(/Search insights/i);
    fireEvent.change(searchInput, { target: { value: 'revenue' } });
    expect(onSearch).toHaveBeenCalledWith('revenue');

    // Toggle LLM
    fireEvent.click(screen.getByText('Deterministic NLG'));
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Refresh
    fireEvent.click(screen.getByText('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
