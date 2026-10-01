export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface Dataset {
  id: number;
  user_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size_bytes: number;
  row_count?: number;
  column_count?: number;
  columns_metadata?: Record<string, string>;
  status: string;
  cleaned_file_path?: string;
  has_cleaned: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatasetListResponse {
  items: Dataset[];
  total: number;
}

export interface DatasetPreviewResponse {
  id: number;
  original_filename: string;
  row_count: number;
  column_count: number;
  columns: string[];
  sample_rows: Record<string, any>[];
}

export interface DatasetKPIs {
  row_count: number;
  column_count: number;
  total_cells: number;
  missing_cells: number;
  missing_percentage: number;
  duplicate_rows: number;
  duplicate_percentage: number;
  numeric_columns_count: number;
  categorical_columns_count: number;
  memory_bytes: number;
  memory_human: string;
}

export interface NumericColumnStats {
  data_type: 'numeric';
  count: number;
  missing_count: number;
  missing_percentage: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  q25: number | null;
  median: number | null;
  q75: number | null;
  max: number | null;
  iqr: number | null;
  skewness: number | null;
  kurtosis: number | null;
  zeros_count: number;
  zeros_percentage: number;
}

export interface CategoryFrequency {
  category: string;
  count: number;
  percentage: number;
}

export interface CategoricalColumnStats {
  data_type: 'categorical';
  count: number;
  missing_count: number;
  missing_percentage: number;
  unique: number;
  mode: string | null;
  mode_frequency: number | null;
  top_categories: CategoryFrequency[];
}

export interface CorrelationPair {
  feature_a: string;
  feature_b: string;
  correlation: number;
  abs_correlation: number;
  relationship: string;
}

export interface CorrelationMatrixResponse {
  columns: string[];
  matrix: Record<string, Record<string, number | null>>;
  strong_correlations: CorrelationPair[];
  warnings: string[];
}

export interface DistributionBin {
  bin_start?: number | null;
  bin_end?: number | null;
  label: string;
  count: number;
  percentage: number;
}

export interface ColumnDistribution {
  column_name: string;
  data_type: string;
  bins: DistributionBin[];
  summary: Record<string, any>;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  percentage: number;
  rank: number;
}

export interface FeatureImportanceResponse {
  target_column: string;
  problem_type: string;
  model_used: string;
  baseline_score_name: string;
  baseline_score: number | null;
  features: FeatureImportanceItem[];
  candidate_targets: string[];
}

export interface EDAResponse {
  id?: number | null;
  dataset_id: number;
  is_cleaned: boolean;
  target_column?: string | null;
  kpis: DatasetKPIs;
  summary_statistics: Record<string, NumericColumnStats | CategoricalColumnStats>;
  correlation_matrix: CorrelationMatrixResponse;
  distributions: Record<string, ColumnDistribution>;
  feature_importance?: FeatureImportanceResponse | null;
  cached: boolean;
  created_at?: string | null;
}

export interface CleaningReportResponse {
  id: number;
  dataset_id: number;
  user_id: number;
  validation_summary: Record<string, any>;
  cleaning_summary: Record<string, any>;
  cleaned_file_path?: string;
  status: string;
  created_at: string;
}
