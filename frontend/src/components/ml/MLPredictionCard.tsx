import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { MLModelDetail, MLPredictResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Zap,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface MLPredictionCardProps {
  modelId: number;
}

export const MLPredictionCard: React.FC<MLPredictionCardProps> = ({ modelId }) => {
  // Fetch detailed model schema to build form fields
  const { data: model, isLoading: isLoadingModel } = useQuery({
    queryKey: ['ml-model-details', modelId],
    queryFn: () => api.getModel(modelId),
    enabled: !!modelId,
  });

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [predictionResult, setPredictionResult] = useState<MLPredictResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // When model loads, fetch dataset preview to populate sample values
  const { data: previewData } = useQuery({
    queryKey: ['preview-sample', model?.dataset_id],
    queryFn: () => api.getPreview(model!.dataset_id, 3),
    enabled: Boolean(model?.dataset_id),
  });

  const features: string[] =
    model?.feature_names ||
    (model as any)?.features_numeric?.concat((model as any)?.features_categorical) ||
    [];

  // Initialize empty form state when model changes
  useEffect(() => {
    if (model) {
      const initial: Record<string, any> = {};
      features.forEach((col) => {
        initial[col] = '';
      });
      setFormData(initial);
      setPredictionResult(null);
      setErrorMsg(null);
    }
  }, [model, features.length]);

  // Fill sample values from the first row of preview data
  const handleFillSample = () => {
    if (!model || !previewData?.sample_rows || previewData.sample_rows.length === 0) return;
    const sampleRow = previewData.sample_rows[0];
    const filled: Record<string, any> = {};

    features.forEach((col) => {
      const val = sampleRow[col];
      filled[col] = val != null ? String(val) : '';
    });

    setFormData(filled);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Prediction Mutation
  const predictMutation = useMutation({
    mutationFn: (inputs: Record<string, any>[]) => api.predict(modelId, inputs),
    onSuccess: (res) => {
      setPredictionResult(res);
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Prediction calculation failed.');
    },
  });

  const handlePredict = (e: React.FormEvent) => {
    e.preventDefault();
    if (!model) return;

    // Convert numeric inputs
    const parsedRow: Record<string, any> = {};
    for (const [key, val] of Object.entries(formData)) {
      if (val === '' || val === null || val === undefined) {
        parsedRow[key] = null;
      } else if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) {
        parsedRow[key] = Number(val);
      } else {
        parsedRow[key] = val;
      }
    }

    predictMutation.mutate([parsedRow]);
  };

  if (isLoadingModel) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/4 mb-4" />
        <div className="h-24 bg-white/5 rounded-xl" />
      </Card>
    );
  }

  if (!model) return null;

  const isRegression = model.task_type === 'regression';
  const rawPrediction = predictionResult?.predictions?.[0];
  const predictionValue =
    rawPrediction != null && typeof rawPrediction === 'object' && 'prediction' in rawPrediction
      ? (rawPrediction as any).prediction
      : rawPrediction;
  const probabilities =
    predictionResult?.probabilities?.[0] ||
    (rawPrediction != null && typeof rawPrediction === 'object' ? (rawPrediction as any).probabilities : null);
  const hasPrediction =
    predictionResult != null && predictionValue !== undefined && predictionValue !== null;
  const modelName = model.algorithm_name || model.name || model.algorithm || 'Model';

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base text-white font-semibold">
                  Make Predictions on New Data
                </CardTitle>
                <Badge variant="purple" className="text-[10px]">
                  Model #{model.id} • {modelName}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Use your trained model to make predictions on new data. Enter input values below or autofill sample data.
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={handleFillSample}
            className="text-xs text-slate-300"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1 text-purple-400" />
            Autofill Sample Data
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handlePredict} className="space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Inputs Grid */}
          <div className="space-y-4">
            {features.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Model Input Fields ({features.length} {features.length === 1 ? 'field' : 'fields'})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {features.map((col) => (
                    <div key={col} className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-300 truncate block">
                        {col}
                      </label>
                      <input
                        type="text"
                        value={formData[col] ?? ''}
                        onChange={(e) => handleInputChange(col, e.target.value)}
                        placeholder={`Enter ${col}...`}
                        className="w-full bg-[#120d24] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="glow"
              size="default"
              disabled={predictMutation.isPending}
            >
              {predictMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Calculating Prediction...
                </span>
              ) : (
                <span className="flex items-center gap-2 font-semibold">
                  <Zap className="w-4 h-4" />
                  Generate Prediction
                </span>
              )}
            </Button>
          </div>
        </form>

        {/* Prediction Results Banner */}
        {hasPrediction && (
          <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#140e29] to-[#0c0817] border border-purple-500/30 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Prediction Result
              </span>
              <Badge variant="purple" className="text-[10px]">
                Predicting: {model.target_column}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline gap-3">
              <span className="text-xs text-slate-300">Predicted Outcome:</span>
              <div className="text-2xl font-mono font-bold text-white flex items-center gap-2">
                {isRegression ? (
                  <span className="text-purple-300">
                    {typeof predictionValue === 'number'
                      ? predictionValue.toLocaleString(undefined, { maximumFractionDigits: 4 })
                      : String(predictionValue)}
                  </span>
                ) : (
                  <span className="text-emerald-400 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40">
                    {String(predictionValue)}
                  </span>
                )}
              </div>
            </div>

            {/* Class Probabilities for Classification */}
            {!isRegression && probabilities && (
              <div className="pt-2 border-t border-white/[0.08] space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">
                  Outcome Likelihoods
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(probabilities).map(([cls, prob]) => {
                    const pct = Math.round((prob as number) * 100);
                    const isWinner = String(cls) === String(predictionValue);
                    return (
                      <div
                        key={cls}
                        className={`p-3 rounded-xl border ${
                          isWinner
                            ? 'bg-purple-900/30 border-purple-500/50'
                            : 'bg-white/[0.02] border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-white">{cls}</span>
                          <span className="font-mono text-purple-300 font-bold">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isWinner ? 'bg-purple-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
