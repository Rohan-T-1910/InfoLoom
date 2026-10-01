import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { History, ShieldCheck, BarChart3, Database } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { data: datasetsData } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit History & Pipeline Events</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Chronological record of dataset uploads, validation passes, data cleansing pipelines, and EDA evaluations.
        </p>
      </div>

      <Card className="border border-white/[0.08] bg-[#0c0818]/90">
        <CardHeader className="pb-3 border-b border-white/[0.06]">
          <CardTitle className="text-base font-semibold text-white">Event Log</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Immutable operation lineage tracking for reproducible ML workflows
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <div className="space-y-4">
            {datasets.map((d, idx) => (
              <div
                key={d.id}
                className="relative pl-6 pb-4 border-l border-purple-500/20 last:border-0 last:pb-0"
              >
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-950" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Ingested Dataset #{d.id}</span>
                    <Badge variant="purple" className="text-[10px]">
                      {d.original_filename}
                    </Badge>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Uploaded {d.row_count || 0} rows and {d.column_count || 0} features. Cleaning state:{' '}
                  <strong className={d.has_cleaned ? 'text-emerald-400' : 'text-slate-300'}>
                    {d.has_cleaned ? 'Cleaned' : 'Raw'}
                  </strong>
                  .
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
