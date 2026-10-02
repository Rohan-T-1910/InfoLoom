import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ForecastModelSummary } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  History,
  Trash2,
  Eye,
  Calendar,
  Layers,
  Activity,
  AlertCircle,
} from 'lucide-react';

interface ForecastingHistoryListProps {
  models: ForecastModelSummary[];
  selectedModelId: number | null;
  onSelectModel: (id: number) => void;
  datasetId: number;
}

export const ForecastingHistoryList: React.FC<ForecastingHistoryListProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  datasetId,
}) => {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this saved forecast model?')) {
      return;
    }
    setDeletingId(id);
    try {
      await api.deleteForecastModel(id);
      queryClient.invalidateQueries({ queryKey: ['dataset-forecast-models', datasetId] });
      if (selectedModelId === id) {
        onSelectModel(null as any);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete forecast model.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!models || models.length === 0) {
    return (
      <Card className="border border-white/[0.08] bg-[#0c0818]/60 p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-purple-950/40 text-purple-400 mx-auto flex items-center justify-center mb-3">
          <History className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">No Forecast Models Yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Configure a date and numeric target column above to train an ARIMA model and project future trajectories.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <CardTitle className="text-sm font-semibold text-white">
              Forecasting Model History
            </CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {models.length} Saved
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-0.5">
            Previous time-series model runs with backtest evaluation metrics and forecast horizons.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white/[0.02] text-slate-400 font-medium border-b border-white/[0.06]">
              <tr>
                <th className="py-2.5 px-4">Model Name</th>
                <th className="py-2.5 px-3">Target & Date</th>
                <th className="py-2.5 px-3">Horizon</th>
                <th className="py-2.5 px-3">Frequency</th>
                <th className="py-2.5 px-3">MAPE</th>
                <th className="py-2.5 px-3">RMSE</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {models.map((m) => {
                const isSelected = selectedModelId === m.id;
                let mapeBadgeColor = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
                if (m.mape > 50) mapeBadgeColor = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
                else if (m.mape > 20) mapeBadgeColor = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
                else if (m.mape > 10) mapeBadgeColor = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400';

                return (
                  <tr
                    key={m.id}
                    onClick={() => onSelectModel(m.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-950/20' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-3 px-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400" />}
                        <span className="font-semibold text-slate-100">{m.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {m.model_type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{m.target_column}</span>
                        <span className="text-[10px] text-slate-500">{m.date_column}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-cyan-400 font-semibold">
                      +{m.horizon} steps
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {m.frequency}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-medium ${mapeBadgeColor}`}>
                        {m.mape.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {m.rmse < 0.01 ? m.rmse.toExponential(2) : m.rmse.toFixed(3)}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(m.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant={isSelected ? 'glow' : 'outline'}
                          size="sm"
                          onClick={() => onSelectModel(m.id)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          {isSelected ? 'Viewing' : 'View'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(m.id, e)}
                          disabled={deletingId === m.id}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
