import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EDAKPIs } from '../components/eda/EDAKPIs';
import { EDASummaryStats } from '../components/eda/EDASummaryStats';
import { EDACorrelationMatrix } from '../components/eda/EDACorrelationMatrix';
import { DatasetKPIs, CorrelationMatrixResponse } from '../types';

// Mock Chart.js component since canvas is not rendered in JSDOM
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-bar-chart">Bar Chart</div>,
  Line: () => <div data-testid="mock-line-chart">Line Chart</div>,
}));

describe('Phase 3 EDA Components', () => {
  const sampleKPIs: DatasetKPIs = {
    row_count: 1000,
    column_count: 8,
    total_cells: 8000,
    missing_cells: 40,
    missing_percentage: 0.5,
    duplicate_rows: 2,
    duplicate_percentage: 0.2,
    numeric_columns_count: 5,
    categorical_columns_count: 3,
    memory_bytes: 65536,
    memory_human: '64 KB',
  };

  it('renders dataset KPIs correctly', () => {
    render(<EDAKPIs kpis={sampleKPIs} isCleaned={true} cached={true} />);

    expect(screen.getByText('1,000 × 8')).toBeInTheDocument();
    expect(screen.getByText('8,000 data cells')).toBeInTheDocument();
    expect(screen.getByText('0.5%')).toBeInTheDocument();
    expect(screen.getByText('5 Num / 3 Cat')).toBeInTheDocument();
    expect(screen.getByText('64 KB')).toBeInTheDocument();
  });

  it('renders summary statistics table for numerical and categorical features', () => {
    const stats: any = {
      salary: {
        data_type: 'numeric',
        count: 980,
        missing_count: 20,
        missing_percentage: 2.0,
        mean: 75000,
        median: 72000,
        std: 15000,
        min: 40000,
        max: 150000,
        q25: 60000,
        q75: 85000,
        iqr: 25000,
        skewness: 0.45,
        kurtosis: -0.1,
        zeros_count: 0,
        zeros_percentage: 0.0,
      },
      department: {
        data_type: 'categorical',
        count: 1000,
        missing_count: 0,
        missing_percentage: 0.0,
        unique: 4,
        mode: 'Engineering',
        mode_frequency: 450,
        top_categories: [
          { category: 'Engineering', count: 450, percentage: 45.0 },
          { category: 'Sales', count: 300, percentage: 30.0 },
        ],
      },
    };

    render(<EDASummaryStats stats={stats} />);

    expect(screen.getByText('salary')).toBeInTheDocument();
    expect(screen.getByText('department')).toBeInTheDocument();
    expect(screen.getByText('4 distinct')).toBeInTheDocument();
  });

  it('renders correlation matrix with collinearity warning signals', () => {
    const corr: CorrelationMatrixResponse = {
      columns: ['age', 'income'],
      matrix: {
        age: { age: 1.0, income: 0.92 },
        income: { age: 0.92, income: 1.0 },
      },
      strong_correlations: [
        {
          feature_a: 'age',
          feature_b: 'income',
          correlation: 0.92,
          abs_correlation: 0.92,
          relationship: 'Strong positive correlation',
        },
      ],
      warnings: [
        "Severe collinearity detected between 'age' and 'income' (r=0.92). One feature may be redundant.",
      ],
    };

    render(<EDACorrelationMatrix correlations={corr} />);

    expect(screen.getByText('Pearson Correlation Matrix')).toBeInTheDocument();
    expect(screen.getByText(/Severe collinearity detected/i)).toBeInTheDocument();
    expect(screen.getByText('Strong positive correlation')).toBeInTheDocument();
  });
});
