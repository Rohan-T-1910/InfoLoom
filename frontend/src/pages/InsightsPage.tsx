import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  InsightReportResponse,
  StructuredInsightFact,
  Dataset,
} from '../types';
import { InsightCard } from '../components/insights/InsightCard';
import { InsightSummaryCards } from '../components/insights/InsightSummaryCards';
import { InsightFilterBar } from '../components/insights/InsightFilterBar';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Sparkles,
  Database,
  BarChart3,
  Layers,
  LineChart,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class InsightsErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Insights error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border border-rose-500/30 bg-rose-950/20 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Unable to display business insights
            </h3>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto mt-1">
              {this.state.error?.message || 'An error occurred while loading business insights.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-rose-200 border-rose-500/30 hover:bg-rose-950/40"
          >
            Reset View
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export const InsightsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Dataset selection state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  // Filter & view state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [includeLLM, setIncludeLLM] = useState<boolean>(false);

  // 1. Fetch user datasets
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const currentDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0] || null;

  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const effectiveId = currentDataset?.id || null;

  // 2. Fetch or generate insights for current dataset
  const {
    data: report,
    isLoading: isLoadingInsights,
    isFetching: isFetchingInsights,
    error: insightsError,
    refetch,
  } = useQuery({
    queryKey: ['dataset-insights', effectiveId, includeLLM],
    queryFn: () =>
      api.getDatasetInsights(effectiveId!, {
        include_llm: includeLLM,
      }),
    enabled: !!effectiveId,
  });

  // Re-generate mutation (force fresh recalculation)
  const generateMutation = useMutation({
    mutationFn: () =>
      api.getDatasetInsights(effectiveId!, {
        refresh: true,
        include_llm: includeLLM,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['dataset-insights', effectiveId, includeLLM], data);
    },
  });

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSearchParams({ datasetId: String(id) });
  };

  const handleRefresh = () => {
    generateMutation.mutate();
  };

  // Client-side filtering & search
  const filteredInsights = useMemo(() => {
    if (!report?.insights) return [];

    return report.insights.filter((f) => {
      // Category filter
      if (selectedCategory !== 'all' && f.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      // Severity filter
      if (selectedSeverity !== 'all' && f.severity.toLowerCase() !== selectedSeverity.toLowerCase()) {
        return false;
      }
      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = f.title.toLowerCase().includes(query);
        const matchesFeature = f.feature.toLowerCase().includes(query);
        const matchesExpl = f.explanation.toLowerCase().includes(query);
        const matchesPolished = f.polished_explanation?.toLowerCase().includes(query) || false;
        return matchesTitle || matchesFeature || matchesExpl || matchesPolished;
      }
      return true;
    });
  }, [report, selectedCategory, selectedSeverity, searchTerm]);

  return (
    <InsightsErrorBoundary>
      <div className="space-y-6">
        {/* Top Header & Dataset Selection */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              Business Insights
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Important findings, high-leverage drivers, and actionable trends discovered from your data.
            </p>
          </div>

          {/* Dataset Selector & Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            {datasets.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Dataset:</span>
                <select
                  value={selectedDatasetId || ''}
                  onChange={(e) => handleDatasetChange(Number(e.target.value))}
                  className="bg-[#0e091b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium transition-colors"
                >
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#0e091b] text-white">
                      {d.original_filename} ({d.row_count} rows)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Link to="/datasets">
                <Button variant="outline" size="sm" className="text-xs">
                  <Database className="w-3.5 h-3.5 mr-1.5" />
                  Upload Dataset
                </Button>
              </Link>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={generateMutation.isPending || isFetchingInsights || !effectiveId}
              className="text-xs text-slate-300"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${generateMutation.isPending || isFetchingInsights ? 'animate-spin' : ''}`}
              />
              Recalculate
            </Button>

            <Link to={`/eda?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Explore Data
              </Button>
            </Link>

            <Link to={`/forecasting?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <LineChart className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Forecasting
              </Button>
            </Link>

            <Link to={`/anomalies?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Anomalies
              </Button>
            </Link>
          </div>
        </div>

        {/* No Datasets Available */}
        {!isLoadingDatasets && datasets.length === 0 && (
          <Card className="border-white/[0.08] bg-[#0c0818]/90 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Upload a dataset to automatically identify important business trends and findings in your data.
            </p>
            <Link to="/datasets">
              <Button size="default" className="bg-purple-600 hover:bg-purple-500 text-white">
                <Database className="w-4 h-4 mr-2" />
                Upload Dataset
              </Button>
            </Link>
          </Card>
        )}

        {/* Main Insights Workspace */}
        {currentDataset && (
          <div className="space-y-6">
            {/* Error Banner */}
            {insightsError && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Unable to load insights for this dataset. Please ensure your dataset contains valid data rows or click Recalculate.
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-xs">
                  Retry
                </Button>
              </div>
            )}

            {/* Loading Skeleton */}
            {isLoadingInsights && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                  ))}
                </div>
                <div className="h-28 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-36 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                  ))}
                </div>
              </div>
            )}

            {/* Report Content */}
            {report && !isLoadingInsights && (
              <div className="space-y-6">
                {/* KPI Summary Cards */}
                <InsightSummaryCards kpi={report.kpi_summary} />

                {/* Filter Bar */}
                <InsightFilterBar
                  categories={report.categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  selectedSeverity={selectedSeverity}
                  onSelectSeverity={setSelectedSeverity}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  includeLLM={includeLLM}
                  onToggleLLM={() => setIncludeLLM(!includeLLM)}
                  onRefresh={handleRefresh}
                  isRefreshing={generateMutation.isPending || isFetchingInsights}
                  totalFilteredCount={filteredInsights.length}
                />

                {/* Insights List */}
                {filteredInsights.length > 0 ? (
                  <div className="space-y-4">
                    {filteredInsights.map((fact) => (
                      <InsightCard key={fact.id} fact={fact} showPolished={includeLLM} />
                    ))}
                  </div>
                ) : (
                  <Card className="border-white/[0.08] bg-[#0c0818]/60 p-12 text-center">
                    <Lightbulb className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-40" />
                    <h4 className="text-sm font-semibold text-white mb-1">
                      No Insights Match Active Filters
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                      Try resetting filters or adjusting search terms to explore findings across other dimensions.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-purple-300 border-purple-500/30"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSelectedSeverity('all');
                        setSearchTerm('');
                      }}
                    >
                      Reset All Filters
                    </Button>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </InsightsErrorBoundary>
  );
};
