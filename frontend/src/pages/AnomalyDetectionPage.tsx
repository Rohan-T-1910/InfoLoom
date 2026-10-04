import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  AnomalyEvaluationResponse,
  AnomalyModelResponse,
  Dataset,
} from '../types';
import { AnomalyConfig } from '../components/anomaly/AnomalyConfig';
import { AnomalyMetricsCard } from '../components/anomaly/AnomalyMetricsCard';
import { AnomalyDistributionChart } from '../components/anomaly/AnomalyDistributionChart';
import { AnomalyScatterPlot } from '../components/anomaly/AnomalyScatterPlot';
import { AnomalousRowsTable } from '../components/anomaly/AnomalousRowsTable';
import { AnomalyHistoryList } from '../components/anomaly/AnomalyHistoryList';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ShieldAlert,
  Database,
  BarChart3,
  RefreshCw,
  Sparkles,
  Layers,
  LineChart,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AnomalyErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Anomaly Detection error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border border-rose-500/30 bg-rose-950/20 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Unable to display outlier scan results
            </h3>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto mt-1">
              {this.state.error?.message || 'An error occurred while formatting outlier results.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-rose-200 border-rose-500/30 hover:bg-rose-950/40"
          >
            Reset View
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export const AnomalyDetectionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  const [evaluationPreview, setEvaluationPreview] = useState<AnomalyEvaluationResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  // 1. Fetch user datasets
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;

  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const effectiveId = currentDataset?.id || null;

  // 2. Fetch past anomaly detection scans for current dataset
  const {
    data: modelsSummary = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
    isFetching: isFetchingModels,
  } = useQuery({
    queryKey: ['dataset-anomaly-models', effectiveId],
    queryFn: () => api.listDatasetAnomalyModels(effectiveId!),
    enabled: !!effectiveId,
  });

  // Automatically select the most recent scan if none is explicitly selected
  useEffect(() => {
    if (modelsSummary.length > 0 && !selectedModelId) {
      setSelectedModelId(modelsSummary[0].id);
    }
  }, [modelsSummary, selectedModelId]);

  // 3. Fetch detailed model data if a model is selected
  const { data: detailedModel, isLoading: isLoadingDetailedModel } = useQuery({
    queryKey: ['anomaly-model-detail', selectedModelId],
    queryFn: () => api.getAnomalyModel(selectedModelId!),
    enabled: !!selectedModelId,
  });

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSelectedModelId(null);
    setEvaluationPreview(null);
    setSearchParams({ datasetId: String(id) });
  };

  const handleEvaluationComplete = (res: AnomalyEvaluationResponse) => {
    setEvaluationPreview(res);
  };

  const handleRunComplete = (model: AnomalyModelResponse) => {
    setSelectedModelId(model.id);
    setEvaluationPreview(null);
    queryClient.invalidateQueries({ queryKey: ['dataset-anomaly-models', effectiveId] });
  };

  return (
    <AnomalyErrorBoundary>
      <div className="space-y-6">
        {/* Top Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
              Find Unusual Records
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Identify unusual rows, unexpected data patterns, and outliers that may require attention.
            </p>
          </div>

          {/* Dataset Selector & Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            {datasets.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Dataset:</span>
                <select
                  value={selectedDatasetId || ''}
                  onChange={(e) => handleDatasetChange(Number(e.target.value))}
                  className="bg-[#0e091b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500 font-medium transition-colors"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#0e091b] text-white">
                      {d.original_filename} ({d.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Link to="/datasets">
                <Button variant="outline" size="sm" className="text-xs">
                  <Database className="w-3.5 h-3.5 mr-1.5" />
                  Upload Dataset
                </Button>
              </Link>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchModels()}
              disabled={isFetchingModels || !effectiveId}
              className="text-xs text-slate-300"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>

            <Link to={`/eda?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Explore Data
              </Button>
            </Link>

            <Link to={`/insights?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Business Insights
              </Button>
            </Link>
          </div>
        </div>

        {/* No Datasets Empty State */}
        {!isLoadingDatasets && datasets.length === 0 && (
          <Card className="border border-white/[0.08] bg-[#0c0817]/90 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Upload a dataset to find unusual records and patterns that may need attention.
            </p>
            <Link to="/datasets">
              <Button variant="glow" size="default" className="bg-rose-600 hover:bg-rose-500 text-white">
                <Database className="w-4 h-4 mr-2" />
                Upload Dataset
              </Button>
            </Link>
          </Card>
        )}

        {/* Main Anomaly Detection Workspace */}
        {currentDataset && (
          <div className="space-y-6">
            {/* Step 1: Configuration Form */}
            <AnomalyConfig
              dataset={currentDataset}
              onEvaluationComplete={handleEvaluationComplete}
              onRunComplete={handleRunComplete}
            />

            {/* Step 2: Evaluation Preview */}
            {evaluationPreview && (
              <Card className="border border-rose-500/30 bg-[#0c0818]/90 overflow-hidden shadow-xl">
                <CardHeader className="pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-rose-400" />
                      <CardTitle className="text-base text-white font-semibold">
                        Outlier Scan Preview
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="border-rose-500/30 text-rose-300 bg-rose-950/20 text-xs">
                      Quick Preview
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-[#090514] border border-white/[0.06]">
                      <p className="text-[11px] text-slate-400 font-medium">Rows Checked</p>
                      <p className="text-lg font-bold font-mono text-white mt-0.5">
                        {evaluationPreview.n_samples.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#090514] border border-white/[0.06]">
                      <p className="text-[11px] text-slate-400 font-medium">Unusual Records</p>
                      <p className="text-lg font-bold font-mono text-rose-400 mt-0.5">
                        {evaluationPreview.estimated_anomalies.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#090514] border border-white/[0.06]">
                      <p className="text-[11px] text-slate-400 font-medium">Outlier Ratio</p>
                      <p className="text-lg font-bold font-mono text-white mt-0.5">
                        {evaluationPreview.estimated_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#090514] border border-white/[0.06]">
                      <p className="text-[11px] text-slate-400 font-medium">Sensitivity Tier</p>
                      <p className="text-lg font-bold text-cyan-400 mt-0.5">
                        {evaluationPreview.estimated_percentage <= 2
                          ? 'Strict'
                          : evaluationPreview.estimated_percentage >= 8
                          ? 'Broad'
                          : 'Balanced'}
                      </p>
                    </div>
                  </div>

                  {evaluationPreview.score_distribution && evaluationPreview.score_distribution.length > 0 && (
                    <AnomalyDistributionChart
                      buckets={evaluationPreview.score_distribution}
                      thresholdScore={evaluationPreview.threshold_score}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Detailed Saved Model Diagnostics & Anomalies */}
            {isLoadingDetailedModel && (
              <Card className="border border-white/[0.08] bg-[#0c0818]/60 p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-rose-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading scan results...</p>
              </Card>
            )}

            {detailedModel && !isLoadingDetailedModel && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/[0.06] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <h3 className="text-base font-semibold text-white">
                      Active Scan: {detailedModel.name || 'Unusual Records'}
                    </h3>
                    <Badge variant="purple" className="text-[10px]">
                      {detailedModel.n_anomalies} Outliers Flagged
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(detailedModel.created_at).toLocaleString()}
                  </span>
                </div>

                {/* KPI Metrics */}
                <AnomalyMetricsCard model={detailedModel} />

                {/* Visualizations Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {detailedModel.scatter_points && (
                    <AnomalyScatterPlot
                      points={detailedModel.scatter_points}
                      featureNames={detailedModel.feature_names}
                    />
                  )}
                  {detailedModel.distribution_buckets && (
                    <AnomalyDistributionChart
                      buckets={detailedModel.distribution_buckets}
                      thresholdScore={detailedModel.threshold_score}
                    />
                  )}
                </div>

                {/* Anomalous Records Table */}
                {detailedModel.anomalous_rows && (
                  <AnomalousRowsTable
                    rows={detailedModel.anomalous_rows}
                    modelName={detailedModel.name}
                  />
                )}
              </div>
            )}

            {/* Step 4: Model Run History */}
            <AnomalyHistoryList
              models={modelsSummary}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              datasetId={currentDataset.id}
            />
          </div>
        )}
      </div>
    </AnomalyErrorBoundary>
  );
};
