from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ReportSectionStatus(BaseModel):
    key: str = Field(..., description="Unique section identifier")
    name: str = Field(..., description="Section title for report")
    phase: str = Field(..., description="Phase identifier e.g. Phase 3")
    status: str = Field(..., description="'available' if results exist, otherwise 'unavailable'")
    detail: Optional[str] = Field(None, description="Summary description of available results")
    record_count: Optional[int] = Field(None, description="Number of models/records in this section")

class ReportReadinessResponse(BaseModel):
    dataset_id: int
    dataset_name: str
    total_rows: int
    total_columns: int
    has_cleaned: bool
    sections: List[ReportSectionStatus]
    available_sections_count: int
    total_sections_count: int
    ready_for_pdf: bool

class ReportDocumentResponse(BaseModel):
    id: int
    dataset_id: int
    user_id: int
    title: str
    report_type: str
    file_name: str
    file_size_bytes: int
    sections_included: List[str]
    metadata_summary: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CSVExportPreviewResponse(BaseModel):
    export_type: str
    model_id: Optional[int] = None
    model_name: str
    total_rows: int
    columns: List[str]
    preview_rows: List[dict[str, Any]]
