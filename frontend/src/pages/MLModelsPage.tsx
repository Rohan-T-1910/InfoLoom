import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { MLModelLeaderboardItem, MLJob } from '../types';
import { MLTrainingConfig } from '../components/ml/MLTrainingConfig';
import { MLJobStatusCard } from '../components/ml/MLJobStatusCard';
import { MLLeaderboard } from '../components/ml/MLLeaderboard';
import { MLModelDetailsCard } from '../components/ml/MLModelDetailsCard';
import { MLPredictionCard } from '../components/ml/MLPredictionCard';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Cpu,
  Trophy,
  Zap,
  Sliders,
  Database,
  BarChart3,
  RefreshCw,
  PlusCircle,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';

export const MLModelsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'train' | 'predict'>('leaderboard');
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  // 1. Fetch available datasets for the user
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;

  // Sync selectedDatasetId if null and datasets exist
  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const effectiveId = currentDataset?.id || null;

  // 2. Fetch models for selected dataset
  const {
    data: models = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
    isFetching: isFetchingModels,
  } = useQuery({
    queryKey: ['dataset-models', effectiveId],
    queryFn: () => api.listDatasetModels(effectiveId!, 50),
    enabled: !!effectiveId,
  });

  // 3. Fetch past jobs for selected dataset to track latest job status
  const { data: jobs = [] } = useQuery({
    queryKey: ['dataset-jobs', effectiveId],
    queryFn: () => api.listDatasetJobs(effectiveId!, 10),
    enabled: !!effectiveId,
  });

  // Track latest active job if one is running
  useEffect(() => {
    if (jobs.length > 0) {
      const runningJob = jobs.find((j) => j.status === 'running' || j.status === 'pending');
      if (runningJob) {
        setActiveJobId(runningJob.id);
      } else if (!activeJobId && jobs[0]) {
        setActiveJobId(jobs[0].id);
      }
    }
  }, [jobs]);

  // Set default selected model to the first (best) model
  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSelectedModelId(null);
    setActiveJobId(null);
    setSearchParams({ datasetId: String(id) });
  };

  const handleJobStarted = (jobId: number) => {
    setActiveJobId(jobId);
    setActiveTab('leaderboard');
  };

  const handleJobCompleted = (job: MLJob) => {
    queryClient.invalidateQueries({ queryKey: ['dataset-models', effectiveId] });
    if (job.best_model_id) {
      setSelectedModelId(job.best_model_id);
    }
  };

  const handlePredictWithModel = (model: MLModelLeaderboardItem) => {
    setSelectedModelId(model.id);
    setActiveTab('predict');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-purple-400">
              Phase 4 • Machine Learning Core
            </span>
            <Badge variant="purple" className="text-[10px]">
              Regression & Classification
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Cpu className="w-6 h-6 text-purple-400" />
            Machine Learning Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end model training, leak-free pipelines, cross-validation benchmarking, and real-time inference.
          </p>
        </div>

        {/* Dataset Selector */}
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
            Upload your dataset to start training leak-free regression and classification models with automated benchmarking.
          </p>
          <Link to="/datasets">
            <Button variant="glow" size="default">
              <Database className="w-4 h-4 mr-2" />
              Upload First Dataset
            </Button>
          </Link>
        </Card>
      )}

      {/* Main Workspace */}
      {currentDataset && (
        <div className="space-y-6">
          {/* Active Job Tracker */}
          {activeJobId && (
            <MLJobStatusCard jobId={activeJobId} onJobCompleted={handleJobCompleted} />
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'leaderboard'
                  ? 'border-purple-500 text-purple-300 bg-purple-600/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              Leaderboard & Metrics
              {models.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300">
                  {models.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('train')}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'train'
                  ? 'border-purple-500 text-purple-300 bg-purple-600/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Train New Models
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('predict')}
              disabled={models.length === 0}
              className={`px-5 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                models.length === 0
                  ? 'opacity-40 cursor-not-allowed border-transparent text-slate-500'
                  : activeTab === 'predict'
                  ? 'border-purple-500 text-purple-300 bg-purple-600/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              Live Prediction & Inference
            </button>
          </div>

          {/* Tab 1: Leaderboard & Model Deep Dive */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-6">
              <MLLeaderboard
                models={models}
                bestModelId={models[0]?.id}
                selectedModelId={selectedModelId}
                onSelectModel={(m) => setSelectedModelId(m.id)}
                onPredictWithModel={handlePredictWithModel}
              />

              {selectedModelId && (
                <MLModelDetailsCard
                  modelId={selectedModelId}
                  onPredictClick={() => setActiveTab('predict')}
                />
              )}
            </div>
          )}

          {/* Tab 2: Train New Models */}
          {activeTab === 'train' && (
            <MLTrainingConfig
              dataset={currentDataset}
              onJobStarted={handleJobStarted}
            />
          )}

          {/* Tab 3: Live Prediction */}
          {activeTab === 'predict' && selectedModelId && (
            <div className="space-y-6">
              {/* Model Switcher */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0c0817] border border-white/[0.08]">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-slate-400">Inference Target Model:</span>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(Number(e.target.value))}
                    className="bg-[#120d24] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                  >
                    {models.map((m, idx) => (
                      <option key={m.id} value={m.id} className="bg-[#120d24] text-white">
                        {idx === 0 ? '★ ' : ''}Model #{m.id} • {m.algorithm_name} (
                        {m.task_type === 'regression' ? `R² ${m.primary_metric_value?.toFixed(3)}` : `F1 ${m.primary_metric_value?.toFixed(3)}`})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('leaderboard')}
                  className="text-xs"
                >
                  <Trophy className="w-3.5 h-3.5 mr-1.5" />
                  View Leaderboard
                </Button>
              </div>

              <MLPredictionCard modelId={selectedModelId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
