import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { AnomalyModelSummary } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { History, Trash2, Eye, ShieldAlert, Clock, AlertTriangle } from 'lucide-react';

interface AnomalyHistoryListProps {
  models: AnomalyModelSummary[];
  selectedModelId?: number | null;
  onSelectModel: (id: number) => void;
  datasetId: number;
}

export const AnomalyHistoryList: React.FC<AnomalyHistoryListProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  datasetId,
}) => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteAnomalyModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataset-anomaly-models', datasetId] });
    },
  });

  if (models.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60 p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-3">
          <History className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">No Anomaly Detection Runs Yet</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Select features and adjust the expected outlier percentage above to run your first anomaly detection.
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-rose-400" />
            <CardTitle className="text-base text-foreground font-semibold">
              Anomaly Detection Model History
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 text-xs">
            {models.length} {models.length === 1 ? 'Model' : 'Models'} Saved
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground bg-muted/20">
                <th className="py-3 px-4 font-semibold">Model Name</th>
                <th className="py-3 px-3 font-semibold">Features</th>
                <th className="py-3 px-3 font-semibold text-right">Contamination</th>
                <th className="py-3 px-3 font-semibold text-right">Anomalies</th>
                <th className="py-3 px-3 font-semibold text-right">Rate</th>
                <th className="py-3 px-3 font-semibold text-right">Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {models.map((m) => {
                const isSelected = m.id === selectedModelId;
                return (
                  <tr
                    key={m.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-rose-500/10' : 'hover:bg-muted/30'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{m.name}</span>
                        {isSelected && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rose-500/40 text-rose-400">
                            Active
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ID #{m.id} • {m.n_samples} samples
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {m.feature_names.join(', ')}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                      {(m.contamination * 100).toFixed(1)}%
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-medium text-rose-400">
                        {m.n_anomalies.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <span className="font-mono text-xs text-rose-400">
                        {m.anomaly_percentage.toFixed(1)}%
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground font-mono text-[10px]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'ghost'}
                          className={`h-7 px-2.5 text-xs ${isSelected ? 'bg-rose-600 hover:bg-rose-500 text-white' : ''}`}
                          onClick={() => onSelectModel(m.id)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          {isSelected ? 'Viewing' : 'Inspect'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(`Delete anomaly detection model "${m.name}"?`)) {
                              deleteMutation.mutate(m.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
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
