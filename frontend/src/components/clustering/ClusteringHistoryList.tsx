import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ClusteringModelSummary } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { History, Trash2, Eye, Network, CheckCircle2, Clock } from 'lucide-react';

interface ClusteringHistoryListProps {
  models: ClusteringModelSummary[];
  selectedModelId?: number | null;
  onSelectModel: (id: number) => void;
  datasetId: number;
}

export const ClusteringHistoryList: React.FC<ClusteringHistoryListProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  datasetId,
}) => {
  const queryClient = useQueryClient();
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteClusteringModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-clustering-models', datasetId] });
    },
  });

  if (models.length === 0) {
    return (
      <Card className="border-white/[0.08] bg-[#0c0817]/90 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-3">
          <History className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-white mb-1">No groups created yet</h4>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Choose the information you want to use above, then create groups to discover patterns in your data.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <CardTitle className="text-base text-white font-semibold">
              Previous Groups & History
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-[11px] text-slate-400 hover:text-purple-300 transition-colors"
            >
              {showTechnicalDetails ? 'Hide technical scores' : 'Show technical scores'}
            </button>
            <Badge variant="purple" className="text-xs">
              {models.length} {models.length === 1 ? 'Run' : 'Runs'} Saved
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                <th className="py-3 px-4 font-semibold">Group Name</th>
                <th className="py-3 px-3 font-semibold">Fields Used</th>
                <th className="py-3 px-3 font-semibold text-right">Records Grouped</th>
                <th className="py-3 px-3 font-semibold text-right">Groups Found</th>
                {showTechnicalDetails && (
                  <>
                    <th className="py-3 px-3 font-semibold text-right">Inertia</th>
                    <th className="py-3 px-3 font-semibold text-right">Silhouette</th>
                  </>
                )}
                <th className="py-3 px-3 font-semibold text-right">Created</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {models.map((m) => {
                const isSelected = m.id === selectedModelId;
                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-purple-600/15' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{m.name}</span>
                        <Badge variant="purple" className="text-[10px] px-1.5 py-0 font-normal">
                          {m.k} Groups
                        </Badge>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Run #{m.id}
                      </span>
                    </td>

                    <td className="py-3 px-3 max-w-[200px] truncate" title={m.feature_names.join(', ')}>
                      <span className="text-slate-300 text-[11px]">
                        {m.feature_names.join(', ')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-300 font-medium">
                      {m.n_samples.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="font-semibold text-purple-300">{m.k}</span>
                    </td>

                    {showTechnicalDetails && (
                      <>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {m.inertia.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          {m.silhouette_score != null ? m.silhouette_score.toFixed(4) : '—'}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-3 text-right text-slate-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={isSelected ? 'glow' : 'outline'}
                          size="sm"
                          onClick={() => onSelectModel(m.id)}
                          className="h-7 text-xs px-2.5"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(m.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Delete model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
