import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { EDAKPIs } from '../components/eda/EDAKPIs';
import { EDASummaryStats } from '../components/eda/EDASummaryStats';
import { EDACorrelationMatrix } from '../components/eda/EDACorrelationMatrix';
import { EDADistributions } from '../components/eda/EDADistributions';
import { EDAFeatureImportance } from '../components/eda/EDAFeatureImportance';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  BarChart3,
  RefreshCw,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Cpu,
} from 'lucide-react';

export const EDAPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );
  const [useCleaned, setUseCleaned] = useState<boolean>(true);
  const [targetColumn, setTargetColumn] = useState<string | null>(null);

  // 1. Fetch available datasets for the user
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;

  // Sync selectedDatasetId if null and datasets exist
  React.useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  // 2. Fetch full EDA report
  const effectiveId = currentDataset?.id || null;

  const {
    data: edaData,
    isLoading: isLoadingEDA,
    isError: isEDAError,
    error: edaError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['eda', effectiveId, useCleaned, targetColumn],
    queryFn: () =>
      api.getEDA(effectiveId!, {
        target_column: targetColumn,
        use_cleaned: useCleaned,
      }),
    enabled: !!effectiveId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // 3. Force Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () =>
      api.refreshEDA(effectiveId!, {
        target_column: targetColumn,
        use_cleaned: useCleaned,
      }),
    onSuccess: (newData) => {
      queryClient.setQueryData(['eda', effectiveId, useCleaned, targetColumn], newData);
    },
  });

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setTargetColumn(null);
    setSearchParams({ datasetId: String(id) });
  };

  const handleTargetChange = (newTarget: string) => {
    setTargetColumn(newTarget);
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-purple-400" />
              <span>Explore Your Data</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Explore trends, relationships, and the overall structure of your dataset.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Dataset Selector */}
          {datasets.length > 0 && (
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <select
                value={selectedDatasetId || ''}
                onChange={(e) => handleDatasetChange(parseInt(e.target.value, 10))}
                className="bg-slate-900 border border-white/10 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename} ({d.row_count || 0} rows)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cleaned vs Raw Toggle */}
          {currentDataset?.has_cleaned && (
            <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => setUseCleaned(true)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  useCleaned ? 'bg-purple-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cleaned Data
              </button>
              <button
                onClick={() => setUseCleaned(false)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  !useCleaned ? 'bg-purple-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Original Data
              </button>
            </div>
          )}

          {/* Force Refresh & Modeling Shortcuts */}
          {effectiveId && (
            <div className="flex items-center gap-2">
              <Link to={`/models?datasetId=${effectiveId}`}>
                <Button variant="glow" size="sm" className="text-xs h-9">
                  <Cpu className="w-3.5 h-3.5 mr-1.5" />
                  Predictive Modeling
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending || isFetching}
                className="text-xs h-9"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshMutation.isPending || isFetching ? 'animate-spin' : ''}`} />
                Refresh Analysis
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cache Status Badge */}
      {edaData && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.06] bg-black/40 text-xs">
          <div className="flex items-center gap-2">
            {edaData.cached ? (
              <>
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300">
                  Loaded from <strong className="text-purple-300">saved analysis</strong>
                </span>
                {edaData.created_at && (
                  <span className="text-slate-500 font-mono text-[11px]">
                    ({new Date(edaData.created_at).toLocaleTimeString()})
                  </span>
                )}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">Computed in real time</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Dataset:</span>
            <span className="font-semibold text-slate-200">{currentDataset?.original_filename}</span>
            <Badge variant={edaData.is_cleaned ? 'success' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {edaData.is_cleaned ? 'Cleaned Data' : 'Original Data'}
            </Badge>
          </div>
        </div>
      )}

      {/* Loading State */}
      {(isLoadingDatasets || isLoadingEDA) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      )}

      {/* Empty State: No Datasets Uploaded */}
      {!isLoadingDatasets && datasets.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-[#0c0818]/60 max-w-xl mx-auto my-12">
          <Database className="w-12 h-12 text-purple-400 mx-auto mb-4 opacity-70" />
          <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Upload a dataset to start exploring your data and discovering useful patterns.
          </p>
          <Link to="/datasets">
            <Button variant="glow" size="default">
              Upload Dataset
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}

      {/* Error State */}
      {isEDAError && (
        <div className="p-8 rounded-xl border border-rose-500/30 bg-rose-950/20 text-center max-w-xl mx-auto my-8">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-rose-200 mb-1">Failed to compute EDA</h3>
          <p className="text-xs text-slate-300 mb-4">
            {(edaError as Error)?.message || 'An unexpected error occurred during statistical calculation.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try Again
          </Button>
        </div>
      )}

      {/* EDA Main Dashboard Content: Single Coherent Scrollable View */}
      {!isLoadingEDA && edaData && (
        <div className="space-y-6">
          {/* A. Dataset Health / Overview */}
          <EDAKPIs
            kpis={edaData.kpis}
            isCleaned={edaData.is_cleaned}
            cached={edaData.cached}
            createdAt={edaData.created_at}
          />

          {/* B. What Stands Out: Key Relationships & Patterns */}
          <EDACorrelationMatrix correlations={edaData.correlation_matrix} />

          {/* C. Dataset Fields & Column Overview */}
          <EDASummaryStats stats={edaData.summary_statistics} />

          {/* D. Field Value Distribution */}
          <EDADistributions distributions={edaData.distributions} />

          {/* E. What Influences the Outcome? */}
          <EDAFeatureImportance
            featureImportance={edaData.feature_importance}
            onTargetChange={handleTargetChange}
            isLoading={isFetching}
          />
        </div>
      )}
    </div>
  );
};
