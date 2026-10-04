import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { History, CheckCircle2, BarChart3, Database, Sparkles, ArrowRight } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { data: datasetsData, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Analysis &amp; Activity History</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          A clear chronological record of datasets uploaded, data validations, and analytical workflows performed.
        </p>
      </div>

      <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden shadow-xl">
        <CardHeader className="pb-3 border-b border-white/[0.06]">
          <CardTitle className="text-base font-semibold text-white">Recent Workspace Activity</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Timeline of data uploads, validations, and analysis sessions
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Loading activity history...
            </div>
          ) : datasets.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Database className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-white">No Activity Recorded Yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Upload your first dataset to start exploring trends, forecasts, and automated business insights.
              </p>
              <Link to="/datasets">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white text-xs mt-2">
                  Upload Dataset
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {datasets.map((d) => (
                <div
                  key={d.id}
                  className="relative pl-6 pb-6 border-l border-purple-500/20 last:border-0 last:pb-0"
                >
                  <div className="absolute -left-1.5 top-0.5 w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-950" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">
                        Uploaded {d.original_filename}
                      </span>
                      <Badge variant="purple" className="text-[10px]">
                        {d.row_count?.toLocaleString()} Rows
                      </Badge>
                      {d.has_cleaned && (
                        <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-300 text-[10px]">
                          Validated
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">
                      {new Date(d.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mb-3">
                    Contains {d.row_count || 0} rows across {d.column_count || 0} data columns.{' '}
                    {d.has_cleaned
                      ? 'Automated data cleaning and validation completed successfully.'
                      : 'Original format preserved.'}
                  </p>

                  <div className="flex items-center gap-2">
                    <Link to={`/eda?datasetId=${d.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-slate-300">
                        <BarChart3 className="w-3 h-3 mr-1 text-purple-400" />
                        Explore Data
                      </Button>
                    </Link>
                    <Link to={`/insights?datasetId=${d.id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs text-slate-300">
                        <Sparkles className="w-3 h-3 mr-1 text-purple-400" />
                        View Insights
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
