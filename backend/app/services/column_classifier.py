import re
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


# Explicit patterns matching identifier columns (case-insensitive)
IDENTIFIER_REGEX = re.compile(
    r"^(id|identifier|idx|index|pk|key|uuid|guid|row_id|record_id|row_num|row_number|hash|ssn|token)$"
    r"|(_id|\bid|-id|_uuid|\buuid|-uuid|_guid|\bguid|_key|\bkey|_pk|\bpk|_code|\bcode)$"
    r"|^(id_|id\b|id-|uuid_|uuid\b|uuid-|guid_|guid\b|guid-|pk_|pk\b|pk-)"
    r"|.*(transaction|customer|order|product|account|session|client|invoice|item|member|employee|receipt|booking|patient|device|user|visitor|cust|trans|txn|prod|acct).*(id|number|num|code|key)$",
    re.IGNORECASE,
)

COMMON_ID_NAMES = {
    "id",
    "idx",
    "index",
    "uuid",
    "guid",
    "pk",
    "key",
    "hash",
    "token",
    "ssn",
    "row_id",
    "record_id",
    "row_number",
    "row_num",
    "transaction_id",
    "transaction id",
    "transaction-id",
    "transactionid",
    "trans_id",
    "txn_id",
    "txnid",
    "customer_id",
    "customer id",
    "customer-id",
    "customerid",
    "cust_id",
    "custid",
    "user_id",
    "user id",
    "user-id",
    "userid",
    "order_id",
    "order id",
    "order-id",
    "orderid",
    "product_id",
    "product id",
    "product-id",
    "productid",
    "prod_id",
    "prodid",
    "account_id",
    "account id",
    "account-id",
    "accountid",
    "acct_id",
    "acctid",
    "session_id",
    "session id",
    "session-id",
    "sessionid",
    "client_id",
    "client id",
    "clientid",
    "invoice_id",
    "invoice id",
    "invoiceid",
    "item_id",
    "item id",
    "itemid",
    "member_id",
    "member id",
    "memberid",
    "receipt_id",
    "receipt id",
    "receiptid",
    "employee_id",
    "employee id",
    "employeeid",
    "device_id",
    "device id",
    "deviceid",
    "order_number",
    "order number",
    "ordernumber",
    "order_num",
    "customer_number",
    "customer number",
    "customernumber",
    "transaction_number",
    "transaction number",
    "transactionnumber",
    "product_code",
    "product code",
    "productcode",
    "item_code",
    "item code",
    "itemcode",
}


