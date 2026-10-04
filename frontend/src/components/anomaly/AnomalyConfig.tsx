import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  AnomalyEvaluationRequest,
  AnomalyEvaluationResponse,
  AnomalyModelResponse,
  AnomalyRunRequest,
  Dataset,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ShieldAlert,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  ChevronDown,
  Info,
} from 'lucide-react';

interface AnomalyConfigProps {
  dataset: Dataset;
  onEvaluationComplete: (res: AnomalyEvaluationResponse) => void;
  onRunComplete: (model: AnomalyModelResponse) => void;
  isEvaluating?: boolean;
  isDetecting?: boolean;
}

type SensitivityTier = 'strict' | 'balanced' | 'broad';

export const AnomalyConfig: React.FC<AnomalyConfigProps> = ({
  dataset,
  onEvaluationComplete,
  onRunComplete,
}) => {
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [sensitivity, setSensitivity] = useState<SensitivityTier>('balanced');
  const [customName, setCustomName] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map sensitivity tier to contamination float
  const sensitivityMap: Record<SensitivityTier, { value: number; label: string; desc: string }> = {
    strict: {
      value: 0.01,
      label: 'Strict (1%)',
      desc: 'Flags only the most extreme outliers. Minimizes false alarms; best for critical audits.',
    },
    balanced: {
      value: 0.05,
      label: 'Balanced (5% - Recommended)',
      desc: 'Detects noticeable variations while filtering out routine fluctuation. Ideal for general review.',
    },
    broad: {
      value: 0.10,
      label: 'Broad (10%)',
      desc: 'Comprehensive scan that flags subtle drifts, edge cases, and borderline anomalies.',
    },
  };

  const contamination = sensitivityMap[sensitivity].value;

  // Fetch available numeric features
  const { data: featureData, isLoading: isLoadingFeatures } = useQuery({
    queryKey: ['anomaly-features', dataset.id],
    queryFn: () => api.getAnomalyFeatures(dataset.id, true),
  });

  const numericFeatures = (featureData?.numeric_features || []).filter(
    (f) => !f.is_identifier
  );
  const recommendedFeatures = featureData?.recommended_features || [];

  // Auto-select recommended features
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

  // Preview evaluation mutation
  const evalMutation = useMutation({
    mutationFn: (payload: AnomalyEvaluationRequest) =>
      api.evaluateAnomalyConfig(dataset.id, payload),
    onSuccess: (data) => {
      setErrorMessage(null);
      onEvaluationComplete(data);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to preview anomaly detection.');
    },
  });

  const handleEvaluate = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one numeric column to evaluate.');
      return;
    }
    setErrorMessage(null);
    evalMutation.mutate({
      features: selectedFeatures,
      contamination,
      use_cleaned: true,
    });
  };

  // Full detection run mutation
  const runMutation = useMutation({
    mutationFn: (payload: AnomalyRunRequest) =>
      api.runAnomalyDetection(dataset.id, payload),
    onSuccess: (data) => {
      setErrorMessage(null);
      onRunComplete(data);
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to execute anomaly detection.');
    },
  });

  const handleRun = () => {
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one numeric column to analyze.');
      return;
    }
    setErrorMessage(null);
    const sensitivityName = sensitivity.charAt(0).toUpperCase() + sensitivity.slice(1);
    runMutation.mutate({
      features: selectedFeatures,
      contamination,
      n_estimators: 100,
      name: customName.trim() || `Unusual Records Scan (${sensitivityName})`,
      use_cleaned: true,
    });
  };

  const expectedCount = dataset.row_count ? Math.round(dataset.row_count * contamination) : '—';

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden shadow-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <CardTitle className="text-base font-semibold text-white">
                Find Unusual Records
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Select the numeric columns to check and choose how sensitive you want the outlier scan to be.
            </CardDescription>
          </div>
          <Badge variant="purple" className="text-[11px] self-start sm:self-auto">
            {dataset.original_filename} ({dataset.row_count?.toLocaleString()} rows)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Notice</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Section 1: Choose Columns */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-400" />
              1. Columns to inspect ({selectedFeatures.length} of {numericFeatures.length} selected)
            </label>
            <div className="flex items-center space-x-2">
              {recommendedFeatures.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-purple-300 hover:text-white px-2"
                  onClick={selectRecommended}
                >
                  <Sparkles className="h-3 w-3 mr-1 text-purple-400" />
                  Recommended
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-slate-400 hover:text-white px-2"
                onClick={selectAll}
              >
                Select All
              </Button>
            </div>
          </div>

          {isLoadingFeatures ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Loading available numeric columns...
            </div>
          ) : numericFeatures.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
              No numeric columns found in this dataset. Outlier scanning requires at least one numeric metric.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {numericFeatures.map((feat) => {
                const isSelected = selectedFeatures.includes(feat.name);
                const isRecommended = recommendedFeatures.includes(feat.name);
                return (
                  <button
                    key={feat.name}
                    type="button"
                    onClick={() => toggleFeature(feat.name)}
                    className={`flex flex-col text-left p-3 rounded-xl border text-xs transition-all ${
                      isSelected
                        ? 'border-rose-500/50 bg-rose-950/20 text-white font-medium shadow-sm ring-1 ring-rose-500/30'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="truncate font-semibold">{feat.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-rose-400 shrink-0 ml-1" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      {isRecommended && (
                        <span className="text-purple-400 font-medium flex items-center">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                          Recommended
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Sensitivity Selection */}
        <div className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              2. Outlier Detection Sensitivity
            </label>
            <span className="text-xs font-mono text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
              ~{expectedCount} records expected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['strict', 'balanced', 'broad'] as const).map((tierKey) => {
              const preset = sensitivityMap[tierKey];
              const isSelected = sensitivity === tierKey;
              return (
                <button
                  key={tierKey}
                  type="button"
                  onClick={() => setSensitivity(tierKey)}
                  className={`p-4 text-left rounded-xl border transition-all ${
                    isSelected
                      ? 'border-rose-500/60 bg-rose-950/30 ring-1 ring-rose-500/40 text-white'
                      : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/10 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white capitalize">{preset.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{preset.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collapsible Custom Title */}
        <div className="pt-2 border-t border-white/[0.04]">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Scan Options</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] max-w-md">
              <label className="text-xs text-slate-300 font-medium block mb-1">
                Scan Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Q4 Sales Outlier Audit"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Assign a custom name to recognize this scan in saved history.
              </span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {selectedFeatures.length > 0 ? (
              <span>
                Checking <strong className="text-white">{selectedFeatures.length} columns</strong> using{' '}
                <strong className="text-rose-400 capitalize">{sensitivity}</strong> sensitivity.
              </span>
            ) : (
              'Select at least one column above.'
            )}
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={evalMutation.isPending || runMutation.isPending || selectedFeatures.length === 0}
              className="text-xs text-slate-300"
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-purple-400 ${evalMutation.isPending ? 'animate-spin' : ''}`} />
              {evalMutation.isPending ? 'Previewing Scan...' : 'Preview Scan'}
            </Button>

            <Button
              variant="glow"
              size="sm"
              onClick={handleRun}
              disabled={runMutation.isPending || evalMutation.isPending || selectedFeatures.length === 0}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium"
            >
              <Play className={`w-3.5 h-3.5 mr-1.5 fill-current ${runMutation.isPending ? 'animate-pulse' : ''}`} />
              {runMutation.isPending ? 'Scanning Dataset...' : 'Scan for Unusual Records'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
