import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClusteringEvaluationCard } from '../components/clustering/ClusteringEvaluationCard';
import { ClusterDistributionCard } from '../components/clustering/ClusterDistributionCard';
import { ClusterProfilesCard } from '../components/clustering/ClusterProfilesCard';
import { ClusteringHistoryList } from '../components/clustering/ClusteringHistoryList';
import {
  ClusteringEvaluationResponse,
  ClusteringModelResponse,
  ClusteringModelSummary,
} from '../types';

// Mock Chart.js component since canvas is not rendered in JSDOM
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
  Scatter: () => <div data-testid="mock-scatter-chart">Scatter Chart</div>,
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
}));

describe('Phase 5 Clustering Frontend Components', () => {
  const sampleEvaluation: ClusteringEvaluationResponse = {
    features: ['annual_income', 'spending_score'],
    n_samples: 200,
    k_metrics: [
      { k: 2, inertia: 180000.5, silhouette_score: 0.45 },
      { k: 3, inertia: 105000.2, silhouette_score: 0.62 },
      { k: 4, inertia: 75000.0, silhouette_score: 0.55 },
      { k: 5, inertia: 45000.0, silhouette_score: 0.58 },
    ],
    suggested_k: 3,
    suggestion_reason: 'K=3 achieves the highest silhouette score (0.6200), indicating well-separated clusters.',
  };

  const sampleModel: ClusteringModelResponse = {
    id: 1,
    dataset_id: 10,
    user_id: 1,
    name: 'Customer Segmentation (Income vs Spend)',
    k: 3,
    feature_names: ['annual_income', 'spending_score'],
    use_cleaned: true,
    n_samples: 200,
    inertia: 105000.2,
    silhouette_score: 0.62,
    cluster_centers: {
      annual_income: [25000, 55000, 85000],
      spending_score: [75, 45, 80],
    },
    cluster_profiles: [
      {
        cluster_id: 0,
        name: 'Cluster 0 (High Spend, Low Income)',
        size: 50,
        percentage: 25.0,
        stats: [
          { feature: 'annual_income', mean: 25000, median: 24000, std: 3000, min: 15000, max: 35000 },
          { feature: 'spending_score', mean: 75, median: 78, std: 10, min: 60, max: 98 },
        ],
      },
      {
        cluster_id: 1,
        name: 'Cluster 1 (Moderate Income & Spend)',
        size: 90,
        percentage: 45.0,
        stats: [
          { feature: 'annual_income', mean: 55000, median: 54000, std: 5000, min: 40000, max: 70000 },
          { feature: 'spending_score', mean: 45, median: 48, std: 8, min: 30, max: 60 },
        ],
      },
      {
        cluster_id: 2,
        name: 'Cluster 2 (High Income, High Spend)',
        size: 60,
        percentage: 30.0,
        stats: [
          { feature: 'annual_income', mean: 85000, median: 84000, std: 6000, min: 72000, max: 120000 },
          { feature: 'spending_score', mean: 80, median: 82, std: 9, min: 65, max: 99 },
        ],
      },
    ],
    sample_assignments: [
      { index: 0, cluster: 0, x: 25000, y: 75, features: { annual_income: 25000, spending_score: 75 } },
      { index: 1, cluster: 1, x: 55000, y: 45, features: { annual_income: 55000, spending_score: 45 } },
    ],
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  it('renders K selection diagnostics with natural-language recommendations', () => {
    const onApply = vi.fn();
    render(
      <ClusteringEvaluationCard
        evaluation={sampleEvaluation}
        currentK={2}
        onApplyK={onApply}
      />
    );

    expect(screen.getByText('Group Count Recommendation')).toBeInTheDocument();
    expect(screen.getByText(/Recommended: 3 Groups/i)).toBeInTheDocument();
    expect(screen.getByText(/clearest contrast between segments/i)).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /Use 3 Groups/i });
    expect(applyButton).toBeInTheDocument();
    fireEvent.click(applyButton);
    expect(onApply).toHaveBeenCalledWith(3);
  });

  it('renders cluster distribution card with proportional segment metrics', () => {
    render(<ClusterDistributionCard model={sampleModel} />);

    expect(screen.getByText('Group Overview & Balance')).toBeInTheDocument();
    expect(screen.getByText('3 Groups')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Group 1')).toBeInTheDocument();
  });

  it('renders cluster profiles card with feature statistics and comparisons', () => {
    render(<ClusterProfilesCard model={sampleModel} />);

    expect(screen.getByText('What Makes Each Group Different')).toBeInTheDocument();
    expect(screen.getAllByText('Group 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('annual_income').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('spending_score').length).toBeGreaterThanOrEqual(1);
  });

  it('renders clustering history list with runs and selection action', () => {
    const onSelect = vi.fn();
    const queryClient = new QueryClient();

    const historyItems: ClusteringModelSummary[] = [
      {
        id: 1,
        name: 'Customer Segmentation (Income vs Spend)',
        k: 3,
        feature_names: ['annual_income', 'spending_score'],
        n_samples: 200,
        inertia: 105000.2,
        silhouette_score: 0.62,
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ];

    render(
      <QueryClientProvider client={queryClient}>
        <ClusteringHistoryList
          models={historyItems}
          selectedModelId={1}
          onSelectModel={onSelect}
          datasetId={10}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Previous Groups & History')).toBeInTheDocument();
    expect(screen.getByText('Customer Segmentation (Income vs Spend)')).toBeInTheDocument();
    expect(screen.getByText('3 Groups')).toBeInTheDocument();

    const viewButton = screen.getByRole('button', { name: /View/i });
    expect(viewButton).toBeInTheDocument();
    fireEvent.click(viewButton);
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
