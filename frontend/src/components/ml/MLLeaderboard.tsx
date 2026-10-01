import React from 'react';
import { MLModelLeaderboardItem, MLTaskType } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Trophy,
  BarChart2,
  CheckCircle2,
  ExternalLink,
  Percent,
  TrendingUp,
  Cpu,
  Zap,
} from 'lucide-react';

interface MLLeaderboardProps {
  models: MLModelLeaderboardItem[];
  bestModelId?: number | null;
  selectedModelId?: number | null;
  onSelectModel: (model: MLModelLeaderboardItem) => void;
  onPredictWithModel: (model: MLModelLeaderboardItem) => void;
}

export const MLLeaderboard: React.FC<MLLeaderboardProps> = ({
  models,
  bestModelId,
  selectedModelId,
  onSelectModel,
  onPredictWithModel,
}) => {
  if (models.length === 0) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-3">
          <Trophy className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-white mb-1">No Models Trained Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Configure a target column above and click "Train & Benchmark Models" to populate this leaderboard.
        </p>
      </Card>
    );
  }

  // Determine primary task type from first model
  const taskType = models[0]?.task_type || 'classification';
  const isRegression = taskType === 'regression';

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-400" />
              <CardTitle className="text-lg text-white font-semibold">
                Model Comparison Leaderboard
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Ranked by {isRegression ? 'Test R² (higher is better)' : 'Test F1-Score (higher is better)'} across holdout test sets.
            </CardDescription>
          </div>

          <Badge variant="purple" className="self-start sm:self-auto text-xs px-2.5 py-1">
            {models.length} {models.length === 1 ? 'Model' : 'Models'} Evaluated
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                <th className="py-3.5 px-4 font-semibold">Rank & Algorithm</th>
                <th className="py-3.5 px-3 font-semibold text-right">
                  Primary Metric ({isRegression ? 'R²' : 'F1'})
                </th>
                {isRegression ? (
                  <>
                    <th className="py-3.5 px-3 font-semibold text-right">RMSE</th>
                    <th className="py-3.5 px-3 font-semibold text-right">MAE</th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-3 font-semibold text-right">Accuracy</th>
                    <th className="py-3.5 px-3 font-semibold text-right">ROC-AUC</th>
                  </>
                )}
                <th className="py-3.5 px-3 font-semibold text-right">CV Score (Mean ± Std)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {models.map((model, idx) => {
                const isBest = model.id === bestModelId || idx === 0;
                const isSelected = model.id === selectedModelId;
                const metrics = model.test_metrics || {};

                return (
                  <tr
                    key={model.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-purple-600/15'
                        : isBest
                        ? 'bg-amber-500/[0.03] hover:bg-white/[0.03]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Rank & Algorithm */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                            idx === 0
                              ? 'bg-amber-400 text-black shadow-sm shadow-amber-400/30'
                              : idx === 1
                              ? 'bg-slate-300 text-black'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">
                              {model.algorithm_name}
                            </span>
                            {isBest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                <Trophy className="w-2.5 h-2.5" /> Best
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Model #{model.id} • {model.algorithm}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Primary Metric */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="font-mono text-sm font-bold text-white">
                        {model.primary_metric_value != null
                          ? model.primary_metric_value.toFixed(4)
                          : 'N/A'}
                      </div>
                      <div className="w-20 ml-auto h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${
                            isBest ? 'bg-amber-400' : 'bg-purple-500'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, (model.primary_metric_value || 0) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* Secondary Metrics */}
                    {isRegression ? (
                      <>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {metrics.rmse != null ? metrics.rmse.toFixed(4) : 'N/A'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {metrics.mae != null ? metrics.mae.toFixed(4) : 'N/A'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {metrics.accuracy != null
                            ? `${(metrics.accuracy * 100).toFixed(1)}%`
                            : 'N/A'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {metrics.roc_auc != null ? metrics.roc_auc.toFixed(4) : '—'}
                        </td>
                      </>
                    )}

                    {/* CV Score */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {model.cv_mean != null ? (
                        <span>
                          {model.cv_mean.toFixed(4)}{' '}
                          <span className="text-slate-500 text-[10px]">
                            ± {model.cv_std ? model.cv_std.toFixed(3) : '0.000'}
                          </span>
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectModel(model)}
                          className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                        >
                          Inspect
                        </button>
                        <Button
                          variant={isBest ? 'glow' : 'outline'}
                          size="sm"
                          onClick={() => onPredictWithModel(model)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Predict
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
