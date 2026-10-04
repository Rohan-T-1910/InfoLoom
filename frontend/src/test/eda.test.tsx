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

describe('Customer-Oriented EDA Components', () => {
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

  it('renders simplified business-facing dataset KPIs correctly without memory footprint', () => {
    render(<EDAKPIs kpis={sampleKPIs} isCleaned={true} cached={true} />);

    expect(screen.getByText('Total Records')).toBeInTheDocument();
    expect(screen.getByText('1,000 rows')).toBeInTheDocument();
    expect(screen.getByText('Data Completeness')).toBeInTheDocument();
    expect(screen.getByText('99.5%')).toBeInTheDocument();
    expect(screen.getByText('Duplicate Records')).toBeInTheDocument();
    expect(screen.getByText('2 duplicates')).toBeInTheDocument();
    expect(screen.getByText('Usable Fields')).toBeInTheDocument();
    expect(screen.getByText('8 Fields')).toBeInTheDocument();

    // Verify system metrics like Memory Footprint are completely omitted
    expect(screen.queryByText('Memory Footprint')).not.toBeInTheDocument();
    expect(screen.queryByText('64 KB')).not.toBeInTheDocument();
  });

  it('renders plain-language column overview table for numerical and categorical features', () => {
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

    expect(screen.getByText('Dataset Fields & Column Overview')).toBeInTheDocument();
    expect(screen.getByText('salary')).toBeInTheDocument();
    expect(screen.getByText('department')).toBeInTheDocument();
    expect(screen.getByText('4 distinct')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();

    // Verify statistical jargon is not rendered
    expect(screen.queryByText('Skewness / Kurtosis')).not.toBeInTheDocument();
    expect(screen.queryByText('Std Dev')).not.toBeInTheDocument();
    expect(screen.queryByText('IQR [25% - 75%]')).not.toBeInTheDocument();
  });

  it('renders business-oriented key relationships and overlap warnings', () => {
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

    expect(screen.getByText('Key Relationships & Patterns')).toBeInTheDocument();
    expect(screen.getByText('High Overlap Detected')).toBeInTheDocument();
    expect(screen.getByText(/show a strong positive relationship/i)).toBeInTheDocument();
    expect(screen.getByText(/High information overlap between 'age' and 'income'/i)).toBeInTheDocument();

    // Verify technical terms (collinearity, Pearson Correlation Matrix) are omitted
    expect(screen.queryByText(/collinearity/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Pearson Correlation Matrix')).not.toBeInTheDocument();
  });

  it('excludes identifier columns and identifier warnings from relationship display', () => {
    const corr: CorrelationMatrixResponse = {
      columns: ['Quantity', 'Price per Unit', 'Total Amount'],
      matrix: {
        Quantity: { Quantity: 1.0, 'Price per Unit': 0.02, 'Total Amount': 0.37 },
        'Price per Unit': { Quantity: 0.02, 'Price per Unit': 1.0, 'Total Amount': 0.85 },
        'Total Amount': { Quantity: 0.37, 'Price per Unit': 0.85, 'Total Amount': 1.0 },
      },
      strong_correlations: [
        {
          feature_a: 'Transaction ID',
          feature_b: 'Customer ID',
          correlation: 1.0,
          abs_correlation: 1.0,
          relationship: 'Strong positive correlation',
        },
        {
          feature_a: 'Price per Unit',
          feature_b: 'Total Amount',
          correlation: 0.85,
          abs_correlation: 0.85,
          relationship: 'Strong positive correlation',
        },
      ],
      warnings: [
        "Severe collinearity detected between 'Transaction ID' and 'Customer ID' (r=1.0).",
      ],
    };

    render(<EDACorrelationMatrix correlations={corr} />);

    // Legitimate relationship is shown
    expect(screen.getAllByText('Price per Unit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total Amount').length).toBeGreaterThan(0);

    // Identifier relationships and warnings are omitted
    expect(screen.queryByText('Transaction ID')).not.toBeInTheDocument();
    expect(screen.queryByText('Customer ID')).not.toBeInTheDocument();
    expect(screen.queryByText('High Overlap Detected')).not.toBeInTheDocument();
    expect(screen.queryByText(/collinearity/i)).not.toBeInTheDocument();
  });
});
