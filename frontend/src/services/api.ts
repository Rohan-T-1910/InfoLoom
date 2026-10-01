import {
  CleaningReportResponse,
  CorrelationMatrixResponse,
  Dataset,
  DatasetListResponse,
  DatasetPreviewResponse,
  EDAResponse,
  FeatureImportanceResponse,
  MLJob,
  MLModelDetail,
  MLModelLeaderboardItem,
  MLPredictResponse,
  MLTargetInspectionResponse,
  MLTrainRequest,
  ClusteringFeaturesResponse,
  ClusteringEvaluationRequest,
  ClusteringEvaluationResponse,
  ClusteringRunRequest,
  ClusteringModelResponse,
  ClusteringModelSummary,
  User,
} from '../types';

const API_BASE = '/api/v1';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('infoloom_token');
  }

  private setToken(token: string | null): void {
    if (token) {
      localStorage.setItem('infoloom_token', token);
    } else {
      localStorage.removeItem('infoloom_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errJson = await response.json();
        errorMessage = errJson.detail || errJson.message || JSON.stringify(errJson);
      } catch {
        errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  // --- Auth ---
  async login(formData: FormData): Promise<{ access_token: string; token_type: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Invalid email or password');
    }
    const data = await res.json();
    this.setToken(data.access_token);
    return data;
  }

  async register(payload: { email: string; password: string; name: string }): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  logout(): void {
    this.setToken(null);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  // --- Datasets ---
  async listDatasets(skip = 0, limit = 50): Promise<DatasetListResponse> {
    return this.request<DatasetListResponse>(`/datasets?skip=${skip}&limit=${limit}`);
  }

  async getDataset(id: number): Promise<Dataset> {
    return this.request<Dataset>(`/datasets/${id}`);
  }

  async uploadDataset(file: File): Promise<Dataset> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<Dataset>('/datasets/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteDataset(id: number): Promise<void> {
    return this.request<void>(`/datasets/${id}`, {
      method: 'DELETE',
    });
  }

  async getPreview(id: number, limit = 10): Promise<DatasetPreviewResponse> {
    return this.request<DatasetPreviewResponse>(`/datasets/${id}/preview?limit=${limit}`);
  }

  async getCleanedPreview(id: number, limit = 10): Promise<DatasetPreviewResponse> {
    return this.request<DatasetPreviewResponse>(`/datasets/${id}/cleaned-preview?limit=${limit}`);
  }

  async validateDataset(id: number): Promise<any> {
    return this.request<any>(`/datasets/${id}/validate`, {
      method: 'POST',
    });
  }

  async cleanDataset(id: number, config?: any): Promise<CleaningReportResponse> {
    return this.request<CleaningReportResponse>(`/datasets/${id}/clean`, {
      method: 'POST',
      body: config ? JSON.stringify(config) : undefined,
    });
  }

  async getCleaningReport(id: number): Promise<CleaningReportResponse> {
    return this.request<CleaningReportResponse>(`/datasets/${id}/cleaning-report`);
  }

  // --- EDA ---
  async getEDA(
    datasetId: number,
    params?: { target_column?: string | null; use_cleaned?: boolean; force_refresh?: boolean }
  ): Promise<EDAResponse> {
    const searchParams = new URLSearchParams();
    if (params?.target_column) searchParams.set('target_column', params.target_column);
    if (params?.use_cleaned !== undefined) searchParams.set('use_cleaned', String(params.use_cleaned));
    if (params?.force_refresh !== undefined) searchParams.set('force_refresh', String(params.force_refresh));

    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.request<EDAResponse>(`/datasets/${datasetId}/eda${qs}`);
  }

  async refreshEDA(
    datasetId: number,
    config?: { target_column?: string | null; use_cleaned?: boolean }
  ): Promise<EDAResponse> {
    return this.request<EDAResponse>(`/datasets/${datasetId}/eda/refresh`, {
      method: 'POST',
      body: JSON.stringify(config || {}),
    });
  }

  async getCorrelations(datasetId: number, useCleaned = true): Promise<CorrelationMatrixResponse> {
    return this.request<CorrelationMatrixResponse>(
      `/datasets/${datasetId}/eda/correlations?use_cleaned=${useCleaned}`
    );
  }

  async getFeatureImportance(
    datasetId: number,
    targetColumn?: string | null,
    useCleaned = true
  ): Promise<FeatureImportanceResponse | null> {
    const qs = targetColumn ? `?target_column=${encodeURIComponent(targetColumn)}&use_cleaned=${useCleaned}` : `?use_cleaned=${useCleaned}`;
    return this.request<FeatureImportanceResponse | null>(
      `/datasets/${datasetId}/eda/feature-importance${qs}`
    );
  }

  // --- Phase 4: Machine Learning ---
  async inspectTarget(datasetId: number, targetColumn: string): Promise<MLTargetInspectionResponse> {
    return this.request<MLTargetInspectionResponse>(
      `/datasets/${datasetId}/train/inspect-target?target_column=${encodeURIComponent(targetColumn)}`
    );
  }

  async trainModels(datasetId: number, payload: MLTrainRequest): Promise<MLJob> {
    return this.request<MLJob>(`/datasets/${datasetId}/train`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listDatasetJobs(datasetId: number, limit = 20): Promise<MLJob[]> {
    return this.request<MLJob[]>(`/datasets/${datasetId}/jobs?limit=${limit}`);
  }

  async listDatasetModels(datasetId: number, limit = 50): Promise<MLModelLeaderboardItem[]> {
    return this.request<MLModelLeaderboardItem[]>(`/datasets/${datasetId}/models?limit=${limit}`);
  }

  async getJob(jobId: number): Promise<MLJob> {
    return this.request<MLJob>(`/ml/jobs/${jobId}`);
  }

  async getModel(modelId: number): Promise<MLModelDetail> {
    return this.request<MLModelDetail>(`/ml/models/${modelId}`);
  }

  async predict(modelId: number, inputs: Record<string, any>[]): Promise<MLPredictResponse> {
    return this.request<MLPredictResponse>(`/ml/models/${modelId}/predict`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    });
  }

  // --- Phase 5: Clustering & Customer Segmentation ---
  async getClusteringFeatures(datasetId: number, useCleaned = true): Promise<ClusteringFeaturesResponse> {
    return this.request<ClusteringFeaturesResponse>(
      `/datasets/${datasetId}/clustering/features?use_cleaned=${useCleaned}`
    );
  }

  async evaluateClustering(
    datasetId: number,
    payload: ClusteringEvaluationRequest
  ): Promise<ClusteringEvaluationResponse> {
    return this.request<ClusteringEvaluationResponse>(`/datasets/${datasetId}/clustering/evaluate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async runClustering(
    datasetId: number,
    payload: ClusteringRunRequest
  ): Promise<ClusteringModelResponse> {
    return this.request<ClusteringModelResponse>(`/datasets/${datasetId}/clustering/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async listDatasetClusteringModels(datasetId: number): Promise<ClusteringModelSummary[]> {
    return this.request<ClusteringModelSummary[]>(`/datasets/${datasetId}/clustering/results`);
  }

  async getClusteringModel(modelId: number): Promise<ClusteringModelResponse> {
    return this.request<ClusteringModelResponse>(`/clustering/models/${modelId}`);
  }

  async deleteClusteringModel(modelId: number): Promise<void> {
    return this.request<void>(`/clustering/models/${modelId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
