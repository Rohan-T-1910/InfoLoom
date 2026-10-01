import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Cpu,
  Layers,
  CheckCircle2,
  Sliders,
  BarChart3,
  Zap,
  Split,
  Binary,
  TrendingUp,
} from 'lucide-react';

interface MLModelDetailsCardProps {
  modelId: number;
  onPredictClick?: () => void;
}

export const MLModelDetailsCard: React.FC<MLModelDetailsCardProps> = ({
  modelId,
  onPredictClick,
}) => {
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
  const metrics = model.test_metrics || {};

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
                  {model.algorithm_name}
                </CardTitle>
                <Badge variant="purple" className="capitalize text-[10px]">
                  {model.task_type}
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-400">
                Model #{model.id} • Target: <span className="text-purple-300 font-mono">{model.target_column}</span>
              </CardDescription>
            </div>
          </div>

          {onPredictClick && (
            <Button variant="glow" size="sm" onClick={onPredictClick} className="self-start sm:self-auto">
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Open Live Predictor
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {isRegression ? (
            <>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Test R² Score</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.r2 != null ? metrics.r2.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Variance explained</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">RMSE</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.rmse != null ? metrics.rmse.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Root Mean Squared Error</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">MAE</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.mae != null ? metrics.mae.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Mean Absolute Error</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">CV Mean R²</span>
                <p className="text-lg font-mono font-bold text-purple-300 mt-1">
                  {model.cv_mean != null ? model.cv_mean.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">± {model.cv_std?.toFixed(3) || '0.000'}</span>
              </div>
            </>
          ) : (
            <>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">Test Accuracy</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.accuracy != null ? `${(metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Overall correctness</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">F1-Score</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.f1 != null ? metrics.f1.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Harmonic mean P/R</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">ROC-AUC</span>
                <p className="text-lg font-mono font-bold text-white mt-1">
                  {metrics.roc_auc != null ? metrics.roc_auc.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">Ranking discrimination</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
                <span className="text-[11px] text-slate-400 font-medium">CV Mean F1</span>
                <p className="text-lg font-mono font-bold text-purple-300 mt-1">
                  {model.cv_mean != null ? model.cv_mean.toFixed(4) : 'N/A'}
                </p>
                <span className="text-[10px] text-slate-500">± {model.cv_std?.toFixed(3) || '0.000'}</span>
              </div>
            </>
          )}
        </div>

        {/* Cross-Validation Folds Breakdown */}
        {model.cv_scores && model.cv_scores.length > 0 && (
          <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                Individual Cross-Validation Fold Scores
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {model.cv_scores.length} Folds
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {model.cv_scores.map((score, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center"
                >
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Fold {i + 1}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-200">
                    {score.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preprocessing Architecture */}
        <div className="p-4 rounded-xl bg-[#120d24]/40 border border-white/[0.06] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Sklearn Preprocessing Pipeline Architecture</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Numerical Pipeline:</span>
                <span className="text-[11px] text-purple-300 font-mono">
                  SimpleImputer(median) → StandardScaler
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {model.features_numeric.length > 0 ? (
                  model.features_numeric.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-[11px] font-mono text-slate-300"
                    >
                      {f}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Categorical Pipeline:</span>
                <span className="text-[11px] text-purple-300 font-mono">
                  SimpleImputer(most_frequent) → OneHotEncoder
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {model.features_categorical.length > 0 ? (
                  model.features_categorical.map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded bg-white/[0.04] text-[11px] font-mono text-slate-300"
                    >
                      {f}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 italic">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
