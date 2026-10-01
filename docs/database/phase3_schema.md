# InfoLoom Phase 3 Database Schema: EDA Reports

## Table: `eda_reports`

Stores generated exploratory data analysis results and caches computational outputs per dataset.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | Primary Key, Auto-increment | Unique identifier |
| `dataset_id` | `INTEGER` | Foreign Key (`datasets.id` ON DELETE CASCADE), Indexed, Not Null | Associated dataset reference |
| `user_id` | `INTEGER` | Foreign Key (`users.id` ON DELETE CASCADE), Indexed, Not Null | Owner identifier for multi-tenancy |
| `is_cleaned` | `BOOLEAN` | Not Null, Default: `false` | Distinguishes analysis of cleaned vs raw data |
| `target_column` | `VARCHAR(255)` | Nullable | Target variable evaluated for feature importance |
| `kpis` | `JSON` | Not Null | Global metrics (rows, cols, missingness %, duplicate %, memory) |
| `summary_statistics` | `JSON` | Not Null | Statistical profiling per feature (mean, std, IQR, skewness, kurtosis, etc.) |
| `correlation_matrix` | `JSON` | Not Null | Pearson correlation matrix and collinearity warning flags |
| `distributions` | `JSON` | Not Null | Univariate histogram buckets and frequency counts |
| `feature_importance` | `JSON` | Nullable | Baseline Random Forest feature ranking and score |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Server Default: `NOW()`, Not Null | Creation timestamp |

### Indexes
- `ix_eda_reports_id` on `id`
- `ix_eda_reports_dataset_id` on `dataset_id`
- `ix_eda_reports_user_id` on `user_id`

### Cache Invalidation Strategy
- Whenever a cleaning run completes via `DataCleaningService.clean_dataset()`, any existing cached reports for `dataset_id` are automatically purged via `eda_repository.invalidate_cache()`.
- Client can bypass cache via `?force_refresh=true` or `POST /refresh`.
