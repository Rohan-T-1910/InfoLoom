import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForecastMetricsCard } from '../components/forecasting/ForecastMetricsCard';
import { ForecastChartCard } from '../components/forecasting/ForecastChartCard';
import { ForecastEvaluationCard } from '../components/forecasting/ForecastEvaluationCard';
import { ForecastingHistoryList } from '../components/forecasting/ForecastingHistoryList';
import {
  ForecastEvaluationResponse,
  ForecastModelResponse,
  ForecastModelSummary,
} from '../types';

// Mock react-chartjs-2 since canvas is not rendered in JSDOM
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart">Line Chart Mock</div>,
}));

describe('Phase 6 Forecasting Frontend Components', () => {
  const sampleEvaluation: ForecastEvaluationResponse = {
    date_column: 'date',
    target_column: 'revenue',
    horizon: 7,
    frequency: 'D',
    total_observations: 50,
    date_min: '2024-01-01T00:00:00',
    date_max: '2024-02-19T00:00:00',
    model_name: 'ARIMA(1, 1, 1)',
    model_order: [1, 1, 1],
    metrics: {
      mape: 8.45,
      rmse: 12.34,
      mae: 9.87,
      r2: 0.88,
      directional_accuracy: 85.7,
      train_samples: 43,
      test_samples: 7,
    },
    backtest_points: [
      {
        timestamp: '2024-02-13T00:00:00',
        actual: 150.0,
        predicted: 148.5,
        error: 1.5,
        lower_ci: 140.0,
        upper_ci: 157.0,
      },
      {
        timestamp: '2024-02-14T00:00:00',
        actual: 155.0,
        predicted: 153.2,
        error: 1.8,
        lower_ci: 144.0,
        upper_ci: 162.0,
      },
    ],
  };

  const sampleModel: ForecastModelResponse = {
    id: 1,
    dataset_id: 5,
    user_id: 1,
    name: 'Q1 Revenue Forecast',
    date_column: 'date',
    target_column: 'revenue',
    frequency: 'D',
    horizon: 7,
    model_type: 'ARIMA',
    model_order: [1, 1, 1],
    aic: 245.8,
    bic: 251.2,
    metrics: {
      mape: 8.45,
      rmse: 12.34,
      mae: 9.87,
      r2: 0.88,
      directional_accuracy: 85.7,
      train_samples: 43,
      test_samples: 7,
    },
    historical_points: [
      { timestamp: '2024-01-01T00:00:00', value: 100.0 },
      { timestamp: '2024-01-02T00:00:00', value: 105.0 },
      { timestamp: '2024-01-03T00:00:00', value: 110.0 },
    ],
    backtest_points: [
      {
        timestamp: '2024-02-13T00:00:00',
        actual: 150.0,
        predicted: 148.5,
        error: 1.5,
        lower_ci: 140.0,
        upper_ci: 157.0,
      },
    ],
    forecast_points: [
      {
        timestamp: '2024-02-20T00:00:00',
        forecast: 160.5,
        lower_ci: 149.2,
        upper_ci: 171.8,
      },
      {
        timestamp: '2024-02-21T00:00:00',
        forecast: 162.1,
        lower_ci: 148.0,
        upper_ci: 176.2,
      },
    ],
    date_min: '2024-01-01T00:00:00',
    date_max: '2024-02-19T00:00:00',
    total_observations: 50,
    use_cleaned: true,
    status: 'completed',
    created_at: '2024-02-20T10:00:00',
  };

  it('renders ForecastMetricsCard with MAPE and evaluation metrics', () => {
    render(
      <ForecastMetricsCard
        metrics={sampleModel.metrics}
        modelOrder={sampleModel.model_order}
        modelType={sampleModel.model_type}
        aic={sampleModel.aic}
        bic={sampleModel.bic}
        frequency={sampleModel.frequency}
        dateMin={sampleModel.date_min}
        dateMax={sampleModel.date_max}
        totalObservations={sampleModel.total_observations}
        horizon={sampleModel.horizon}
      />
    );

    // MAPE badge & value
    expect(screen.getByText('8.45%')).toBeInTheDocument();
    expect(screen.getByText('Excellent accuracy (<10%)')).toBeInTheDocument();

    // Directional trend
    expect(screen.getByText('85.7%')).toBeInTheDocument();

    // Model Architecture
    expect(screen.getByText(/ARIMA/)).toBeInTheDocument();
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });

  it('renders ForecastChartCard and toggles to tabular forecast view', () => {
    render(<ForecastChartCard model={sampleModel} />);

    expect(screen.getByText('Q1 Revenue Forecast')).toBeInTheDocument();
    expect(screen.getByTestId('mock-line-chart')).toBeInTheDocument();

    // Switch to table view
    const tableBtn = screen.getByText('Table View');
    fireEvent.click(tableBtn);

    // Table elements should now be visible
    expect(screen.getByText('160.5000')).toBeInTheDocument();
    expect(screen.getByText('149.2000')).toBeInTheDocument();
    expect(screen.getByText('171.8000')).toBeInTheDocument();
    expect(screen.getByText('t + 1')).toBeInTheDocument();
  });

  it('renders ForecastEvaluationCard and triggers onProceedToForecast', () => {
    const handleProceed = vi.fn();
    render(
      <ForecastEvaluationCard
        evaluation={sampleEvaluation}
        onProceedToForecast={handleProceed}
      />
    );

    expect(screen.getByText('Backtest Evaluation Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('8.45%')).toBeInTheDocument();
    expect(screen.getByText('Zero lookahead bias guaranteed')).toBeInTheDocument();

    const proceedBtn = screen.getByText('Train & Generate Forecast');
    fireEvent.click(proceedBtn);
    expect(handleProceed).toHaveBeenCalledTimes(1);
  });

  it('renders ForecastingHistoryList with model items and handles selection', () => {
    const summaries: ForecastModelSummary[] = [
      {
        id: 1,
        name: 'Q1 Revenue Forecast',
        date_column: 'date',
        target_column: 'revenue',
        frequency: 'D',
        horizon: 7,
        model_type: 'ARIMA',
        mape: 8.45,
        rmse: 12.34,
        status: 'completed',
        created_at: '2024-02-20T10:00:00',
      },
    ];

    const handleSelect = vi.fn();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ForecastingHistoryList
          models={summaries}
          selectedModelId={null}
          onSelectModel={handleSelect}
          datasetId={5}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Forecasting Model History')).toBeInTheDocument();
    expect(screen.getByText('Q1 Revenue Forecast')).toBeInTheDocument();
    expect(screen.getByText('+7 steps')).toBeInTheDocument();

    const viewBtn = screen.getByText('View');
    fireEvent.click(viewBtn);
    expect(handleSelect).toHaveBeenCalledWith(1);
  });

  it('renders empty state in ForecastingHistoryList when no models exist', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ForecastingHistoryList
          models={[]}
          selectedModelId={null}
          onSelectModel={vi.fn()}
          datasetId={5}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('No Forecast Models Yet')).toBeInTheDocument();
  });
});
