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
  ArrowRight,
  TrendingDown,
  Gauge,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
} from 'lucide-react';

interface AnomalyConfigProps {
  dataset: Dataset;
  onEvaluationComplete: (res: AnomalyEvaluationResponse) => void;
  onRunComplete: (model: AnomalyModelResponse) => void;
  isEvaluating?: boolean;
  isDetecting?: boolean;
}

export const AnomalyConfig: React.FC<AnomalyConfigProps> = ({
  dataset,
  onEvaluationComplete,
  onRunComplete,
  isEvaluating = false,
  isDetecting = false,
}) => {
  const [useCleaned, setUseCleaned] = useState<boolean>(Boolean(dataset.has_cleaned));
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [contamination, setContamination] = useState<number>(0.05);
  const [nEstimators, setNEstimators] = useState<number>(100);
  const [modelName, setModelName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch available numeric anomaly features
  const { data: featureData, isLoading: isLoadingFeatures } = useQuery({
    queryKey: ['anomaly-features', dataset.id, useCleaned],
    queryFn: () => api.getAnomalyFeatures(dataset.id, useCleaned),
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

  // Evaluation mutation (preview mode without saving model artifact)
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
      setErrorMessage('Please select at least one numeric feature to evaluate.');
      return;
    }
    setErrorMessage(null);
    evalMutation.mutate({
      features: selectedFeatures,
      contamination: contamination,
      use_cleaned: useCleaned,
    });
  };

  // Run Anomaly Detection mutation (persists model artifact & generates full diagnostics)
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
      setErrorMessage('Please select at least one numeric feature.');
      return;
    }
    setErrorMessage(null);
    runMutation.mutate({
      features: selectedFeatures,
      contamination: contamination,
      n_estimators: nEstimators,
      name: modelName.trim() || `Anomaly Detection (${(contamination * 100).toFixed(1)}% sensitivity)`,
      use_cleaned: useCleaned,
    });
  };

  const contaminationPresets = [
    { label: '1% Strict', value: 0.01, desc: 'Identifies only extreme, undeniable anomalies' },
    { label: '3% Moderate', value: 0.03, desc: 'Balanced outlier detection for standard metrics' },
    { label: '5% Standard', value: 0.05, desc: 'Recommended default for general exploration' },
    { label: '10% Broad', value: 0.10, desc: 'Captures subtle drifts and borderline outliers' },
  ];

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">
                Anomaly Detection Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Select features and adjust sensitivity to detect unusual records in your data.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {errorMessage && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Pipeline Dataset Source (Cleaned vs Raw) */}
        {dataset.has_cleaned && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/40">
            <div>
              <p className="text-xs font-semibold text-foreground">Cleaned Data</p>
              <p className="text-[11px] text-muted-foreground">
                Use cleaned and validated dataset ({dataset.row_count} rows)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant={useCleaned ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setUseCleaned(true)}
              >
                Cleaned
              </Button>
              <Button
                size="sm"
                variant={!useCleaned ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setUseCleaned(false)}
              >
                Raw
              </Button>
            </div>
          </div>
        )}

        {/* Feature Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Sliders className="h-4 w-4 text-primary" />
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Numeric Features ({selectedFeatures.length} of {numericFeatures.length} selected)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              {recommendedFeatures.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-primary hover:text-primary/90 px-2"
                  onClick={selectRecommended}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Recommended
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                onClick={selectAll}
              >
                Select All
              </Button>
            </div>
          </div>

          {isLoadingFeatures ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading available numeric features...
            </div>
          ) : numericFeatures.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
              No suitable numeric features found in this dataset. Anomaly detection requires at least one numeric feature.
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
                    className={`flex flex-col text-left p-2.5 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'border-rose-500/60 bg-rose-500/10 text-foreground font-medium shadow-sm ring-1 ring-rose-500/30'
                        : 'border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="truncate font-semibold">{feat.name}</span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      ) : null}
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-muted-foreground">
                      {feat.missing_count > 0 ? (
                        <span className="text-amber-500">{feat.missing_count} nulls</span>
                      ) : (
                        <span className="text-emerald-500">100% clean</span>
                      )}
                      {isRecommended && (
                        <span className="text-primary font-medium flex items-center">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                          rec
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Contamination Rate Parameter */}
        <div className="space-y-3 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Gauge className="h-4 w-4 text-rose-400" />
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contamination Rate / Anomaly Sensitivity
              </label>
            </div>
            <span className="font-mono text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
              {(contamination * 100).toFixed(1)}% (
              {dataset.row_count ? Math.round(dataset.row_count * contamination) : '—'} expected anomalies)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {contaminationPresets.map((preset) => {
              const active = Math.abs(contamination - preset.value) < 0.001;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setContamination(preset.value)}
                  className={`p-2.5 text-left rounded-lg border text-xs transition-all ${
                    active
                      ? 'border-rose-500/60 bg-rose-500/15 text-foreground ring-1 ring-rose-500/30'
                      : 'border-border/50 bg-background/50 text-muted-foreground hover:bg-muted/30'
                  }`}
                >
                  <div className="font-medium text-xs mb-0.5">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground line-clamp-1">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Slider for fine adjustment */}
          <div className="flex items-center space-x-3 pt-1">
            <input
              type="range"
              min="0.005"
              max="0.25"
              step="0.005"
              value={contamination}
              onChange={(e) => setContamination(parseFloat(e.target.value))}
              className="w-full accent-rose-500 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Advanced Model Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Ensemble Trees (n_estimators)
            </label>
            <div className="flex items-center space-x-2">
              {[50, 100, 200].map((trees) => (
                <Button
                  key={trees}
                  type="button"
                  size="sm"
                  variant={nEstimators === trees ? 'default' : 'outline'}
                  className="h-8 text-xs flex-1"
                  onClick={() => setNEstimators(trees)}
                >
                  {trees} trees
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Higher tree counts provide smoother score distributions at slight compute cost.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Custom Model Tag / Identifier (Optional)
            </label>
            <input
              type="text"
              placeholder={`e.g. Q4 Audit Outlier Detection`}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full h-8 px-3 text-xs bg-background/60 border border-border/60 rounded-md focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Used to index saved models in the audit history.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/40">
          <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Scores records relative to normal patterns in the data</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={isEvaluating || evalMutation.isPending || selectedFeatures.length === 0}
              className="h-9 text-xs border-border/70 flex-1 sm:flex-initial"
            >
              {evalMutation.isPending || isEvaluating ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Calculating Preview...
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
                  Preview Scores
                </>
              )}
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={handleRun}
              disabled={isDetecting || runMutation.isPending || selectedFeatures.length === 0}
              className="h-9 text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium flex-1 sm:flex-initial shadow-sm"
            >
              {runMutation.isPending || isDetecting ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Finding Anomalies...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Find Anomalies
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
