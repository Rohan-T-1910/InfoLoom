import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Database,
  BarChart3,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Cpu,
  Network,
  CheckCircle2,
  Upload,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { data: datasetsData, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const cleanedCount = datasets.filter((d) => d.has_cleaned).length;
  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-purple-950/40 via-[#0e091b] to-[#080512] p-8 backdrop-blur-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous AI Data Intelligence</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            InfoLoom Control Center
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Autonomous ingestion, rigorous statistical validation, automated data cleaning pipelines, and
            deep exploratory data analysis with baseline machine learning feature importances.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/eda">
              <Button variant="glow" size="default">
                <BarChart3 className="w-4 h-4 mr-2" />
                Launch EDA Engine
              </Button>
            </Link>
            <Link to="/models">
              <Button variant="outline" size="default">
                <Cpu className="w-4 h-4 mr-2 text-purple-400" />
                Train ML Models
              </Button>
            </Link>
            <Link to="/clustering">
              <Button variant="outline" size="default">
                <Network className="w-4 h-4 mr-2 text-purple-400" />
                Segmentation
              </Button>
            </Link>
            <Link to="/datasets">
              <Button variant="outline" size="default">
                <Upload className="w-4 h-4 mr-2" />
                Manage Datasets
              </Button>
            </Link>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Ingested Datasets</span>
            <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{isLoading ? '...' : datasets.length}</div>
          <div className="text-xs text-slate-400 mt-1">Multi-tenant storage</div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Cleaned Pipelines</span>
            <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{isLoading ? '...' : cleanedCount}</div>
          <div className="text-xs text-slate-400 mt-1">
            {datasets.length > 0 ? `${Math.round((cleanedCount / datasets.length) * 100)}% cleaned` : '0%'}
          </div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Total Data Records</span>
            <div className="p-2 rounded-lg bg-indigo-950/50 text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{isLoading ? '...' : totalRows.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Active rows in system</div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Phase 6 Status</span>
            <div className="p-2 rounded-lg bg-cyan-950/50 text-cyan-400">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-cyan-400">Forecasting Active</div>
          <div className="text-xs text-slate-400 mt-1">ARIMA + Backtesting Ready</div>
        </Card>
      </div>

      {/* Recent Datasets Table */}
      <Card className="border border-white/[0.08] bg-[#0c0818]/90">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/[0.06]">
          <div>
            <CardTitle className="text-base font-semibold text-white">Your Datasets</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Access exploratory analysis, validation audits, and cleaned pipelines
            </CardDescription>
          </div>
          <Link to="/datasets">
            <Button variant="ghost" size="sm" className="text-xs text-purple-300">
              View All Datasets
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No datasets uploaded yet. Upload a dataset to begin exploratory data analysis.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#120c24] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-3">Dimensions</th>
                    <th className="py-3 px-3">File Size</th>
                    <th className="py-3 px-3">Cleaning Status</th>
                    <th className="py-3 px-3">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {datasets.slice(0, 5).map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-purple-400" />
                          <span>{d.original_filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        {d.row_count || 0} × {d.column_count || 0}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        {(d.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3.5 px-3">
                        <Badge variant={d.has_cleaned ? 'success' : 'secondary'} className="text-[10px]">
                          {d.has_cleaned ? 'Cleaned' : 'Raw'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/forecasting?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-cyan-300 hover:text-white">
                              <TrendingUp className="w-3 h-3 mr-1 text-cyan-400" />
                              Forecast
                            </Button>
                          </Link>
                          <Link to={`/models?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-purple-300 hover:text-white">
                              <Cpu className="w-3 h-3 mr-1 text-purple-400" />
                              Train ML
                            </Button>
                          </Link>
                          <Link to={`/eda?datasetId=${d.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <BarChart3 className="w-3 h-3 mr-1 text-purple-400" />
                              Analyze EDA
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
