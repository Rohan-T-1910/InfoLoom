import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  ForecastEvaluationResponse,
  ForecastModelResponse,
  Dataset,
} from '../types';
import { ForecastingConfig } from '../components/forecasting/ForecastingConfig';
import { ForecastEvaluationCard } from '../components/forecasting/ForecastEvaluationCard';
import { ForecastChartCard } from '../components/forecasting/ForecastChartCard';
import { ForecastMetricsCard } from '../components/forecasting/ForecastMetricsCard';
import { ForecastingHistoryList } from '../components/forecasting/ForecastingHistoryList';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  TrendingUp,
  Database,
  BarChart3,
  Cpu,
  Network,
  RefreshCw,
  Sparkles,
  Calendar,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ForecastingErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Forecasting render error caught by boundary:', error, errorInfo);
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
              Unable to display this forecast
            </h3>
            <p className="text-xs text-rose-300/80 max-w-md mx-auto mt-1">
              {this.state.error?.message || 'An error occurred while formatting the forecast display.'}
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

export const ForecastingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  const [evaluationResult, setEvaluationResult] = useState<ForecastEvaluationResponse | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [isTrainingFromEval, setIsTrainingFromEval] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // 2. Fetch past forecasting models for current dataset
  const {
    data: modelsSummary = [],
    isLoading: isLoadingModels,
    refetch: refetchModels,
    isFetching: isFetchingModels,
  } = useQuery({
    queryKey: ['dataset-forecast-models', effectiveId],
    queryFn: () => api.listDatasetForecastModels(effectiveId!),
    enabled: !!effectiveId,
  });

  // Automatically select the most recent model if none is explicitly selected
  useEffect(() => {
    if (modelsSummary.length > 0 && !selectedModelId) {
      setSelectedModelId(modelsSummary[0].id);
    }
  }, [modelsSummary, selectedModelId]);

  // 3. Fetch detailed model data if a model is selected
  const { data: detailedModel, isLoading: isLoadingDetailedModel } = useQuery({
    queryKey: ['forecast-model-detail', selectedModelId],
    queryFn: () => api.getForecastModel(selectedModelId!),
    enabled: !!selectedModelId,
  });

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSelectedModelId(null);
    setEvaluationResult(null);
    setActionError(null);
    setSearchParams({ datasetId: String(id) });
  };

  const handleEvaluationComplete = (res: ForecastEvaluationResponse) => {
    setEvaluationResult(res);
    setActionError(null);
  };

  const handleRunComplete = (model: ForecastModelResponse) => {
    setSelectedModelId(model.id);
    setEvaluationResult(null);
    setActionError(null);
    queryClient.invalidateQueries({ queryKey: ['dataset-forecast-models', effectiveId] });
  };

  const handleProceedToForecast = async () => {
    if (!evaluationResult || !effectiveId) return;
    setIsTrainingFromEval(true);
    setActionError(null);
    try {
      const model = await api.runForecasting(effectiveId, {
        date_column: evaluationResult.date_column,
        target_column: evaluationResult.target_column,
        horizon: evaluationResult.horizon ?? evaluationResult.validation_horizon ?? 14,
        forecast_horizon: evaluationResult.horizon ?? evaluationResult.validation_horizon ?? 14,
        frequency: evaluationResult.frequency === 'auto' ? null : evaluationResult.frequency,
      });
      handleRunComplete(model);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to generate future forecast.');
    } finally {
      setIsTrainingFromEval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              Forecasting
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Estimate future numbers, seasonal demand, and performance trends based on historical timelines.
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
                  className="bg-[#0e091b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium transition-colors"
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
              onClick={() => refetchModels()}
              disabled={isFetchingModels || !effectiveId}
              className="text-xs text-slate-300"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>

            <Link to={`/eda?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Explore Data
              </Button>
            </Link>

            <Link to={`/insights?datasetId=${effectiveId}`}>
              <Button variant="outline" size="sm" className="text-xs text-slate-300">
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Business Insights
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Action Error Alert */}
        {actionError && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActionError(null)}
              className="h-7 text-xs text-rose-300 hover:text-white"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* No Datasets Empty State */}
        {!isLoadingDatasets && datasets.length === 0 && (
          <Card className="border-white/[0.08] bg-[#0c0817]/90 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Upload a dataset containing date and numeric columns to estimate future trends.
            </p>
            <Link to="/datasets">
              <Button variant="glow" size="default">
                <Database className="w-4 h-4 mr-2" />
                Upload Dataset
              </Button>
            </Link>
          </Card>
        )}

        {/* Main Forecasting Workspace */}
        {currentDataset && (
          <div className="space-y-6">
            {/* Step 1: Configuration Form */}
            <ForecastingConfig
              dataset={currentDataset}
              onEvaluationComplete={handleEvaluationComplete}
              onRunComplete={handleRunComplete}
            />

            {/* Step 2: Historical Accuracy Evaluation (if evaluated) */}
            {evaluationResult && (
              <ForecastEvaluationCard
                evaluation={evaluationResult}
                onProceedToForecast={handleProceedToForecast}
                isTraining={isTrainingFromEval}
              />
            )}

            {/* Step 3: Active Forecast Results & Visualizer */}
            <ForecastingErrorBoundary>
              {isLoadingDetailedModel && (
                <Card className="border border-white/[0.08] bg-[#0c0818]/60 p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading forecast projection...</p>
                </Card>
              )}

              {detailedModel && !isLoadingDetailedModel && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <h3 className="text-base font-semibold text-white">
                        Active Forecast: {detailedModel.name && !detailedModel.name.startsWith('ARIMA(') ? detailedModel.name : `${detailedModel.target_column} Forecast (${detailedModel.horizon ?? detailedModel.forecast_horizon ?? 14} Periods)`}
                      </h3>
                      <Badge variant="purple" className="text-[10px]">
                        {detailedModel.horizon ?? detailedModel.forecast_horizon ?? 14} Periods Ahead
                      </Badge>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(detailedModel.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Metrics Breakdown (Business Summary: Direction, Period, Expected Range, Reliability) */}
                  <ForecastMetricsCard
                    metrics={detailedModel.metrics}
                    modelOrder={detailedModel.model_order}
                    modelType={detailedModel.model_type}
                    aic={detailedModel.aic}
                    bic={detailedModel.bic}
                    frequency={detailedModel.frequency}
                    dateMin={detailedModel.date_min}
                    dateMax={detailedModel.date_max}
                    totalObservations={detailedModel.total_observations}
                    horizon={detailedModel.horizon ?? detailedModel.forecast_horizon}
                    forecastPoints={detailedModel.forecast_points}
                  />

                  {/* Full Interactive Chart */}
                  <ForecastChartCard model={detailedModel} />
                </div>
              )}

              {/* Step 4: Forecasting History */}
              <ForecastingHistoryList
                models={modelsSummary}
                selectedModelId={selectedModelId}
                onSelectModel={setSelectedModelId}
                datasetId={currentDataset.id}
              />
            </ForecastingErrorBoundary>
          </div>
        )}
      </div>
  );
};
