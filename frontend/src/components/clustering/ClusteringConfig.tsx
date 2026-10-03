import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  ClusteringEvaluationRequest,
  ClusteringEvaluationResponse,
  ClusteringModelResponse,
  ClusteringRunRequest,
  Dataset,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Network,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  Gauge,
  HelpCircle,
} from 'lucide-react';

interface ClusteringConfigProps {
  dataset: Dataset;
  selectedK: number;
  onKChange: (k: number) => void;
  onEvaluationComplete: (res: ClusteringEvaluationResponse) => void;
  onRunComplete: (model: ClusteringModelResponse) => void;
  isEvaluating?: boolean;
  isClusteringActive?: boolean;
}

export const ClusteringConfig: React.FC<ClusteringConfigProps> = ({
  dataset,
  selectedK,
  onKChange,
  onEvaluationComplete,
  onRunComplete,
  isEvaluating = false,
  isClusteringActive = false,
}) => {
  const [useCleaned, setUseCleaned] = useState<boolean>(Boolean(dataset.has_cleaned));
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [modelName, setModelName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch available numeric clustering features
  const { data: featureData, isLoading: isLoadingFeatures } = useQuery({
    queryKey: ['clustering-features', dataset.id, useCleaned],
    queryFn: () => api.getClusteringFeatures(dataset.id, useCleaned),
  });

  const numericFeatures = featureData?.numeric_features || [];
  const recommendedFeatures = featureData?.recommended_features || [];

  // Automatically select recommended features on initial load
  useEffect(() => {
    if (recommendedFeatures.length > 0 && selectedFeatures.length === 0) {
      // Pick up to 4 recommended features by default
      setSelectedFeatures(recommendedFeatures.slice(0, 4));
    } else if (numericFeatures.length > 0 && selectedFeatures.length === 0) {
      setSelectedFeatures(numericFeatures.slice(0, 2).map((f) => f.name));
    }
  }, [recommendedFeatures, numericFeatures]);

  const toggleFeature = (name: string) => {
    if (selectedFeatures.includes(name)) {
      if (selectedFeatures.length > 1) {
        setSelectedFeatures(selectedFeatures.filter((f) => f !== name));
      }
    } else {
      setSelectedFeatures([...selectedFeatures, name]);
    }
  };

  const selectRecommended = () => {
    if (recommendedFeatures.length > 0) {
      setSelectedFeatures(recommendedFeatures);
    }
  };

  const selectAll = () => {
    setSelectedFeatures(numericFeatures.map((f) => f.name));
  };

  // Evaluation mutation
  const evalMutation = useMutation({
    mutationFn: (payload: ClusteringEvaluationRequest) =>
      api.evaluateClustering(dataset.id, payload),
    onSuccess: (data) => {
      setErrorMessage(null);
      onEvaluationComplete(data);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to evaluate K range.');
    },
  });

  const handleEvaluate = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one numeric feature to evaluate.');
      return;
    }
    setErrorMessage(null);
    evalMutation.mutate({
      features: selectedFeatures,
      k_min: 2,
      k_max: Math.min(8, Math.max(3, dataset.row_count ? dataset.row_count - 1 : 8)),
      use_cleaned: useCleaned,
    });
  };

  // Run Clustering mutation
  const runMutation = useMutation({
    mutationFn: (payload: ClusteringRunRequest) =>
      api.runClustering(dataset.id, payload),
    onSuccess: (model) => {
      setErrorMessage(null);
      onRunComplete(model);
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Failed to run K-Means clustering.');
    },
  });

  const handleRunClustering = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one numeric feature.');
      return;
    }
    setErrorMessage(null);
    runMutation.mutate({
      features: selectedFeatures,
      k: selectedK,
      name: modelName.trim() || undefined,
      use_cleaned: useCleaned,
    });
  };

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-white font-semibold">
                Customer Segmentation Setup
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Configure features and segment count to discover natural groupings in your data.
              </CardDescription>
            </div>
          </div>

          {dataset.has_cleaned && (
            <div className="flex items-center gap-2 bg-[#120d24] px-3 py-1.5 rounded-lg border border-purple-500/20">
              <span className="text-xs text-slate-300">Cleaned Data:</span>
              <button
                type="button"
                onClick={() => setUseCleaned(!useCleaned)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  useCleaned
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {useCleaned ? 'Active (Cleaned)' : 'Raw Source'}
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Feature Selection */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                Select Numeric Features ({selectedFeatures.length} selected)
              </label>
              <p className="text-[11px] text-slate-400">
                Selected features will be median-imputed and z-score scaled before computing Euclidean distances.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {recommendedFeatures.length > 0 && (
                <button
                  type="button"
                  onClick={selectRecommended}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
                >
                  Select Recommended ({recommendedFeatures.length})
                </button>
              )}
              <span className="text-slate-600 text-xs">•</span>
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] text-slate-400 hover:text-white transition-colors"
              >
                Select All ({numericFeatures.length})
              </button>
            </div>
          </div>

          {isLoadingFeatures ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 animate-pulse">
              Analyzing numeric feature distributions...
            </div>
          ) : numericFeatures.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs">
              No suitable numeric columns found in this dataset for distance-based clustering.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-3 rounded-xl bg-[#120d24]/60 border border-white/[0.06]">
              {numericFeatures.map((feat) => {
                const isSelected = selectedFeatures.includes(feat.name);
                const isRec = recommendedFeatures.includes(feat.name);

                return (
                  <div
                    key={feat.name}
                    onClick={() => toggleFeature(feat.name)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-500/60 bg-purple-950/30'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-xs font-semibold text-white truncate">
                        {feat.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isRec && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-semibold">
                            Rec
                          </span>
                        )}
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'border border-white/20 text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>
                        μ: {feat.mean != null ? feat.mean.toFixed(1) : '—'}
                      </span>
                      <span>
                        [{feat.min != null ? feat.min.toFixed(0) : '—'} ..{' '}
                        {feat.max != null ? feat.max.toFixed(0) : '—'}]
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* K Selection & Evaluation Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-[#120d24]/70 border border-white/[0.06]">
          {/* Number of Clusters K */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-purple-400" />
                Target Number of Clusters (K)
              </span>
              <span className="text-purple-300 font-mono font-bold text-sm">
                K = {selectedK}
              </span>
            </div>

            <input
              type="range"
              min="2"
              max="10"
              step="1"
              value={selectedK}
              onChange={(e) => onKChange(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />

            <div className="flex gap-1.5">
              {[2, 3, 4, 5, 6, 8].map((kVal) => (
                <button
                  key={kVal}
                  type="button"
                  onClick={() => onKChange(kVal)}
                  className={`flex-1 py-1 rounded text-xs font-mono font-medium transition-colors ${
                    selectedK === kVal
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-[#181130] text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {kVal}
                </button>
              ))}
            </div>
          </div>

          {/* Elbow & Silhouette Evaluation Trigger */}
          <div className="flex flex-col justify-between space-y-2">
            <div>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-purple-400" />
                Optimal K Detection (Elbow & Silhouette)
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                Computes inertia drops and silhouette cohesion across K=2..8 to mathematically suggest the optimal cluster count.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={evalMutation.isPending || isEvaluating || selectedFeatures.length === 0}
              className="w-full text-xs text-purple-300 border-purple-500/30 hover:bg-purple-950/30"
            >
              {evalMutation.isPending || isEvaluating ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
                  Calculating Curves...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Find Recommended Number of Segments
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Model Name & Final Run CTA */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div className="w-full sm:max-w-sm space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Segmentation Name (Optional)
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={`e.g. Customer Segments (K=${selectedK})`}
              className="w-full bg-[#120d24] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <Button
            type="button"
            variant="glow"
            size="lg"
            onClick={handleRunClustering}
            disabled={runMutation.isPending || isClusteringActive || selectedFeatures.length === 0}
            className="w-full sm:w-auto"
          >
            {runMutation.isPending || isClusteringActive ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Creating Segments...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Network className="w-4 h-4" />
                Create {selectedK} Segments
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
