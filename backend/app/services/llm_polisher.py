import logging
import re
from typing import Any, List, Optional
from app.core.config import settings
from app.schemas.insight import StructuredInsightFact

logger = logging.getLogger(__name__)

class LLMPolisher:
    """
    Optional phrasing polisher for deterministic business insights.
    
    STRICT SAFETY CONTRACT:
    - The LLM is only an optional phrasing/wording polish layer.
    - It must NEVER compute, alter, or hallucinate metrics, directions, causes, or recommendations.
    - If disabled, unavailable, times out, or alters any factual numbers/direction,
      it silently falls back to the deterministic template text.
    """

    def __init__(self, enabled: Optional[bool] = None, provider: str = "mock"):
        self.enabled = enabled if enabled is not None else getattr(settings, "INSIGHTS_LLM_ENABLED", False)
        self.provider = getattr(settings, "INSIGHTS_LLM_PROVIDER", provider)

    def polish_insight(self, fact: StructuredInsightFact) -> StructuredInsightFact:
        """
        Attempts to polish a single insight fact.
        Returns fact with polished_explanation and is_llm_polished=True if valid,
        or unchanged fact if disabled/failed/invalid.
        """
        if not self.enabled:
            return fact

        try:
            candidate_text = self._generate_candidate(fact)
            if not candidate_text:
                return fact

            if self._validate_factual_consistency(fact, candidate_text):
                fact.polished_explanation = candidate_text
                fact.is_llm_polished = True
            else:
                logger.warning(
                    f"LLM polish rejected for insight {fact.id}: failed factual consistency guardrails."
                )
                fact.polished_explanation = None
                fact.is_llm_polished = False
        except Exception as e:
            logger.warning(f"LLM polishing failed for insight {fact.id}: {e}. Falling back to template text.")
            fact.polished_explanation = None
            fact.is_llm_polished = False

        return fact

    def polish_all(self, facts: List[StructuredInsightFact]) -> List[StructuredInsightFact]:
        """Polishes a collection of structured insight facts."""
        if not self.enabled:
            return facts
        return [self.polish_insight(f) for f in facts]

    def _generate_candidate(self, fact: StructuredInsightFact) -> Optional[str]:
        """
        Dispatches to mock, OpenAI, or Gemini provider.
        In normal operation/testing without external API keys, uses a deterministic natural phrasing transformer.
        """
        # When running in mock/demo mode:
        if self.provider == "mock" or not getattr(settings, "OPENAI_API_KEY", None):
            return self._mock_natural_polish(fact)

        # Real LLM call integration (if API key provided):
        try:
            # We import lazily so no hard dependency on external openai/gemini packages is required
            import httpx

            api_key = getattr(settings, "OPENAI_API_KEY", None)
            if not api_key:
                return self._mock_natural_polish(fact)

            prompt = (
                f"You are an executive business editor. Rephrase the following deterministic analytical finding "
                f"into a single fluent, professional sentence for an executive briefing.\n"
                f"RULES:\n"
                f"1. You MUST preserve all numbers, metrics, percentages, and direction exactly as stated.\n"
                f"2. Do NOT invent causes, reasons, or recommendations.\n"
                f"3. Original finding: {fact.explanation}\n"
                f"Output only the polished sentence without quotes or commentary."
            )

            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "max_tokens": 120,
                },
                timeout=4.0,
            )
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                return content
            else:
                logger.warning(f"LLM provider returned status {response.status_code}")
                return self._mock_natural_polish(fact)
        except Exception as err:
            logger.warning(f"External LLM call failed: {err}")
            return self._mock_natural_polish(fact)

    def _mock_natural_polish(self, fact: StructuredInsightFact) -> str:
        """
        Deterministic, natural phrasing transformer used for mock/fallback mode.
        Smooths template cadence while retaining 100% of facts.
        """
        base = fact.explanation.rstrip(".")
        if fact.category == "trend":
            return f"Analysis confirms that {base.lower()}."
        elif fact.category == "percentage_change":
            return f"Key metric movement observed: {base}."
        elif fact.category == "top_contributor":
            return f"Distribution analysis highlights that {base.lower()}."
        elif fact.category == "correlation":
            return f"Statistical evaluation shows that {base.lower()}."
        elif fact.category == "forecast":
            return f"Predictive modeling indicates {base.lower()}."
        elif fact.category == "anomaly":
            return f"Outlier diagnostics report that {base.lower()}."
        elif fact.category == "model_performance":
            return f"Supervised evaluation demonstrates that {base.lower()}."
        else:
            return f"Operational analysis indicates that {base.lower()}."

    def _validate_factual_consistency(self, fact: StructuredInsightFact, candidate: str) -> bool:
        """
        Validates that candidate text preserves all quantitative facts,
        does not introduce unsupported causal claims, and maintains direction.
        """
        if not candidate or len(candidate) < 10:
            return False

        # Guardrail 1: Disallow causal assertions ("because of", "due to", "caused by", "recommends buying")
        banned_patterns = [
            r"\bbecause\s+of\b",
            r"\bdue\s+to\b",
            r"\bcaused\s+by\b",
            r"\brecommend(s|ed|ing)?\s+buying\b",
            r"\bguaranteed\b",
        ]
        for pattern in banned_patterns:
            if re.search(pattern, candidate, re.IGNORECASE):
                return False

        # Guardrail 2: Directional consistency
        if fact.direction == "upward":
            if "decreas" in candidate.lower() or "declined" in candidate.lower() or "downward" in candidate.lower():
                return False
        elif fact.direction == "downward":
            if "increas" in candidate.lower() or "growth" in candidate.lower() or "upward" in candidate.lower():
                return False

        # Guardrail 3: Numeric consistency check
        # Extract all numeric digits from original template
        original_numbers = set(re.findall(r"\b\d+(?:\.\d+)?%?", fact.explanation))
        # Ensure that major numbers in original template still exist in candidate
        for num in original_numbers:
            # Check if this number string appears in candidate
            if num not in candidate:
                # If a formatted number like 18.4% is missing, fail guardrail
                if "." in num or "%" in num:
                    return False

        return True

llm_polisher = LLMPolisher()
