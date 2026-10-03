import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnomalyMetricsCard } from '../components/anomaly/AnomalyMetricsCard';
import { AnomalyScatterPlot } from '../components/anomaly/AnomalyScatterPlot';
import { AnomalyDistributionChart } from '../components/anomaly/AnomalyDistributionChart';
import { AnomalousRowsTable } from '../components/anomaly/AnomalousRowsTable';
import { AnomalyHistoryList } from '../components/anomaly/AnomalyHistoryList';
import {
  AnomalyModelResponse,
  AnomalyModelSummary,
  AnomalousRowDetail,
  AnomalyScatterPoint,
  AnomalyDistributionBucket,
} from '../types';

// Mock Chart.js component since canvas is not rendered in JSDOM
vi.mock('react-chartjs-2', () => ({
  Scatter: () => <div data-testid="mock-scatter-chart">Scatter Chart</div>,
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
}));

describe('Phase 7 Anomaly Detection Frontend Components', () => {
  const sampleHistogram: AnomalyDistributionBucket[] = [
    { bucket_min: -0.25, bucket_max: -0.15, label: '-0.25 to -0.15', count: 5, anomaly_count: 5 },
    { bucket_min: -0.15, bucket_max: -0.05, label: '-0.15 to -0.05', count: 15, anomaly_count: 15 },
    { bucket_min: -0.05, bucket_max: 0.05, label: '-0.05 to 0.05', count: 60, anomaly_count: 5 },
    { bucket_min: 0.05, bucket_max: 0.15, label: '0.05 to 0.15', count: 120, anomaly_count: 0 },
  ];

  const sampleScatterPoints: AnomalyScatterPoint[] = [
    { index: 0, x: 0.5, y: -0.2, score: 0.12, normalized_score: 0.15, is_anomaly: false },
    { index: 1, x: 4.8, y: 5.2, score: -0.22, normalized_score: 0.95, is_anomaly: true },
    { index: 2, x: -0.3, y: 0.1, score: 0.08, normalized_score: 0.22, is_anomaly: false },
  ];

  const sampleAnomalies: AnomalousRowDetail[] = [
    {
      index: 42,
      score: -0.254,
      normalized_score: 0.985,
      severity: 'high',
      feature_values: { amount: 95000, age: 89, frequency: 1 },
      top_deviations: [
        { feature: 'amount', value: 95000, inlier_mean: 1200, inlier_std: 450, z_score: 208.4, severity: 'high' },
        { feature: 'age', value: 89, inlier_mean: 38, inlier_std: 12, z_score: 4.25, severity: 'medium' },
        { feature: 'frequency', value: 1, inlier_mean: 15, inlier_std: 5, z_score: -2.8, severity: 'low' },
      ],
    },
    {
      index: 107,
      score: -0.198,
      normalized_score: 0.882,
      severity: 'medium',
      feature_values: { amount: 45000, age: 22, frequency: 95 },
      top_deviations: [
        { feature: 'amount', value: 45000, inlier_mean: 1200, inlier_std: 450, z_score: 97.3, severity: 'high' },
        { feature: 'frequency', value: 95, inlier_mean: 15, inlier_std: 5, z_score: 16.0, severity: 'medium' },
      ],
    },
  ];

  const sampleModel: AnomalyModelResponse = {
    id: 1,
    dataset_id: 10,
    user_id: 1,
    name: 'Q4 Isolation Forest (5% Contamination)',
    feature_names: ['amount', 'age', 'frequency'],
    contamination: 0.05,
    n_estimators: 100,
    use_cleaned: true,
    n_samples: 1000,
    n_anomalies: 50,
    anomaly_percentage: 5.0,
    threshold_score: -0.045,
    score_min: -0.28,
    score_max: 0.18,
    score_mean: 0.065,
    distribution_buckets: sampleHistogram,
    scatter_points: sampleScatterPoints,
    anomalous_rows: sampleAnomalies,
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  const sampleSummaries: AnomalyModelSummary[] = [
    {
      id: 1,
      name: 'Q4 Isolation Forest (5% Contamination)',
      contamination: 0.05,
      feature_names: ['amount', 'age', 'frequency'],
      n_samples: 1000,
      n_anomalies: 50,
      anomaly_percentage: 5.0,
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  it('renders anomaly KPI metrics cards accurately', () => {
    render(<AnomalyMetricsCard model={sampleModel} />);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText(/1000 rows/i)).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('-0.0450')).toBeInTheDocument();
    expect(screen.getByText(/\[-0.280, 0.180\]/)).toBeInTheDocument();
  });

  it('renders anomaly distribution chart with histogram and threshold', () => {
    render(
      <AnomalyDistributionChart
        buckets={sampleHistogram}
        thresholdScore={-0.045}
      />
    );

    expect(screen.getByTestId('mock-bar-chart')).toBeInTheDocument();
    expect(screen.getByText(/Anomaly Score Distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/-0.045/i)).toBeInTheDocument();
  });

  it('renders 2D anomaly scatter plot with coordinates and legend', () => {
    render(
      <AnomalyScatterPlot
        points={sampleScatterPoints}
        featureNames={sampleModel.feature_names}
      />
    );

    expect(screen.getByTestId('mock-scatter-chart')).toBeInTheDocument();
    expect(screen.getByText(/2D Outlier Feature Space Projection/i)).toBeInTheDocument();
    expect(screen.getByText(/Anomaly \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Inlier \(2\)/i)).toBeInTheDocument();
  });

  it('renders anomalous rows table and expands root-cause feature deviations', () => {
    render(
      <AnomalousRowsTable
        rows={sampleAnomalies}
        modelName="transactions.csv"
      />
    );

    expect(screen.getByText(/Flagged Anomalous Records \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('#107')).toBeInTheDocument();
    expect(screen.getByText('98.5%')).toBeInTheDocument();

    // Expand row #42 by clicking the row
    fireEvent.click(screen.getByText('#42'));
    expect(screen.getByText(/Full Deviation Analysis for Row #42/i)).toBeInTheDocument();
    expect(screen.getByText(/\+208.40σ/i)).toBeInTheDocument();
  });

  it('renders empty history list and active history list', () => {
    const queryClient = new QueryClient();
    const onSelect = vi.fn();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AnomalyHistoryList
          models={[]}
          onSelectModel={onSelect}
          datasetId={10}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText(/No Anomaly Detection Runs Yet/i)).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <AnomalyHistoryList
          models={sampleSummaries}
          selectedModelId={1}
          onSelectModel={onSelect}
          datasetId={10}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Q4 Isolation Forest (5% Contamination)')).toBeInTheDocument();
    expect(screen.getByText('Viewing')).toBeInTheDocument();
  });
});
