import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReportsPage } from '../pages/ReportsPage';
import { api } from '../services/api';
import {
  ReportReadinessResponse,
  ReportDocumentResponse,
  CSVExportPreviewResponse,
  DatasetListResponse,
} from '../types';

// Mock API client methods
vi.mock('../services/api', () => ({
  api: {
    listDatasets: vi.fn(),
    getReportReadiness: vi.fn(),
    previewPredictionsCSV: vi.fn(),
    downloadPdfReport: vi.fn(),
    downloadPredictionsCSV: vi.fn(),
    getReportHistory: vi.fn(),
  },
}));

describe('Phase 9 Reports & Export Frontend Page', () => {
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

  const mockReadiness: ReportReadinessResponse = {
    dataset_id: 1,
    dataset_name: 'sales_q4.csv',
    total_rows: 500,
    total_columns: 6,
    has_cleaned: true,
    available_sections_count: 5,
    total_sections_count: 8,
    ready_for_pdf: true,
    sections: [
      {
        key: 'overview',
        name: 'Dataset Metadata & Schema',
        phase: 'Phase 1',
        status: 'available',
        detail: '500 rows × 6 columns',
        record_count: 500,
      },
      {
        key: 'cleaning',
        name: 'Data Quality & Cleaning Audit',
        phase: 'Phase 2',
        status: 'available',
        detail: 'Cleaned pipeline active (500 rows)',
      },
      {
        key: 'eda',
        name: 'Exploratory Data Analysis & Distributions',
        phase: 'Phase 3',
        status: 'available',
        detail: 'KPIs, correlations (3 strong pairs)',
      },
      {
        key: 'ml_models',
        name: 'Supervised Machine Learning Benchmarks',
        phase: 'Phase 4',
        status: 'available',
        detail: '3 trained models (Best: Random Forest)',
        record_count: 3,
      },
      {
        key: 'clustering',
        name: 'Customer & Entity Segmentation (K-Means)',
        phase: 'Phase 5',
        status: 'unavailable',
        detail: 'No clustering models run yet',
      },
      {
        key: 'forecasting',
        name: 'Time-Series Forecasting Trajectory',
        phase: 'Phase 6',
        status: 'unavailable',
        detail: 'No time-series forecasts executed yet',
      },
      {
        key: 'anomalies',
        name: 'Unsupervised Anomaly & Outlier Diagnostics',
        phase: 'Phase 7',
        status: 'available',
        detail: '12 outliers (2.4%)',
        record_count: 12,
      },
      {
        key: 'insights',
        name: 'Deterministic Business Insights & Signals',
        phase: 'Phase 8',
        status: 'unavailable',
        detail: 'No insight report compiled yet',
      },
    ],
  };

  const mockMlPreview: CSVExportPreviewResponse = {
    export_type: 'ml',
    model_name: 'Random Forest Regressor',
    total_rows: 500,
    columns: ['row_index', 'spend', 'actual_sales', 'predicted_sales', 'residual_error'],
    preview_rows: [
      { row_index: 0, spend: 20.0, actual_sales: 100.0, predicted_sales: 102.5, residual_error: -2.5 },
      { row_index: 1, spend: 25.0, actual_sales: 120.0, predicted_sales: 118.0, residual_error: 2.0 },
    ],
  };

  const mockHistory: ReportDocumentResponse[] = [
    {
      id: 101,
      dataset_id: 1,
      user_id: 1,
      title: 'Executive Report: sales_q4.csv',
      report_type: 'comprehensive_pdf',
      file_name: 'InfoLoom_Report_1_20231003.pdf',
      file_size_bytes: 45020,
      sections_included: ['overview', 'cleaning', 'eda', 'ml_models', 'anomalies'],
      metadata_summary: { rows: 500, columns: 6 },
      created_at: '2023-10-03T10:00:00Z',
    },
    {
      id: 102,
      dataset_id: 1,
      user_id: 1,
      title: 'ML Predictions Export: Random Forest Regressor',
      report_type: 'ml_csv',
      file_name: 'infoloom_ml_predictions_dataset_1.csv',
      file_size_bytes: 12500,
      sections_included: ['ml'],
      metadata_summary: { model_name: 'Random Forest Regressor', exported_rows: 500 },
      created_at: '2023-10-03T10:05:00Z',
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
    vi.mocked(api.getReportReadiness).mockResolvedValue(mockReadiness);
    vi.mocked(api.previewPredictionsCSV).mockResolvedValue(mockMlPreview);
    vi.mocked(api.getReportHistory).mockResolvedValue(mockHistory);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/reports?datasetId=1']}>
          <ReportsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('renders executive report card and section readiness checklist', async () => {
    renderComponent();

    // Check title & header
    expect(screen.getByText('Reports & Exports')).toBeInTheDocument();
    expect(screen.getByText('Executive PDF Report')).toBeInTheDocument();

    // Check readiness counts
    await waitFor(() => {
      expect(screen.getByText('5 / 8')).toBeInTheDocument();
    });

    // Check section checklist items
    expect(screen.getByText('Dataset Metadata & Schema')).toBeInTheDocument();
    expect(screen.getByText('Supervised Machine Learning Benchmarks')).toBeInTheDocument();
    expect(screen.getByText('Customer & Entity Segmentation (K-Means)')).toBeInTheDocument();

    // Check unavailable sections have "Run Now" links
    const runNowButtons = screen.getAllByText(/Run Now/i);
    expect(runNowButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders CSV prediction export with tabs, column tags, and preview table', async () => {
    renderComponent();

    await waitFor(() => {
      expect(api.previewPredictionsCSV).toHaveBeenCalledWith(1, 'ml');
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading export preview/i)).not.toBeInTheDocument();
    });

    expect(screen.getAllByText(/Random Forest Regressor/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/500 rows/i).length).toBeGreaterThanOrEqual(1);

    // Check preview table column headers and tags
    expect(screen.getAllByText('predicted_sales').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('actual_sales').length).toBeGreaterThanOrEqual(1);

    // Check sample values
    expect(screen.getByText('102.500')).toBeInTheDocument();
  });

  it('switches export prediction streams (tabs)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Export Predictions as CSV/i)).toBeInTheDocument();
    });

    const forecastTab = screen.getByRole('button', { name: /forecast/i });
    fireEvent.click(forecastTab);

    expect(api.previewPredictionsCSV).toHaveBeenCalledWith(1, 'forecast');
  });

  it('renders document history audit log', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Generated Document Audit Log/i)).toBeInTheDocument();
      expect(screen.getByText(/Executive Report: sales_q4.csv/i)).toBeInTheDocument();
      expect(screen.getByText(/ML Predictions Export: Random Forest Regressor/i)).toBeInTheDocument();
      expect(screen.getByText(/44.0 KB/i)).toBeInTheDocument();
    });
  });

  it('triggers PDF download when generate button is clicked', async () => {
    const mockBlob = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
    vi.mocked(api.downloadPdfReport).mockResolvedValue({
      blob: mockBlob,
      filename: 'InfoLoom_Report_1_test.pdf',
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
    const mockRevokeObjectURL = vi.fn();
    window.URL.createObjectURL = mockCreateObjectURL;
    window.URL.revokeObjectURL = mockRevokeObjectURL;

    renderComponent();

    const generateBtn = await screen.findByRole('button', {
      name: /Generate Report/i,
    });
    await waitFor(() => {
      expect(generateBtn).not.toBeDisabled();
    });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.downloadPdfReport).toHaveBeenCalledWith(1);
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(screen.getByText(/downloaded successfully/i)).toBeInTheDocument();
    });
  });

  it('handles empty states when model predictions are unavailable', async () => {
    vi.mocked(api.previewPredictionsCSV).mockImplementation(async (id, type) => {
      if (type === 'forecast') {
        throw new Error('No forecast predictions found for this dataset.');
      }
      return mockMlPreview;
    });

    renderComponent();

    const forecastTab = screen.getByRole('button', { name: /forecast/i });
    fireEvent.click(forecastTab);

    expect(await screen.findByText(/No Predictions Available/i)).toBeInTheDocument();
    expect(await screen.findByText(/Go to Forecasting/i)).toBeInTheDocument();
  });
});
