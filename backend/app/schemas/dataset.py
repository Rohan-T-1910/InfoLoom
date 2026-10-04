from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict

class DatasetResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    original_filename: str
    file_size_bytes: int
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    status: str
    has_cleaned: bool = False
    cleaned_file_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DatasetDetailResponse(DatasetResponse):
    columns_metadata: Optional[dict[str, Any]] = None

class DatasetListResponse(BaseModel):
    items: list[DatasetResponse]
    total: int

class DatasetPreviewResponse(BaseModel):
    id: int
    original_filename: str
    row_count: Optional[int]
    column_count: Optional[int]
    columns: list[str]
    sample_rows: list[dict[str, Any]]
