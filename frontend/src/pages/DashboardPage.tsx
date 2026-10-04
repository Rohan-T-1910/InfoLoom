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
  ShieldAlert,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { data: datasetsData, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['registeredModels'],
    queryFn: () => api.listRegisteredModels({ limit: 100 }),
  });

  const datasets = datasetsData?.items || [];
  const totalRows = datasets.reduce((acc, d) => acc + (d.row_count || 0), 0);
  const modelsCount = modelsData?.total ?? modelsData?.items?.length ?? 0;

  return (
    <div className="space-y-8 w-full min-w-0">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-purple-950/40 via-[#0e091b] to-[#080512] p-6 sm:p-8 backdrop-blur-xl w-full">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Data Intelligence & Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Welcome to InfoLoom
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Explore trends, build predictive models, discover customer segments, identify anomalies, and create executive reports from your data.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <Link to="/eda">
              <Button variant="glow" size="default">
                <BarChart3 className="w-4 h-4 mr-2" />
                Explore Data
              </Button>
            </Link>
            <Link to="/models">
              <Button variant="outline" size="default">
                <Cpu className="w-4 h-4 mr-2 text-purple-400" />
                Predictive Modeling
              </Button>
            </Link>
            <Link to="/clustering">
              <Button variant="outline" size="default">
                <Network className="w-4 h-4 mr-2 text-purple-400" />
                Segmentation
              </Button>
            </Link>
            <Link to="/reports">
              <Button variant="outline" size="default">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-purple-400" />
                Reports & Exports
              </Button>
            </Link>
            <Link to="/datasets">
              <Button variant="outline" size="default">
                <Upload className="w-4 h-4 mr-2" />
                Upload Dataset
              </Button>
            </Link>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Datasets</span>
            <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{isLoading ? '...' : datasets.length}</div>
          <div className="text-xs text-slate-400 mt-1">Uploaded datasets</div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Records Analyzed</span>
            <div className="p-2 rounded-lg bg-indigo-950/50 text-indigo-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{isLoading ? '...' : totalRows.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Total data records</div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Models Created</span>
            <div className="p-2 rounded-lg bg-purple-950/50 text-purple-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{modelsLoading ? '...' : modelsCount}</div>
          <div className="text-xs text-slate-400 mt-1">Trained predictive models</div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Insights Available</span>
            <div className="p-2 rounded-lg bg-emerald-950/50 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {datasets.length > 0 ? 'Active' : '0'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {datasets.length > 0 ? 'Automated key findings' : 'Upload data to generate'}
          </div>
        </Card>

        <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-400 font-medium">Reports Generated</span>
            <div className="p-2 rounded-lg bg-cyan-950/50 text-cyan-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {datasets.length > 0 ? 'Ready' : '0'}
          </div>
          <div className="text-xs text-slate-400 mt-1">PDF & CSV exports</div>
        </Card>
      </div>

      {/* Recent Datasets Table */}
      <Card className="border border-white/[0.08] bg-[#0c0818]/90 w-full min-w-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-white/[0.06]">
          <div>
            <CardTitle className="text-base font-semibold text-white">Your Datasets</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              View, explore, and analyze your uploaded data files
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
              No datasets uploaded yet. Upload a dataset to start exploring your data and discovering useful patterns.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#120c24] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-3">Dimensions</th>
                    <th className="py-3 px-3">File Size</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {datasets.slice(0, 5).map((d) => (
                    <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={d.original_filename}>{d.original_filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {d.row_count || 0} × {d.column_count || 0}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {(d.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge variant={d.has_cleaned ? 'success' : 'secondary'} className="text-[10px]">
                          {d.has_cleaned ? 'Cleaned' : 'Raw'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-xl ml-auto">
                          <Link to={`/insights?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-purple-300 hover:text-white">
                              <Sparkles className="w-3 h-3 mr-1 text-purple-400" />
                              Insights
                            </Button>
                          </Link>
                          <Link to={`/anomalies?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-300 hover:text-white">
                              <ShieldAlert className="w-3 h-3 mr-1 text-rose-400" />
                              Anomalies
                            </Button>
                          </Link>
                          <Link to={`/forecasting?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-cyan-300 hover:text-white">
                              <TrendingUp className="w-3 h-3 mr-1 text-cyan-400" />
                              Forecast
                            </Button>
                          </Link>
                          <Link to={`/models?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-purple-300 hover:text-white">
                              <Cpu className="w-3 h-3 mr-1 text-purple-400" />
                              Build Model
                            </Button>
                          </Link>
                          <Link to={`/registry?datasetId=${d.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-indigo-300 hover:text-white">
                              <Layers className="w-3 h-3 mr-1 text-indigo-400" />
                              Models
                            </Button>
                          </Link>
                          <Link to={`/eda?datasetId=${d.id}`}>
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                              <BarChart3 className="w-3 h-3 mr-1 text-purple-400" />
                              Explore Data
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
