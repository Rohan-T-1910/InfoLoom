import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MLLeaderboard } from '../components/ml/MLLeaderboard';
import { MLJobStatusCard } from '../components/ml/MLJobStatusCard';
import { MLModelLeaderboardItem, MLJob } from '../types';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe('Customer-Oriented Predictive Modeling Frontend Components', () => {
  const sampleModels: MLModelLeaderboardItem[] = [
    {
      id: 1,
      algorithm: 'random_forest',
      algorithm_name: 'Random Forest Regressor',
      task_type: 'regression',
      test_metrics: {
        rmse: 1420.5,
        mae: 1100.2,
        r2: 0.8842,
      },
      cv_mean: 0.865,
      cv_std: 0.021,
      primary_metric_name: 'r2',
      primary_metric_value: 0.8842,
      status: 'completed',
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      algorithm: 'linear_regression',
      algorithm_name: 'Linear Regression',
      task_type: 'regression',
      test_metrics: {
        rmse: 2150.0,
        mae: 1800.0,
        r2: 0.7215,
      },
      cv_mean: 0.71,
      cv_std: 0.035,
      primary_metric_name: 'r2',
      primary_metric_value: 0.7215,
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  it('renders model comparison leaderboard with metrics, ranks, and top performer highlights', () => {
    const onSelect = vi.fn();
    const onPredict = vi.fn();

    render(
      <MLLeaderboard
        models={sampleModels}
        bestModelId={1}
        selectedModelId={1}
        onSelectModel={onSelect}
        onPredictWithModel={onPredict}
      />
    );

    expect(screen.getByText('Model Comparison Leaderboard')).toBeInTheDocument();
    expect(screen.getAllByText('Random Forest Regressor').length).toBeGreaterThan(0);
    expect(screen.getByText('Linear Regression')).toBeInTheDocument();
    expect(screen.getByText('0.8842')).toBeInTheDocument();
    expect(screen.getByText('1420.5000')).toBeInTheDocument();
    expect(screen.getByText('1100.2000')).toBeInTheDocument();

    // Verify inspect and predict actions
    const predictButtons = screen.getAllByRole('button', { name: /predict/i });
    expect(predictButtons.length).toBeGreaterThan(0);
    fireEvent.click(predictButtons[1]); // Row predict button
    expect(onPredict).toHaveBeenCalled();
  });

  it('renders empty leaderboard state gracefully with user-oriented action guidance', () => {
    render(
      <MLLeaderboard
        models={[]}
        onSelectModel={vi.fn()}
        onPredictWithModel={vi.fn()}
      />
    );

    expect(screen.getByText('No Models Trained Yet')).toBeInTheDocument();
    expect(
      screen.getByText(/click "Train & Compare Models"/i)
    ).toBeInTheDocument();
  });

  it('renders classification leaderboard with accuracy, F1, and ROC-AUC', () => {
    const clfModels: MLModelLeaderboardItem[] = [
      {
        id: 10,
        algorithm: 'xgboost',
        algorithm_name: 'XGBoost Classifier',
        task_type: 'classification',
        test_metrics: {
          accuracy: 0.94,
          precision: 0.92,
          recall: 0.95,
          f1: 0.9348,
          roc_auc: 0.978,
        },
        cv_mean: 0.921,
        cv_std: 0.015,
        primary_metric_name: 'f1',
        primary_metric_value: 0.9348,
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ];

    render(
      <MLLeaderboard
        models={clfModels}
        bestModelId={10}
        onSelectModel={vi.fn()}
        onPredictWithModel={vi.fn()}
      />
    );

    expect(screen.getAllByText('XGBoost Classifier').length).toBeGreaterThan(0);
    expect(screen.getByText('94.0%')).toBeInTheDocument();
    expect(screen.getByText('0.9348')).toBeInTheDocument();
    expect(screen.getByText('0.9780')).toBeInTheDocument();
  });

  it('renders MLJobStatusCard in loading state with user-friendly text and progress', async () => {
    const queryClient = createTestQueryClient();
    const { api } = await import('../services/api');
    const runningJob: MLJob = {
      id: 99,
      dataset_id: 1,
      user_id: 1,
      target_column: 'Total Amount',
      task_type: 'regression',
      feature_columns: ['Quantity', 'Price per Unit', 'Age'],
      test_size: 0.2,
      use_cleaned: false,
      status: 'running',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(api, 'getJob').mockResolvedValue(runningJob);

    render(
      <QueryClientProvider client={queryClient}>
        <MLJobStatusCard jobId={99} />
      </QueryClientProvider>
    );

    const matches = await screen.findAllByText('Training and comparing models...');
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText('Total Amount')).toBeInTheDocument();
  });

  it('renders MLJobStatusCard in failure state with user-facing friendly message, not leaking stack traces', async () => {
    const queryClient = createTestQueryClient();
    const { api } = await import('../services/api');
    const failedJob: MLJob = {
      id: 100,
      dataset_id: 1,
      user_id: 1,
      target_column: 'Invalid_Target',
      task_type: 'classification',
      feature_columns: ['Feature1'],
      test_size: 0.2,
      use_cleaned: false,
      status: 'failed',
      error_message: 'Traceback (most recent call last):\n  File "train.py", line 42, in train\nValueError: Internal math explosion',
      created_at: new Date().toISOString(),
    };
    vi.spyOn(api, 'getJob').mockResolvedValue(failedJob);

    render(
      <QueryClientProvider client={queryClient}>
        <MLJobStatusCard jobId={100} />
      </QueryClientProvider>
    );


    // Must show friendly message
    expect(await screen.findByText('Prediction Analysis Incomplete')).toBeInTheDocument();
    expect(
      screen.getByText(/We couldn't complete the prediction analysis/i)
    ).toBeInTheDocument();
    // Must NOT display technical stack trace to user
    expect(screen.queryByText(/Traceback/i)).toBeNull();
    expect(screen.queryByText(/Internal math explosion/i)).toBeNull();
  });

  it('renders MLModelDetailsCard without crashing when backend returns feature_names without features_numeric or features_categorical', async () => {
    const queryClient = createTestQueryClient();
    const { api } = await import('../services/api');
    vi.spyOn(api, 'getModel').mockResolvedValueOnce({
      id: 5,
      job_id: 1,
      dataset_id: 1,
      name: 'Random Forest Regressor',
      algorithm: 'random_forest',
      task_type: 'regression',
      target_column: 'Total Amount',
      feature_names: ['Age', 'Quantity', 'Price per Unit'],
      features_numeric: undefined as any,
      features_categorical: undefined as any,
      metrics: {
        r2: 0.891,
        rmse: 120.5,
        mae: 85.2,
        primary_metric: 0.891,
      },
      status: 'completed',
      created_at: new Date().toISOString(),
    });

    const { MLModelDetailsCard } = await import('../components/ml/MLModelDetailsCard');

    render(
      <QueryClientProvider client={queryClient}>
        <MLModelDetailsCard modelId={5} />
      </QueryClientProvider>
    );

    // Wait for data load
    expect(await screen.findByText('Random Forest Regressor')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Price per Unit')).toBeInTheDocument();
    expect(screen.getByText('0.8910')).toBeInTheDocument();
  });

  it('renders MLPredictionCard and performs inference without crashing when features_numeric is undefined', async () => {
    const queryClient = createTestQueryClient();
    const { api } = await import('../services/api');
    vi.spyOn(api, 'getModel').mockResolvedValue({
      id: 5,
      job_id: 1,
      dataset_id: 1,
      name: 'Random Forest Regressor',
      algorithm: 'random_forest',
      task_type: 'regression' as const,
      target_column: 'Total Amount',
      feature_names: ['Age', 'Quantity', 'Price per Unit'],
      features_numeric: undefined as any,
      features_categorical: undefined as any,
      metrics: { r2: 0.89 },
      status: 'completed' as const,
      created_at: new Date().toISOString(),
    });
    vi.spyOn(api, 'predict').mockResolvedValueOnce({
      model_id: 5,
      model_name: 'Random Forest Regressor',
      task_type: 'regression',
      predictions: [450.5],
      probabilities: null,
      feature_names: ['Age', 'Quantity', 'Price per Unit'],
    });

    const { MLPredictionCard } = await import('../components/ml/MLPredictionCard');

    render(
      <QueryClientProvider client={queryClient}>

        <MLPredictionCard modelId={5} />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Make Predictions on New Data')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Price per Unit')).toBeInTheDocument();

    // Trigger calculate prediction
    const submitBtn = screen.getByRole('button', { name: /Generate Prediction/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Predicted Outcome:')).toBeInTheDocument();
    expect(screen.getByText('450.5')).toBeInTheDocument();
  });
});




