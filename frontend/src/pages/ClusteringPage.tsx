import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  ClusteringEvaluationResponse,
  ClusteringModelResponse,
  Dataset,
} from '../types';
import { ClusteringConfig } from '../components/clustering/ClusteringConfig';
import { ClusteringEvaluationCard } from '../components/clustering/ClusteringEvaluationCard';
import { ClusterDistributionCard } from '../components/clustering/ClusterDistributionCard';
import { ClusterProfilesCard } from '../components/clustering/ClusterProfilesCard';
import { ClusterScatterPlot } from '../components/clustering/ClusterScatterPlot';
import { ClusteringHistoryList } from '../components/clustering/ClusteringHistoryList';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Network,
  Database,
  BarChart3,
  Cpu,
  RefreshCw,
  Sparkles,
  Layers,
  Crosshair,
  TrendingDown,
  History,
} from 'lucide-react';

export const ClusteringPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  const [selectedK, setSelectedK] = useState<number>(3);
  const [evaluationResult, setEvaluationResult] = useState<ClusteringEvaluationResponse | null>(null);
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

  // 2. Fetch past clustering models for current dataset
  const {
    data: modelsSummary = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
    isFetching: isFetchingModels,
  } = useQuery({
    queryKey: ['dataset-clustering-models', effectiveId],
    queryFn: () => api.listDatasetClusteringModels(effectiveId!),
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
    queryKey: ['clustering-model-detail', selectedModelId],
    queryFn: () => api.getClusteringModel(selectedModelId!),
    enabled: !!selectedModelId,
  });

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSelectedModelId(null);
    setEvaluationResult(null);
    setSearchParams({ datasetId: String(id) });
  };

  const handleEvaluationComplete = (res: ClusteringEvaluationResponse) => {
    setEvaluationResult(res);
    setSelectedK(res.suggested_k);
  };

  const handleRunComplete = (model: ClusteringModelResponse) => {
    setSelectedModelId(model.id);
    queryClient.invalidateQueries({ queryKey: ['dataset-clustering-models', effectiveId] });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-purple-400">
              Phase 5 • Unsupervised Learning
            </span>
            <Badge variant="purple" className="text-[10px]">
              Customer Segmentation
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Network className="w-6 h-6 text-purple-400" />
            Clustering & Segmentation Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Standardized distance clustering, mathematical K selection (Elbow + Silhouette), segment profiles, and 2D visual projections.
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
                className="bg-[#0e091b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium transition-colors"
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
            className="text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <Link to={`/eda?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-slate-300">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              View EDA
            </Button>
          </Link>

          <Link to={`/models?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-slate-300">
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              Supervised ML
            </Button>
          </Link>
        </div>
      </div>

      {/* No Datasets Empty State */}
      {!isLoadingDatasets && datasets.length === 0 && (
        <Card className="border-white/[0.08] bg-[#0c0817]/90 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-4">
            <Database className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Upload a dataset to run unsupervised K-Means clustering, optimize cluster count with elbow curves, and profile customer segments.
          </p>
          <Link to="/datasets">
            <Button variant="glow" size="default">
              <Database className="w-4 h-4 mr-2" />
              Upload First Dataset
            </Button>
          </Link>
        </Card>
      )}

      {/* Main Clustering Workspace */}
      {currentDataset && (
        <div className="space-y-6">
          {/* Step 1: Configuration Form */}
          <ClusteringConfig
            dataset={currentDataset}
            selectedK={selectedK}
            onKChange={setSelectedK}
            onEvaluationComplete={handleEvaluationComplete}
            onRunComplete={handleRunComplete}
          />

          {/* Step 2: Evaluation Diagnostic (if triggered) */}
          {evaluationResult && (
            <ClusteringEvaluationCard
              evaluation={evaluationResult}
              currentK={selectedK}
              onApplyK={setSelectedK}
            />
          )}

          {/* Step 3: Detailed Segmentation Results (if model selected) */}
          {detailedModel && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h3 className="text-base font-semibold text-white">
                    Active Segmentation: {detailedModel.name}
                  </h3>
                  <Badge variant="purple" className="text-[10px]">
                    K = {detailedModel.k}
                  </Badge>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(detailedModel.created_at).toLocaleString()}
                </span>
              </div>

              {/* Distribution & Balances */}
              <ClusterDistributionCard model={detailedModel} />

              {/* 2D Scatter Visualization */}
              <ClusterScatterPlot model={detailedModel} />

              {/* Profiles & Parametric Statistics */}
              <ClusterProfilesCard model={detailedModel} />
            </div>
          )}

          {/* Step 4: Clustering History */}
          <ClusteringHistoryList
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
