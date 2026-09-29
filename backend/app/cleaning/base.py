from abc import ABC, abstractmethod
from typing import Any
import pandas as pd

class CleaningStep(ABC):
    """
    Abstract Strategy Interface for an atomic, swappable data cleaning step.
    Each step takes a DataFrame, applies transformations, and returns:
    (transformed_dataframe, action_summary_dictionary)
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the cleaning step."""
        pass

    @abstractmethod
    def execute(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
        """
        Executes cleaning transformation on the DataFrame.
        Returns:
            pd.DataFrame: Transformed copy of DataFrame.
            dict[str, Any]: Audit summary of changes made.
        """
        pass
