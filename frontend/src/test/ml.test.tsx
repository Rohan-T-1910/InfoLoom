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

describe('Phase 4 ML Frontend Components', () => {
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

  it('renders model comparison leaderboard with metrics and ranks', () => {
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
    expect(screen.getByText('Random Forest Regressor')).toBeInTheDocument();
    expect(screen.getByText('Linear Regression')).toBeInTheDocument();
    expect(screen.getByText('0.8842')).toBeInTheDocument();
    expect(screen.getByText('1420.5000')).toBeInTheDocument();
    expect(screen.getByText('1100.2000')).toBeInTheDocument();

    // Verify inspect and predict actions
    const predictButtons = screen.getAllByRole('button', { name: /predict/i });
    expect(predictButtons.length).toBe(2);
    fireEvent.click(predictButtons[0]);
    expect(onPredict).toHaveBeenCalledWith(sampleModels[0]);
  });

  it('renders empty leaderboard state gracefully when no models trained', () => {
    render(
      <MLLeaderboard
        models={[]}
        onSelectModel={vi.fn()}
        onPredictWithModel={vi.fn()}
      />
    );

    expect(screen.getByText('No Models Trained Yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Configure a target column above and click "Train & Benchmark Models"/i)
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

    expect(screen.getByText('XGBoost Classifier')).toBeInTheDocument();
    expect(screen.getByText('94.0%')).toBeInTheDocument();
    expect(screen.getByText('0.9348')).toBeInTheDocument();
    expect(screen.getByText('0.9780')).toBeInTheDocument();
  });
});
