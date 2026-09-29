import csv
import io
import os
import re
import uuid
from pathlib import Path
from typing import Any, Optional
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.dataset import Dataset
from app.repositories.dataset_repository import dataset_repository
from app.schemas.dataset import DatasetPreviewResponse

class DatasetService:
    CHUNK_SIZE = 64 * 1024  # 64 KB streaming chunks

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitizes filename to prevent directory traversal and invalid characters."""
        base_name = os.path.basename(filename)
        # Strip dangerous characters, keep alphanumeric, dot, underscore, dash
        clean_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", base_name)
        return clean_name or "dataset.csv"

    def _validate_csv_file_type(self, file: UploadFile) -> None:
        """Validates that the uploaded file has a .csv extension and reasonable content type."""
        filename = file.filename or ""
        if not filename.lower().endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only CSV files (.csv) are supported."
            )
        # Allow common CSV content types or generic text/octet-stream if extension is .csv
        valid_mime_types = [
            "text/csv",
            "text/plain",
            "application/csv",
            "application/vnd.ms-excel",
            "application/octet-stream",
        ]
        if file.content_type and file.content_type.lower() not in valid_mime_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Content-Type '{file.content_type}'. Must be a CSV file."
            )

    async def upload_dataset(
        self,
        db: Session,
        file: UploadFile,
        user_id: int
    ) -> Dataset:
        """
        Streams uploaded CSV to disk with size validation, extracts schema metadata,
        and creates a strictly owned dataset record.
        """
        self._validate_csv_file_type(file)
        clean_orig_name = self._sanitize_filename(file.filename or "dataset.csv")

        # Prepare user storage directory
        user_upload_dir = Path(settings.UPLOAD_DIR) / f"user_{user_id}"
        user_upload_dir.mkdir(parents=True, exist_ok=True)

        storage_filename = f"{uuid.uuid4().hex}_{clean_orig_name}"
        destination_path = user_upload_dir / storage_filename

        total_bytes = 0
        try:
            with open(destination_path, "wb") as out_file:
                while True:
                    chunk = await file.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB."
                        )

                    out_file.write(chunk)

            if total_bytes == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded CSV file is empty."
                )

            # Analyze CSV metadata without full memory explosion
            metadata = self._inspect_csv(destination_path)

            dataset = dataset_repository.create(
                db=db,
                user_id=user_id,
                filename=storage_filename,
                original_filename=clean_orig_name,
                file_path=str(destination_path),
                file_size_bytes=total_bytes,
                row_count=metadata["row_count"],
                column_count=metadata["column_count"],
                columns_metadata=metadata["columns_metadata"],
            )
            return dataset

        except Exception as exc:
            # If any failure occurs during upload/parsing, remove the partial file
            if destination_path.exists():
                try:
                    os.remove(destination_path)
                except OSError:
                    pass
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process CSV file: {str(exc)}"
            )

    def _inspect_csv(self, file_path: Path) -> dict[str, Any]:
        """Reads CSV header, row counts, and column types."""
        # Try UTF-8 with BOM handling, fallback to latin-1
        encodings = ["utf-8-sig", "utf-8", "latin-1"]
        encoding_used = None
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    f.readline()
                encoding_used = enc
                break
            except UnicodeDecodeError:
                continue

        if not encoding_used:
            raise ValueError("Unable to decode CSV file with supported text encodings.")

        with open(file_path, "r", encoding=encoding_used, newline="") as f:
            reader = csv.reader(f)
            try:
                headers = next(reader)
            except StopIteration:
                raise ValueError("CSV file does not contain a header row.")

            # Clean and strip header names
            headers = [h.strip() for h in headers if h is not None]
            if not headers:
                raise ValueError("CSV header row contains no valid columns.")

            row_count = 0
            sample_rows: list[list[str]] = []
            col_types: dict[str, set[str]] = {h: set() for h in headers}

            for row in reader:
                row_count += 1
                if len(sample_rows) < 5:
                    sample_rows.append(row)
                
                # Check rudimentary types on sample (up to 100 rows)
                if row_count <= 100:
                    for i, val in enumerate(row):
                        if i < len(headers):
                            v = val.strip()
                            if not v:
                                continue
                            if re.match(r"^-?\d+$", v):
                                col_types[headers[i]].add("integer")
                            elif re.match(r"^-?\d*\.\d+$", v):
                                col_types[headers[i]].add("float")
                            else:
                                col_types[headers[i]].add("string")

        # Summarize inferred types
        columns_summary: dict[str, Any] = {}
        for h in headers:
            types = col_types.get(h, set())
            if "string" in types:
                inferred = "string"
            elif "float" in types:
                inferred = "float"
            elif "integer" in types:
                inferred = "integer"
            else:
                inferred = "string"
            columns_summary[h] = {"type": inferred}

        return {
            "row_count": row_count,
            "column_count": len(headers),
            "columns_metadata": {
                "columns": headers,
                "schema": columns_summary,
            },
        }

    def list_datasets(
        self, db: Session, user_id: int, skip: int = 0, limit: int = 50
    ) -> tuple[list[Dataset], int]:
        return dataset_repository.list_by_user(db, user_id=user_id, skip=skip, limit=limit)

    def get_dataset(self, db: Session, dataset_id: int, user_id: int) -> Dataset:
        dataset = dataset_repository.get_by_id_and_user(db, dataset_id=dataset_id, user_id=user_id)
        if not dataset:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found."
            )
        return dataset

    def delete_dataset(self, db: Session, dataset_id: int, user_id: int) -> None:
        dataset = self.get_dataset(db, dataset_id=dataset_id, user_id=user_id)
        # Remove physical file
        if dataset.file_path and os.path.exists(dataset.file_path):
            try:
                os.remove(dataset.file_path)
            except OSError:
                pass
        dataset_repository.delete(db, dataset)

    def get_preview(
        self, db: Session, dataset_id: int, user_id: int, limit: int = 10
    ) -> DatasetPreviewResponse:
        dataset = self.get_dataset(db, dataset_id=dataset_id, user_id=user_id)
        if not os.path.exists(dataset.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset file is missing from storage."
            )

        rows: list[dict[str, Any]] = []
        columns: list[str] = []

        encodings = ["utf-8-sig", "utf-8", "latin-1"]
        encoding_used = None
        for enc in encodings:
            try:
                with open(dataset.file_path, "r", encoding=enc) as f:
                    f.readline()
                encoding_used = enc
                break
            except UnicodeDecodeError:
                continue

        if not encoding_used:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to read CSV file.")

        with open(dataset.file_path, "r", encoding=encoding_used, newline="") as f:
            reader = csv.DictReader(f)
            columns = [c.strip() for c in (reader.fieldnames or [])]
            for i, row in enumerate(reader):
                if i >= limit:
                    break
                rows.append({k.strip(): v for k, v in row.items() if k is not None})

        return DatasetPreviewResponse(
            id=dataset.id,
            original_filename=dataset.original_filename,
            row_count=dataset.row_count,
            column_count=dataset.column_count,
            columns=columns,
            sample_rows=rows,
        )

dataset_service = DatasetService()
