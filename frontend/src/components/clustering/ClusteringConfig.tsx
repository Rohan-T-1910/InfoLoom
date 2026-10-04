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
  Users,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
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
  suggestedK?: number | null;
}

export const ClusteringConfig: React.FC<ClusteringConfigProps> = ({
  dataset,
  selectedK,
  onKChange,
  onEvaluationComplete,
  onRunComplete,
  isEvaluating = false,
  isClusteringActive = false,
  suggestedK,
}) => {
  const [useCleaned, setUseCleaned] = useState<boolean>(Boolean(dataset.has_cleaned));
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [modelName, setModelName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [groupCountMode, setGroupCountMode] = useState<'recommend' | 'manual'>('recommend');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Fetch available numeric clustering features
  const {
    data: featureData,
    isLoading: isLoadingFeatures,
    error: featuresError,
    refetch: refetchFeatures,
  } = useQuery({
    queryKey: ['clustering-features', dataset.id, useCleaned],
    queryFn: () => api.getClusteringFeatures(dataset.id, useCleaned),
    enabled: !!dataset?.id,
  });

  const numericFeatures = featureData?.numeric_features || [];
  const recommendedFeatures = featureData?.recommended_features || [];

  // Automatically select recommended features on initial load
  useEffect(() => {
    if (recommendedFeatures.length > 0 && selectedFeatures.length === 0) {
      setSelectedFeatures(recommendedFeatures);
    } else if (numericFeatures.length > 0 && selectedFeatures.length === 0) {
      setSelectedFeatures(numericFeatures.slice(0, 4).map((f) => f.name));
    }
  }, [recommendedFeatures, numericFeatures, selectedFeatures.length]);

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

  // Evaluation mutation to recommend optimal group count
  const evalMutation = useMutation({
    mutationFn: (payload: ClusteringEvaluationRequest) =>
      api.evaluateClustering(dataset.id, payload),
    onSuccess: (data) => {
      setErrorMessage(null);
      onEvaluationComplete(data);
      onKChange(data.suggested_k);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.message ||
          "We couldn't analyze the recommended number of groups. You can choose a number manually or try again."
      );
    },
  });

  const handleRecommendGroups = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one field to find groups.');
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
      setErrorMessage(
        err?.message ||
          "We couldn't create the groups. Please check your selected fields and try again."
      );
    },
  });

  const handleRunClustering = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one field before creating groups.');
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

  // Format field numbers cleanly
  const formatStatNumber = (val?: number | null) => {
    if (val === null || val === undefined) return '—';
    return Math.abs(val) >= 1000
      ? val.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/95 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Find Groups in Your Data
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Discover groups of similar records and understand what makes each group different.
              </CardDescription>
            </div>
          </div>

          {dataset.has_cleaned && (
            <div className="flex items-center gap-2 bg-[#120d24] px-3 py-1.5 rounded-lg border border-purple-500/20">
              <span className="text-xs text-slate-300">Data Source:</span>
              <button
                type="button"
                onClick={() => setUseCleaned(!useCleaned)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  useCleaned
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {useCleaned ? 'Cleaned Data' : 'Raw Data'}
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

        {/* 1. Feature Selection Section */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                What should we use to find groups?
              </label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Choose the information that should determine how records are grouped. ({selectedFeatures.length} selected)
              </p>
            </div>

            <div className="flex items-center gap-2">
              {recommendedFeatures.length > 0 && (
                <button
                  type="button"
                  onClick={selectRecommended}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer"
                >
                  Select Recommended ({recommendedFeatures.length})
                </button>
              )}
              {recommendedFeatures.length > 0 && numericFeatures.length > recommendedFeatures.length && (
                <>
                  <span className="text-slate-600 text-xs">•</span>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Select All ({numericFeatures.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {isLoadingFeatures ? (
            <div className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 animate-pulse flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              <span>Analyzing fields in this dataset...</span>
            </div>
          ) : featuresError ? (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
              <span>We couldn't analyze the dataset fields. Please check your connection and try again.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchFeatures()}
                className="h-7 text-xs border-rose-500/30"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          ) : numericFeatures.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs leading-relaxed">
              We couldn't find suitable fields for grouping in this dataset. Choose a dataset containing measurable fields such as age, quantity, amount, or other numerical characteristics.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-3 rounded-xl bg-[#120d24]/60 border border-white/[0.06]">
              {numericFeatures.map((feat) => {
                const isSelected = selectedFeatures.includes(feat.name);
                const isRec = recommendedFeatures.includes(feat.name);
                const colLower = feat.name.toLowerCase();
                const isIdentifier =
                  colLower === 'id' ||
                  colLower.endsWith('_id') ||
                  colLower.endsWith(' id') ||
                  colLower.startsWith('id_') ||
                  colLower.includes('transaction') ||
                  colLower.includes('customer_id');

                return (
                  <div
                    key={feat.name}
                    onClick={() => toggleFeature(feat.name)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-purple-500/60 bg-purple-950/30 shadow-sm'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {feat.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isRec && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-semibold">
                            Recommended
                          </span>
                        )}
                        {isIdentifier && !isRec && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-400 font-medium">
                            Identifier
                          </span>
                        )}
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-[10px] transition-colors ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'border border-white/20 text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        Avg: <strong className="text-slate-300 font-mono">{formatStatNumber(feat.mean)}</strong>
                      </span>
                      <span>
                        Range: {formatStatNumber(feat.min)} – {formatStatNumber(feat.max)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Group Count Configuration Section */}
        <div className="p-4 rounded-xl bg-[#120d24]/70 border border-white/[0.06] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-200 block">
                How many groups should we create?
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Let InfoLoom suggest the most natural number of groups, or specify a count manually.
              </p>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-[#0e091b] p-1 rounded-xl border border-white/10 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setGroupCountMode('recommend')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  groupCountMode === 'recommend'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Let InfoLoom recommend
              </button>
              <button
                type="button"
                onClick={() => setGroupCountMode('manual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  groupCountMode === 'manual'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Choose manually
              </button>
            </div>
          </div>

          {/* Mode A: Let InfoLoom Recommend */}
          {groupCountMode === 'recommend' && (
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      Recommended: {suggestedK || selectedK} groups
                    </span>
                    <Badge variant="purple" className="text-[10px] px-2 py-0.5">
                      Optimal Choice
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Based on the natural patterns and balance found across your selected fields.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRecommendGroups}
                disabled={evalMutation.isPending || isEvaluating || selectedFeatures.length === 0}
                className="text-xs text-purple-300 border-purple-500/30 hover:bg-purple-900/30 shrink-0"
              >
                {evalMutation.isPending || isEvaluating ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Finding Optimal Groups...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    Recommend Number of Groups
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* Mode B: Manual Selection */}
          {groupCountMode === 'manual' && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Selected: <strong className="text-purple-300 font-mono">{selectedK} groups</strong></span>
                <span className="text-[11px] text-slate-500">Pick from 2 to 8 groups</span>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {[2, 3, 4, 5, 6, 8].map((kVal) => (
                  <button
                    key={kVal}
                    type="button"
                    onClick={() => onKChange(kVal)}
                    className={`py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedK === kVal
                        ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400 font-semibold'
                        : 'bg-[#181130] text-slate-300 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    {kVal} groups
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. Group Name & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
          <div className="w-full sm:max-w-sm space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Name these groups (optional)
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. Retail Customer Groups"
              className="w-full bg-[#120d24] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
            />
          </div>

          <Button
            type="button"
            variant="glow"
            size="lg"
            onClick={handleRunClustering}
            disabled={runMutation.isPending || isClusteringActive || selectedFeatures.length === 0}
            className="w-full sm:w-auto h-11 px-6 shadow-[0_0_25px_rgba(168,85,247,0.4)]"
          >
            {runMutation.isPending || isClusteringActive ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Creating {selectedK} Groups...
              </span>
            ) : (
              <span className="flex items-center gap-2 font-semibold">
                <Users className="w-4 h-4" />
                Create {selectedK} Groups
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </Button>
        </div>

        {/* 4. Collapsible Advanced Details for Technical Users */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Advanced data preparation settings</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span>Data scaling:</span>
                <span className="text-slate-300 font-mono">Standardized (mean 0, variance 1)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Missing value handling:</span>
                <span className="text-slate-300 font-mono">Median imputation</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Partition algorithm:</span>
                <span className="text-slate-300 font-mono">K-Means partitioning</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
