export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  access_token?: string | null;
  token_type?: string | null;
}

export interface AuthResponse extends User {
  access_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
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

// ==========================================
// Phase 4: Machine Learning Types
// ==========================================

export type MLTaskType = 'regression' | 'classification';
export type MLAlgorithm =
  | 'linear_regression'
  | 'logistic_regression'
  | 'random_forest'
  | 'xgboost';

export interface MLTargetInspectionResponse {
  target_column: string;
  inferred_task_type: MLTaskType;
  unique_count: number;
  sample_values: any[];
  candidate_features: string[];
  is_supported: boolean;
  warning?: string | null;
}

export interface MLTrainRequest {
  task_type: MLTaskType;
  target_column: string;
  feature_columns?: string[];
  test_size?: number;
  cv_folds?: number;
  algorithms?: string[];
  use_cleaned?: boolean;
}

export interface MLModelLeaderboardItem {
  id: number;
  algorithm: string;
  algorithm_name: string;
  task_type: MLTaskType;
  test_metrics: Record<string, number | null>;
  cv_mean: number | null;
  cv_std: number | null;
  primary_metric_name: string;
  primary_metric_value: number | null;
  status: string;
  error_message?: string | null;
  created_at: string;
}

export interface MLJob {
  id: number;
  dataset_id: number;
  user_id: number;
  task_type: MLTaskType;
  target_column: string;
  feature_columns: string[];
  test_size: number;
  use_cleaned: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error_message?: string | null;
  leaderboard?: MLModelLeaderboardItem[];
  best_model_id?: number | null;
  created_at: string;
  completed_at?: string | null;
}

export interface MLModelDetail extends MLModelLeaderboardItem {
  job_id: number;
  dataset_id: number;
  features_numeric: string[];
  features_categorical: string[];
  target_column: string;
  target_classes?: string[] | null;
  cv_scores?: number[] | null;
}

export interface MLPredictRequest {
  inputs: Record<string, any>[];
}

export interface MLPredictionItem {
  prediction: any;
  probabilities?: Record<string, number> | null;
}

export interface MLPredictResponse {
  model_id: number;
  algorithm: string;
  task_type: MLTaskType;
  predictions: MLPredictionItem[];
}

// ==========================================
// Phase 5: Clustering & Customer Segmentation Types
// ==========================================

export interface ClusteringFeatureInfo {
  name: string;
  data_type: string;
  non_null_count: number;
  missing_count: number;
  mean?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;
}

export interface ClusteringFeaturesResponse {
  dataset_id: number;
  is_cleaned: boolean;
  total_rows: number;
  numeric_features: ClusteringFeatureInfo[];
  recommended_features: string[];
}

export interface ClusteringEvaluationRequest {
  features: string[];
  k_min?: number;
  k_max?: number;
  use_cleaned?: boolean;
}

export interface KMeansKMetric {
  k: number;
  inertia: number;
  silhouette_score?: number | null;
}

export interface ClusteringEvaluationResponse {
  features: string[];
  n_samples: number;
  k_metrics: KMeansKMetric[];
  suggested_k: number;
  suggestion_reason: string;
}

export interface ClusteringRunRequest {
  features: string[];
  k: number;
  name?: string | null;
  use_cleaned?: boolean;
}

export interface ClusterFeatureStat {
  feature: string;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
}

export interface ClusterProfile {
  cluster_id: number;
  name: string;
  size: number;
  percentage: number;
  stats: ClusterFeatureStat[];
}

export interface ClusteringDataPoint {
  index: number;
  cluster: number;
  x?: number | null;
  y?: number | null;
  features: Record<string, any>;
}

export interface ClusteringModelResponse {
  id: number;
  dataset_id: number;
  user_id: number;
  name: string;
  k: number;
  feature_names: string[];
  use_cleaned: boolean;
  n_samples: number;
  inertia: number;
  silhouette_score?: number | null;
  cluster_centers: Record<string, number[]>;
  cluster_profiles: ClusterProfile[];
  evaluation_metrics?: {
    curve?: Array<{ k: number; inertia: number; silhouette_score?: number | null }>;
  } | null;
  sample_assignments?: ClusteringDataPoint[] | null;
  status: string;
  created_at: string;
}

export interface ClusteringModelSummary {
  id: number;
  name: string;
  k: number;
  feature_names: string[];
  n_samples: number;
  inertia: number;
  silhouette_score?: number | null;
  status: string;
  created_at: string;
}

// ==========================================
// Phase 6: Time Series Forecasting Types
// ==========================================

export interface ForecastingColumnInfo {
  name: string;
  data_type: string;
  non_null_count: number;
  sample_values: string[];
}

export interface ForecastingColumnsResponse {
  dataset_id: number;
  is_cleaned: boolean;
  total_rows: number;
  datetime_columns: ForecastingColumnInfo[];
  numeric_columns: ForecastingColumnInfo[];
  recommended_date_column?: string | null;
  recommended_target_column?: string | null;
}

export interface ForecastEvaluationRequest {
  date_column: string;
  target_column: string;
  horizon?: number;
  frequency?: string | null;
  use_cleaned?: boolean;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface ForecastBacktestPoint {
  timestamp: string;
  actual: number;
  predicted: number;
  error: number;
  lower_ci?: number | null;
  upper_ci?: number | null;
}

export interface ForecastEvaluationMetrics {
  mape: number;
  rmse: number;
  mae: number;
  r2?: number | null;
  directional_accuracy?: number | null;
  test_samples: number;
  train_samples: number;
}

export interface ForecastEvaluationResponse {
  date_column: string;
  target_column: string;
  horizon: number;
  frequency: string;
  total_observations: number;
  date_min: string;
  date_max: string;
  model_name: string;
  model_order: number[];
  metrics: ForecastEvaluationMetrics;
  backtest_points: ForecastBacktestPoint[];
}

export interface ForecastRunRequest {
  date_column: string;
  target_column: string;
  horizon?: number;
  frequency?: string | null;
  name?: string | null;
  use_cleaned?: boolean;
}

export interface FutureForecastPoint {
  timestamp: string;
  forecast: number;
  lower_ci: number;
  upper_ci: number;
}

export interface ForecastModelResponse {
  id: number;
  dataset_id: number;
  user_id: number;
  name: string;
  date_column: string;
  target_column: string;
  frequency: string;
  horizon: number;
  model_type: string;
  model_order: number[];
  aic?: number | null;
  bic?: number | null;
  metrics: ForecastEvaluationMetrics;
  historical_points: TimeSeriesPoint[];
  backtest_points?: ForecastBacktestPoint[] | null;
  forecast_points: FutureForecastPoint[];
  date_min: string;
  date_max: string;
  total_observations: number;
  use_cleaned: boolean;
  status: string;
  error_message?: string | null;
  created_at: string;
}

export interface ForecastModelSummary {
  id: number;
  name: string;
  date_column: string;
  target_column: string;
  frequency: string;
  horizon: number;
  model_type: string;
  mape: number;
  rmse: number;
  status: string;
  created_at: string;
}

// ==========================================
// Phase 7: Anomaly Detection Types
// ==========================================

export interface AnomalyFeatureInfo {
  name: string;
  data_type: string;
  non_null_count: number;
  missing_count: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  std?: number | null;
}

export interface AnomalyFeaturesResponse {
  dataset_id: number;
  is_cleaned: boolean;
  total_rows: number;
  numeric_features: AnomalyFeatureInfo[];
  recommended_features: string[];
}

export interface AnomalyDistributionBucket {
  bucket_min: number;
  bucket_max: number;
  label: string;
  count: number;
  anomaly_count: number;
}

export interface AnomalyEvaluationRequest {
  features: string[];
  contamination?: number;
  use_cleaned?: boolean;
}

export interface AnomalyEvaluationResponse {
  features: string[];
  n_samples: number;
  estimated_anomalies: number;
  estimated_percentage: number;
  threshold_score: number;
  score_min: number;
  score_max: number;
  score_mean: number;
  suggested_contamination: number;
  score_distribution: AnomalyDistributionBucket[];
}

export interface AnomalyRunRequest {
  features: string[];
  contamination?: number;
  name?: string | null;
  n_estimators?: number;
  use_cleaned?: boolean;
}

export interface FeatureDeviation {
  feature: string;
  value: number;
  inlier_mean: number;
  inlier_std: number;
  z_score: number;
  severity: 'high' | 'medium' | 'low';
}

export interface AnomalousRowDetail {
  index: number;
  score: number;
  normalized_score: number;
  severity: 'high' | 'medium' | 'low';
  feature_values: Record<string, any>;
  top_deviations: FeatureDeviation[];
}

export interface AnomalyScatterPoint {
  index: number;
  x: number;
  y: number;
  score: number;
  normalized_score: number;
  is_anomaly: boolean;
}

export interface AnomalyModelResponse {
  id: number;
  dataset_id: number;
  user_id: number;
  name: string;
  contamination: number;
  n_estimators: number;
  feature_names: string[];
  use_cleaned: boolean;
  n_samples: number;
  n_anomalies: number;
  anomaly_percentage: number;
  threshold_score: number;
  score_min: number;
  score_max: number;
  score_mean: number;
  summary_stats?: Record<string, any> | null;
  anomalous_rows?: AnomalousRowDetail[] | null;
  distribution_buckets?: AnomalyDistributionBucket[] | null;
  scatter_points?: AnomalyScatterPoint[] | null;
  status: string;
  created_at: string;
}

export interface AnomalyModelSummary {
  id: number;
  name: string;
  contamination: number;
  feature_names: string[];
  n_samples: number;
  n_anomalies: number;
  anomaly_percentage: number;
  status: string;
  created_at: string;
}




