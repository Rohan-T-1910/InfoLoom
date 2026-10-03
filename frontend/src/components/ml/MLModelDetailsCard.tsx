import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Cpu,
  Layers,
  Sliders,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MLModelDetailsCardProps {
  modelId: number;
  onPredictClick?: () => void;
}

export const MLModelDetailsCard: React.FC<MLModelDetailsCardProps> = ({
  modelId,
  onPredictClick,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const { data: model, isLoading, error } = useQuery({
    queryKey: ['ml-model-details', modelId],
    queryFn: () => api.getModel(modelId),
    enabled: !!modelId,
  });

  if (isLoading) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4" />
        <div className="h-4 bg-white/5 rounded w-1/2 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !model) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-6 text-slate-400 text-sm">
        Failed to load model details.
      </Card>
    );
  }

  const isRegression = model.task_type === 'regression';
  const metrics = model.metrics || (model as any).test_metrics || {};
  const modelName = model.algorithm_name || model.name || model.algorithm || 'Model';
  const features: string[] =
    model.feature_names ||
    (model as any).features_numeric?.concat((model as any).features_categorical) ||
    [];
  const cvScores: number[] = metrics.cv_scores || (model as any).cv_scores || [];

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base text-white font-semibold">
                  {modelName}
                </CardTitle>
                <Badge variant="purple" className="text-[10px]">
                  {isRegression ? 'Numerical Prediction' : 'Category Prediction'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Model #{model.id} • Predicting: <span className="text-purple-300 font-semibold">{model.target_column}</span>
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-xs text-slate-300"
            >
              <Sliders className="w-3.5 h-3.5 mr-1 text-purple-400" />
              {showTechnicalDetails ? 'Hide Technical Details' : 'Advanced Details'}
              {showTechnicalDetails ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-400" />
              )}
            </Button>

            {onPredictClick && (
              <Button variant="glow" size="sm" onClick={onPredictClick}>
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                Make Predictions
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Metric Cards Grid with Business Explanations */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isRegression ? (
            <>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Variance Explained (R²)</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.r2 === 'number' ? metrics.r2.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">Closeness to actual outcomes</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Average Deviation (RMSE)</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.rmse === 'number' ? metrics.rmse.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">Standard prediction error</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Mean Absolute Error (MAE)</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.mae === 'number' ? metrics.mae.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">Typical absolute error</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Validation Consistency</span>
                <p className="text-lg font-mono font-bold text-purple-300 mt-1">
                  {typeof metrics.cv_mean === 'number'
                    ? metrics.cv_mean.toFixed(4)
                    : typeof (model as any).cv_mean === 'number'
                    ? (model as any).cv_mean.toFixed(4)
                    : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">
                  ± {(typeof metrics.cv_std === 'number' ? metrics.cv_std : (model as any).cv_std)?.toFixed(3) || '0.000'} variation
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Overall Accuracy</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.accuracy === 'number' ? `${(metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">How often predictions were correct</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">F1-Score</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.f1 === 'number' ? metrics.f1.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">Balanced reliability score</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Ranking Ability (ROC-AUC)</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {typeof metrics.roc_auc === 'number' ? metrics.roc_auc.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">Class separation quality</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Validation Consistency</span>
                <p className="text-lg font-mono font-bold text-purple-300 mt-1">
                  {typeof metrics.cv_mean === 'number'
                    ? metrics.cv_mean.toFixed(4)
                    : typeof (model as any).cv_mean === 'number'
                    ? (model as any).cv_mean.toFixed(4)
                    : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-400">
                  ± {(typeof metrics.cv_std === 'number' ? metrics.cv_std : (model as any).cv_std)?.toFixed(3) || '0.000'} variation
                </span>
              </div>
            </>
          )}
        </div>

        {/* Selected Features Summary */}
        <div className="p-4 rounded-xl bg-[#120d24]/50 border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Information Used by This Model ({features.length} {features.length === 1 ? 'field' : 'fields'})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {features.length > 0 ? (
              features.map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-slate-200"
                >
                  {f}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">All available non-identifier fields</span>
            )}
          </div>
        </div>

        {/* Optional Collapsible Advanced Technical Details */}
        {showTechnicalDetails && (
          <div className="space-y-4 pt-2 border-t border-white/[0.06] animate-in fade-in duration-200">
            {/* Cross-Validation Folds Breakdown */}
            {cvScores.length > 0 && (
              <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Individual Cross-Validation Fold Scores
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {cvScores.length} Folds
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {cvScores.map((score, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center"
                    >
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Fold {i + 1}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-200">
                        {typeof score === 'number' ? score.toFixed(4) : score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hyperparameters Summary */}
            {model.hyperparameters && Object.keys(model.hyperparameters).length > 0 && (
              <div className="p-4 rounded-xl bg-[#120d24]/40 border border-white/[0.06] space-y-2">
                <span className="text-xs font-semibold text-slate-300">Model Hyperparameters</span>
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                  {Object.entries(model.hyperparameters).map(([k, v]) => (
                    <span key={k} className="px-2.5 py-1 rounded bg-black/40 border border-white/[0.06] text-slate-300">
                      <span className="text-slate-500">{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
