# InfoLoom Phase 2 Database Schema

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ datasets : "owns (1:N)"
    users ||--o{ cleaning_reports : "owns (1:N)"
    datasets ||--o{ cleaning_reports : "has (1:N)"

    users {
        int id PK "Serial, Primary Key"
        varchar(50) name "Full name"
        varchar(100) email "Unique, Not Null"
        varchar(255) password_hash "Bcrypt hash"
        varchar(20) role "Default: 'User'"
        timestamp_with_tz created_at "Default: now()"
    }

    datasets {
        int id PK "Serial, Primary Key, Indexed"
        int user_id FK "References users(id) ON DELETE CASCADE, Indexed"
        varchar(255) filename "Sanitized unique storage name"
        varchar(255) original_filename "Original upload name"
        varchar(500) file_path "Storage destination path on disk"
        bigint file_size_bytes "Size in bytes"
        int row_count "Parsed row count (nullable)"
        int column_count "Parsed column count (nullable)"
        json columns_metadata "Headers, inferred column types, summary"
        varchar(50) status "Status ('ready', 'processing', etc.)"
        varchar(500) cleaned_file_path "Path to cleaned CSV artifact (nullable)"
        boolean has_cleaned "True if dataset has been cleaned (Default: false)"
        timestamp_with_tz created_at "Default: now()"
        timestamp_with_tz updated_at "Default: now(), on update: now()"
    }

    cleaning_reports {
        int id PK "Serial, Primary Key, Indexed"
        int dataset_id FK "References datasets(id) ON DELETE CASCADE, Indexed"
        int user_id FK "References users(id) ON DELETE CASCADE, Indexed"
        json validation_summary "Full pre-cleaning validation metrics & profiles"
        json cleaning_summary "Transformation steps, counts dropped/imputed/clipped"
        varchar(500) cleaned_file_path "Path to cleaned CSV file"
        varchar(50) status "Status ('completed', 'failed')"
        timestamp_with_tz created_at "Default: now()"
    }
```

## Schema Changes in Phase 2
1. **New Table: `cleaning_reports`**:
   - `id`: Primary key
   - `dataset_id`: Foreign key -> `datasets.id` with `ON DELETE CASCADE`
   - `user_id`: Foreign key -> `users.id` with `ON DELETE CASCADE` (strict multi-tenant ownership)
   - `validation_summary`: JSON storing comprehensive descriptive stats, missingness, duplicates, and outliers
   - `cleaning_summary`: JSON storing audit trail of actions taken per strategy
   - `cleaned_file_path`: Storage location of cleaned artifact
   - `status`: Execution status
   - `created_at`: Audit timestamp
2. **Additions to `datasets` table**:
   - `cleaned_file_path` (`VARCHAR(500)`, nullable)
   - `has_cleaned` (`BOOLEAN`, NOT NULL, default `false`)
