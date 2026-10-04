import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ModelRegistryPage } from '../pages/ModelRegistryPage';
import { api } from '../services/api';
import {
  DatasetListResponse,
  RegisteredModelListResponse,
  RegisteredModelResponse,
  MLModelLeaderboardItem,
  MLPredictResponse,
} from '../types';

vi.mock('../services/api', () => ({
  api: {
    listDatasets: vi.fn(),
    listRegisteredModels: vi.fn(),
    listDatasetModels: vi.fn(),
    registerModel: vi.fn(),
    activateModelVersion: vi.fn(),
    rollbackModelVersion: vi.fn(),
    deleteModelVersion: vi.fn(),
    predictWithRegisteredModel: vi.fn(),
    getActiveModel: vi.fn(),
  },
}));

describe('Phase 10 Model Registry & Management Page', () => {
  let queryClient: QueryClient;

  const mockDatasets: DatasetListResponse = {
    items: [
      {
        id: 1,
        user_id: 1,
        filename: 'sales_q4.csv',
        original_filename: 'sales_q4.csv',
        file_path: '/path/sales_q4.csv',
        file_size_bytes: 4096,
        row_count: 500,
        column_count: 6,
        status: 'completed',
        has_cleaned: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
    ],
    total: 1,
  };

  const mockRegisteredModels: RegisteredModelListResponse = {
    items: [
      {
        id: 10,
        name: 'revenue-predictor',
        version: 2,
        description: 'Production Random Forest Regressor',
        user_id: 1,
        dataset_id: 1,
        dataset_name: 'sales_q4.csv',
        source_model_id: 101,
        algorithm: 'random_forest',
        task_type: 'regression',
        target_column: 'sales',
        feature_names: ['marketing_spend', 'visitors'],
        metrics: { r2: 0.885, rmse: 12.45, primary_metric: 0.885 },
        training_parameters: { n_estimators: 100 },
        artifact_path: '/storage/registry_revenue-predictor_v2.joblib',
        artifact_size_bytes: 45200,
        has_artifact: true,
        status: 'ready',
        is_active: true,
        activated_at: '2023-10-01T12:00:00Z',
        created_at: '2023-10-01T12:00:00Z',
        updated_at: '2023-10-01T12:00:00Z',
      },
      {
        id: 9,
        name: 'revenue-predictor',
        version: 1,
        description: 'Baseline Linear Model',
        user_id: 1,
        dataset_id: 1,
        dataset_name: 'sales_q4.csv',
        source_model_id: 100,
        algorithm: 'linear_regression',
        task_type: 'regression',
        target_column: 'sales',
        feature_names: ['marketing_spend', 'visitors'],
        metrics: { r2: 0.725, rmse: 18.2, primary_metric: 0.725 },
        training_parameters: {},
        artifact_path: '/storage/registry_revenue-predictor_v1.joblib',
        artifact_size_bytes: 12400,
        has_artifact: true,
        status: 'ready',
        is_active: false,
        activated_at: null,
        created_at: '2023-09-28T10:00:00Z',
        updated_at: '2023-09-28T10:00:00Z',
      },
    ],
    total: 2,
  };

  const mockTrainedModels: MLModelLeaderboardItem[] = [
    {
      id: 101,
      name: 'Random Forest Regressor',
      algorithm: 'random_forest',
      task_type: 'regression',
      primary_metric_name: 'R²',
      primary_metric_value: 0.885,
      is_best: true,
      created_at: '2023-10-01T10:00:00Z',
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();

    vi.mocked(api.listDatasets).mockResolvedValue(mockDatasets);
    vi.mocked(api.listRegisteredModels).mockResolvedValue(mockRegisteredModels);
    vi.mocked(api.listDatasetModels).mockResolvedValue(mockTrainedModels);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/registry']}>
          <ModelRegistryPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders header, active model spotlight, and model version cards', async () => {
    renderComponent();

    // Verify Title
    expect(screen.getByText('Model Management')).toBeInTheDocument();

    // Verify Active Spotlight
    expect(await screen.findByText('ACTIVE PRODUCTION MODEL')).toBeInTheDocument();
    expect(screen.getAllByText('revenue-predictor').length).toBeGreaterThanOrEqual(1);

    // Verify Version Badges
    expect(screen.getAllByText('v2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('v1')).toBeInTheDocument();

    // Verify Metrics
    expect(screen.getByText('0.8850')).toBeInTheDocument();
  });

  it('triggers model activation when activate button is clicked', async () => {
    const updatedV1: RegisteredModelResponse = {
      ...mockRegisteredModels.items[1],
      is_active: true,
      activated_at: '2023-10-02T00:00:00Z',
    };
    vi.mocked(api.activateModelVersion).mockResolvedValue(updatedV1);

    renderComponent();

    // Find the Activate button on the standby model (v1)
    const activateBtn = await screen.findByRole('button', { name: /activate/i });
    fireEvent.click(activateBtn);

    await waitFor(() => {
      expect(api.activateModelVersion).toHaveBeenCalledWith(9);
    });
  });

  it('opens rollback confirmation modal and confirms rollback', async () => {
    const rolledBackModel: RegisteredModelResponse = {
      ...mockRegisteredModels.items[1],
      is_active: true,
    };
    vi.mocked(api.rollbackModelVersion).mockResolvedValue(rolledBackModel);

    renderComponent();

    // Find rollback button on v2 (active version)
    const rollbackBtn = await screen.findByRole('button', { name: /rollback/i });
    fireEvent.click(rollbackBtn);

    // Modal appears
    expect(await screen.findByText(/Confirm Model Rollback/i)).toBeInTheDocument();

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm rollback/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(api.rollbackModelVersion).toHaveBeenCalledWith(10);
    });
  });

  it('opens delete confirmation modal and executes deletion', async () => {
    vi.mocked(api.deleteModelVersion).mockResolvedValue({
      message: "Model 'revenue-predictor' version 1 and associated artifacts safely deleted.",
      deleted_id: 9,
      name: 'revenue-predictor',
      version: 1,
    });

    renderComponent();

    // Find trash button for v1
    const deleteButtons = await screen.findAllByTitle(/delete model version/i);
    fireEvent.click(deleteButtons[1]); // v1 delete

    expect(await screen.findByText(/Delete Model Version/i)).toBeInTheDocument();

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete version/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(api.deleteModelVersion).toHaveBeenCalledWith(9);
    });
  });

  it('opens test inference modal and executes prediction', async () => {
    const mockPrediction: MLPredictResponse = {
      model_id: 10,
      model_name: 'revenue-predictor (v2)',
      task_type: 'regression',
      predictions: [142.5],
      probabilities: null,
      feature_names: ['marketing_spend', 'visitors'],
    };
    vi.mocked(api.predictWithRegisteredModel).mockResolvedValue(mockPrediction);

    renderComponent();

    // Click Test Live Inference on active spotlight
    const testBtn = await screen.findByRole('button', { name: /test live inference/i });
    fireEvent.click(testBtn);

    // Modal opens
    expect(await screen.findByText(/Live Inference: revenue-predictor \(v2\)/i)).toBeInTheDocument();

    // Execute prediction
    const executeBtn = screen.getByRole('button', { name: /execute prediction/i });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(api.predictWithRegisteredModel).toHaveBeenCalledWith(10, {
        marketing_spend: 0,
        visitors: 0,
      });
      expect(screen.getByText('142.5')).toBeInTheDocument();
    });
  });

  it('opens register modal and registers a new model version', async () => {
    const newRegisteredModel: RegisteredModelResponse = {
      ...mockRegisteredModels.items[0],
      id: 11,
      version: 3,
      description: 'Retrained XGBoost version',
    };
    vi.mocked(api.registerModel).mockResolvedValue(newRegisteredModel);

    renderComponent();

    const registerNavBtn = screen.getByRole('button', { name: /register new model/i });
    fireEvent.click(registerNavBtn);

    // Check modal opens
    expect(await screen.findByText('Register Model Version')).toBeInTheDocument();

    // Select the trained model
    const trainedModelCard = await screen.findByText('Random Forest Regressor');
    fireEvent.click(trainedModelCard);

    // Click register
    const submitBtn = screen.getByRole('button', { name: /register version/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.registerModel).toHaveBeenCalled();
    });
  });
});
