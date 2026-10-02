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
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  LineChart,
  Eye,
  CheckCircle2,
} from 'lucide-react';

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

  // 2. Fetch past anomaly detection models for current dataset
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

  // Automatically select the most recent model if none is explicitly selected
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
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-rose-400">
              Phase 7 • Unsupervised Outlier Detection
            </span>
            <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 text-[10px]">
              Isolation Forest
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Anomaly & Outlier Detection Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Unsupervised tree isolation, deterministic scoring, contamination thresholds, and feature-level root cause explanations.
          </p>
        </div>

        {/* Dataset Selector & Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Dataset:</span>
              <select
                value={selectedDatasetId || ''}
                onChange={(e) => handleDatasetChange(Number(e.target.value))}
                className="bg-card border border-border/60 rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-rose-500 font-medium transition-colors"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id} className="bg-card text-foreground">
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
            className="text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <Link to={`/eda?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-primary" />
              EDA
            </Button>
          </Link>

          <Link to={`/clustering?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              Clustering
            </Button>
          </Link>

          <Link to={`/forecasting?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <LineChart className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Forecasting
            </Button>
          </Link>
        </div>
      </div>

      {/* No Datasets Empty State */}
      {!isLoadingDatasets && datasets.length === 0 && (
        <Card className="border-border/60 bg-card/60 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No Datasets Available</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Upload a dataset to train Isolation Forest models, evaluate outlier scores, isolate severe anomalies, and view root cause feature deviations.
          </p>
          <Link to="/datasets">
            <Button size="default" className="bg-rose-600 hover:bg-rose-500 text-white">
              <Database className="w-4 h-4 mr-2" />
              Upload First Dataset
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

          {/* Step 2: Evaluation Preview (Fast preview without saving) */}
          {evaluationPreview && (
            <Card className="border-border/60 bg-card/60 backdrop-blur">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    <CardTitle className="text-base text-foreground font-semibold">
                      Anomaly Preview Diagnostics
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 text-xs">
                    Preview Mode (Not Saved)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-medium">Evaluated Samples</p>
                    <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {evaluationPreview.n_samples.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-medium">Flagged Anomalies</p>
                    <p className="text-lg font-bold font-mono text-rose-400 mt-0.5">
                      {evaluationPreview.estimated_anomalies.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-medium">Contamination Rate</p>
                    <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {evaluationPreview.estimated_percentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-medium">Threshold Cutoff</p>
                    <p className="text-lg font-bold font-mono text-foreground mt-0.5">
                      {evaluationPreview.threshold_score.toFixed(4)}
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
          {detailedModel && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border/40 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="text-base font-semibold text-foreground">
                    Active Detection Model: {detailedModel.name}
                  </h3>
                  <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 text-[10px]">
                    {(detailedModel.contamination * 100).toFixed(1)}% Contamination
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  Created {new Date(detailedModel.created_at).toLocaleString()}
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

              {/* Anomalous Records Table with Feature Root Causes & CSV Export */}
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
  );
};