class ColumnClassifier:
    """
    Standardized, robust column classification utility used across all analytics engines
    (Business Insights, Anomaly Detection, Predictive Modeling, Segmentation, Forecasting).
    """

    @staticmethod
    def is_identifier(col_name: str, series: Optional[pd.Series] = None) -> bool:
        """
        Determines whether a column is a technical identifier (primary key, foreign key,
        transaction/customer/order ID, UUID, sequential counter, or row index).
        Handles CamelCase (TransactionID), snake_case (transaction_id), and title case (Transaction ID).
        """
        if not col_name:
            return False

        col_str = str(col_name).strip()

        # Split CamelCase: e.g. "TransactionID" -> "transaction_id", "CustomerID" -> "customer_id"
        s_camel = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", col_str).lower()
        s_clean = re.sub(r"[\s\-_]+", "_", s_camel)
        clean_raw = col_str.lower()

        # 1. Exact common name check
        if clean_raw in COMMON_ID_NAMES or s_clean in COMMON_ID_NAMES:
            return True

        # 2. Suffix / prefix matches on normalized snake_case
        if s_clean.endswith(("_id", "_uuid", "_guid", "_pk", "_key", "_index", "_hash", "_token")):
            return True

        if s_clean.startswith(("id_", "uuid_", "guid_", "pk_")):
            return True

        # 3. Regex pattern match
        if IDENTIFIER_REGEX.search(col_str) or IDENTIFIER_REGEX.search(s_clean) or IDENTIFIER_REGEX.search(clean_raw):
            return True

        # 4. Series content inspection (if series provided)
        if series is not None and len(series) > 0:
            valid_series = series.dropna()
            n_valid = len(valid_series)
            if n_valid >= 10:
                n_unique = valid_series.nunique()

                # If integer column has 100% unique sequential values (e.g. 1, 2, 3... or 1001, 1002...)
                if n_unique == n_valid and pd.api.types.is_integer_dtype(valid_series):
                    sorted_vals = np.sort(valid_series.values)
                    sorted_diff = np.diff(sorted_vals)
                    # Check if sequential with step 1
                    if len(sorted_diff) > 0 and (sorted_diff == 1).mean() > 0.95:
                        return True

                # If string column has near-unique values (>98%) and typical ID string patterns
                if n_unique / n_valid >= 0.98 and (
                    pd.api.types.is_string_dtype(valid_series) or pd.api.types.is_object_dtype(valid_series)
                ):
                    sample_vals = valid_series.astype(str).head(20)
                    # Check if resembles UUID/hex or prefixed ID (e.g. "TXN001", "CUST-1234")
                    id_like_samples = sum(
                        bool(re.match(r"^[A-Za-z0-9\-_]{4,64}$", s)) for s in sample_vals
                    )
                    if id_like_samples / len(sample_vals) >= 0.9:
                        return True

        return False

    @staticmethod
    def is_datetime(col_name: str, series: pd.Series) -> bool:
        """
        Determines whether a column represents dates or timestamps.
        """
        if pd.api.types.is_datetime64_any_dtype(series):
            return True

        clean_name = str(col_name).strip().lower()
        date_keywords = {"date", "time", "timestamp", "datetime", "created_at", "updated_at", "day", "month", "year"}
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            if clean_name in date_keywords or any(k in clean_name for k in ["_date", "date_", "_time", "time_"]):
                sample = series.dropna().head(20)
                if len(sample) > 0:
                    parsed = pd.to_datetime(sample, errors="coerce")
                    if parsed.notna().mean() >= 0.7:
                        return True

            if pd.api.types.is_object_dtype(series) or pd.api.types.is_string_dtype(series):
                sample = series.dropna().head(20)
                if len(sample) > 0:
                    parsed = pd.to_datetime(sample, errors="coerce")
                    if parsed.notna().mean() >= 0.85:
                        return True

        return False

    @staticmethod
    def is_numeric_measure(col_name: str, series: pd.Series) -> bool:
        """
        Determines whether a column is a true numeric business measure
        (e.g., revenue, sales, quantity, price, profit, cost) and NOT an identifier or constant.
        """
        if not pd.api.types.is_numeric_dtype(series):
            return False

        if ColumnClassifier.is_identifier(col_name, series):
            return False

        valid_series = series.dropna()
        if len(valid_series) < 2 or valid_series.nunique() <= 1:
            return False

        std_val = float(valid_series.std())
        if std_val < 1e-6:
            return False

        return True

    @staticmethod
    def is_categorical_dimension(col_name: str, series: pd.Series) -> bool:
        """
        Determines whether a column is a descriptive category or dimension
        (e.g., product category, region, gender, payment method) and NOT an identifier.
        """
        if ColumnClassifier.is_identifier(col_name, series):
            return False

        if ColumnClassifier.is_datetime(col_name, series):
            return False

        valid_series = series.dropna()
        if len(valid_series) < 2 or valid_series.nunique() <= 1:
            return False

        # Exclude high-cardinality unique text if nunique is nearly equal to row count
        if len(valid_series) >= 20 and valid_series.nunique() / len(valid_series) > 0.95:
            return False

        return (
            pd.api.types.is_object_dtype(series)
            or pd.api.types.is_string_dtype(series)
            or isinstance(series.dtype, pd.CategoricalDtype)
            or (pd.api.types.is_integer_dtype(series) and valid_series.nunique() <= 8)
        )

    @classmethod
    def classify_columns(cls, df: pd.DataFrame) -> Dict[str, List[str]]:
        """
        Classifies all columns of a DataFrame into mutually understood roles:
        - identifiers: technical IDs, keys, indices
        - datetimes: chronological date and time columns
        - numeric_measures: quantitative business metrics
        - categoricals: qualitative segments and dimensions
        """
        identifiers = []
        datetimes = []
        numeric_measures = []
        categoricals = []

        for col in df.columns:
            series = df[col]
            if cls.is_identifier(col, series):
                identifiers.append(str(col))
            elif cls.is_datetime(col, series):
                datetimes.append(str(col))
            elif cls.is_numeric_measure(col, series):
                numeric_measures.append(str(col))
            elif cls.is_categorical_dimension(col, series):
                categoricals.append(str(col))
            elif pd.api.types.is_numeric_dtype(series):
                numeric_measures.append(str(col))
            else:
                categoricals.append(str(col))

        return {
            "identifiers": identifiers,
            "datetimes": datetimes,
            "numeric_measures": numeric_measures,
            "categoricals": categoricals,
        }


column_classifier = ColumnClassifier()
