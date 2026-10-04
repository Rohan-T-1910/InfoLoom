import React, { useState } from 'react';
import { MLModelLeaderboardItem, MLTaskType } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Trophy,
  Zap,
  Award,
  Bookmark,
  Check,
} from 'lucide-react';
import { api } from '../../services/api';

interface MLLeaderboardProps {
  models: MLModelLeaderboardItem[];
  bestModelId?: number | null;
  selectedModelId?: number | null;
  datasetId?: number | null;
  onSelectModel: (model: MLModelLeaderboardItem) => void;
  onPredictWithModel: (model: MLModelLeaderboardItem) => void;
}

export const MLLeaderboard: React.FC<MLLeaderboardProps> = ({
  models,
  bestModelId,
  selectedModelId,
  datasetId,
  onSelectModel,
  onPredictWithModel,
}) => {
  const [savingModelId, setSavingModelId] = useState<number | null>(null);
  const [savedModelIds, setSavedModelIds] = useState<Set<number>>(new Set());

  const handleSaveModel = async (model: MLModelLeaderboardItem) => {
    const targetDatasetId = datasetId || (model as any).dataset_id;
    if (!targetDatasetId) return;
    setSavingModelId(model.id);
    try {
      await api.registerModel({
        name: `${model.name || model.algorithm} Predictor`,
        dataset_id: targetDatasetId,
        source_model_id: model.id,
        description: `Trained ${model.task_type} model (${model.algorithm})`,
        set_active: true,
      });
      setSavedModelIds((prev) => new Set(prev).add(model.id));
    } catch (e) {
      console.error('Failed to save model:', e);
    } finally {
      setSavingModelId(null);
    }
  };
  if (models.length === 0) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-3">
          <Trophy className="w-6 h-6" />
        </div>
        <h4 className="text-base font-semibold text-white mb-1">No Models Trained Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          Configure what you want to predict above and click "Train & Compare Models" to evaluate prediction approaches.
        </p>
      </Card>
    );
  }

  // Determine primary task type from first model
  const taskType = models[0]?.task_type || 'classification';
  const isRegression = taskType === 'regression';
  const bestModel = models.find((m) => m.id === bestModelId || m.is_best) || models[0];
  const bestModelName = bestModel?.algorithm_name || bestModel?.name || bestModel?.algorithm || 'Best Approach';

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
              Evaluated and ranked on unseen holdout test data. Higher scores indicate greater prediction reliability.
            </CardDescription>
          </div>

          <Badge variant="purple" className="self-start sm:self-auto text-xs px-2.5 py-1">
            {models.length} {models.length === 1 ? 'Approach' : 'Approaches'} Compared
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Top Performer Banner */}
        {bestModel && (
          <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs">
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-slate-300">
                Top Performer:{' '}
                <strong className="text-white">{bestModelName}</strong> achieved the strongest results on unseen data.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSaveModel(bestModel)}
                disabled={savingModelId === bestModel.id || savedModelIds.has(bestModel.id)}
                className="h-7 text-xs text-purple-300 border-purple-500/30 hover:bg-purple-950/40"
              >
                {savedModelIds.has(bestModel.id) ? (
                  <>
                    <Check className="w-3 h-3 mr-1 text-emerald-400" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3 h-3 mr-1" />
                    {savingModelId === bestModel.id ? 'Saving...' : 'Save Best Model'}
                  </>
                )}
              </Button>
              <Button
                variant="glow"
                size="sm"
                onClick={() => onPredictWithModel(bestModel)}
                className="h-7 text-xs self-start sm:self-auto"
              >
                <Zap className="w-3 h-3 mr-1" />
                Predict with Best Model
              </Button>
            </div>
          </div>
        )}

        {/* Metrics Guide Note */}
        <div className="px-5 py-2.5 bg-black/20 border-b border-white/[0.04] text-[11px] text-slate-400 flex flex-wrap items-center gap-x-6 gap-y-1">
          {isRegression ? (
            <>
              <span>
                <strong className="text-slate-200">R² Score:</strong> How much variation in the outcome is explained by the model (higher is better, 1.0 is perfect).
              </span>
              <span>
                <strong className="text-slate-200">RMSE / MAE:</strong> Average difference between predictions and actual values (lower is better).
              </span>
            </>
          ) : (
            <>
              <span>
                <strong className="text-slate-200">Accuracy:</strong> How often the model's predictions were correct overall.
              </span>
              <span>
                <strong className="text-slate-200">F1-Score:</strong> Balanced reliability across all categories (higher is better).
              </span>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                <th className="py-3.5 px-4 font-semibold">Rank & Approach</th>
                <th className="py-3.5 px-3 font-semibold text-right">
                  Primary Score ({isRegression ? 'R²' : 'F1'})
                </th>
                {isRegression ? (
                  <>
                    <th className="py-3.5 px-3 font-semibold text-right" title="Root Mean Squared Error (lower is better)">
                      RMSE
                    </th>
                    <th className="py-3.5 px-3 font-semibold text-right" title="Mean Absolute Error (lower is better)">
                      MAE
                    </th>
                  </>
                ) : (
                  <>
                    <th className="py-3.5 px-3 font-semibold text-right" title="Overall percentage of correct predictions">
                      Accuracy
                    </th>
                    <th className="py-3.5 px-3 font-semibold text-right" title="Ranking discrimination">
                      ROC-AUC
                    </th>
                  </>
                )}
                <th className="py-3.5 px-3 font-semibold text-right" title="Cross-validation consistency across multiple data folds">
                  Validation Consistency
                </th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {models.map((model, idx) => {
                const isBest = model.id === bestModelId || model.is_best || idx === 0;
                const isSelected = model.id === selectedModelId;
                const metrics = model.metrics || model.test_metrics || {};
                const modelName = model.algorithm_name || model.name || model.algorithm;

                const primaryVal =
                  model.primary_metric_value ??
                  metrics.primary_metric ??
                  metrics.r2 ??
                  metrics.f1 ??
                  null;

                const cvMean = model.cv_mean ?? metrics.cv_mean ?? null;
                const cvStd = model.cv_std ?? metrics.cv_std ?? null;
                const rmse = metrics.rmse ?? null;
                const mae = metrics.mae ?? null;
                const accuracy = metrics.accuracy ?? null;
                const rocAuc = metrics.roc_auc ?? null;

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
                              {modelName}
                            </span>
                            {isBest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                <Trophy className="w-2.5 h-2.5" /> Best
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Model #{model.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Primary Metric */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="font-mono text-sm font-bold text-white">
                        {typeof primaryVal === 'number'
                          ? primaryVal.toFixed(4)
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
                              Math.max(0, (typeof primaryVal === 'number' ? primaryVal : 0) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </td>

                    {/* Secondary Metrics */}
                    {isRegression ? (
                      <>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {typeof rmse === 'number' ? rmse.toFixed(4) : 'N/A'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {typeof mae === 'number' ? mae.toFixed(4) : 'N/A'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {typeof accuracy === 'number'
                            ? `${(accuracy * 100).toFixed(1)}%`
                            : 'N/A'}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                          {typeof rocAuc === 'number' ? rocAuc.toFixed(4) : '—'}
                        </td>
                      </>
                    )}

                    {/* CV Score Consistency */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {typeof cvMean === 'number' ? (
                        <span>
                          {cvMean.toFixed(4)}{' '}
                          <span className="text-slate-500 text-[10px]">
                            ± {typeof cvStd === 'number' ? cvStd.toFixed(3) : '0.000'}
                          </span>
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSaveModel(model)}
                          disabled={savingModelId === model.id || savedModelIds.has(model.id)}
                          className="h-7 text-xs px-2 text-purple-300 hover:text-white"
                          title="Save model for future predictions"
                        >
                          {savedModelIds.has(model.id) ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Bookmark className="w-3 h-3" />
                          )}
                          <span className="ml-1 hidden sm:inline">
                            {savedModelIds.has(model.id) ? 'Saved' : 'Save'}
                          </span>
                        </Button>
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
