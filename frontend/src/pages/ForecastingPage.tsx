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
  Layers,
} from 'lucide-react';

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
    setSearchParams({ datasetId: String(id) });
  };

  const handleEvaluationComplete = (res: ForecastEvaluationResponse) => {
    setEvaluationResult(res);
  };

  const handleRunComplete = (model: ForecastModelResponse) => {
    setSelectedModelId(model.id);
    setEvaluationResult(null);
    queryClient.invalidateQueries({ queryKey: ['dataset-forecast-models', effectiveId] });
  };

  const handleProceedToForecast = async () => {
    if (!evaluationResult || !effectiveId) return;
    setIsTrainingFromEval(true);
    try {
      const model = await api.runForecasting(effectiveId, {
        date_column: evaluationResult.date_column,
        target_column: evaluationResult.target_column,
        horizon: evaluationResult.horizon,
        frequency: evaluationResult.frequency === 'auto' ? null : evaluationResult.frequency,
      });
      handleRunComplete(model);
    } catch (err: any) {
      alert(err.message || 'Failed to fit forecasting model.');
    } finally {
      setIsTrainingFromEval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">
              Phase 6 • Predictive Analytics
            </span>
            <Badge variant="purple" className="text-[10px]">
              Time Series Forecasting
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            Time Series Forecasting Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Chronological ARIMA estimation, zero-leakage rolling backtests, MAPE diagnostics, and future trajectory projections with 95% confidence bounds.
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
            onClick={() => refetchModels()}
            disabled={isFetchingModels || !effectiveId}
            className="text-xs"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${isFetchingModels ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <Link to={`/eda?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-slate-300">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              EDA
            </Button>
          </Link>

          <Link to={`/models?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-slate-300">
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              Supervised ML
            </Button>
          </Link>

          <Link to={`/clustering?datasetId=${effectiveId}`}>
            <Button variant="outline" size="sm" className="text-xs text-slate-300">
              <Network className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              Clustering
            </Button>
          </Link>
        </div>
      </div>

      {/* No Datasets Empty State */}
      {!isLoadingDatasets && datasets.length === 0 && (
        <Card className="border-white/[0.08] bg-[#0c0818]/90 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Datasets Available</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Upload a time-series dataset containing a date/time column and numeric values to fit forecasting models and project future intervals.
          </p>
          <Link to="/datasets">
            <Button variant="glow" size="default">
              <Database className="w-4 h-4 mr-2" />
              Upload First Dataset
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

          {/* Step 2: Backtest Evaluation Diagnostics (if evaluated) */}
          {evaluationResult && (
            <ForecastEvaluationCard
              evaluation={evaluationResult}
              onProceedToForecast={handleProceedToForecast}
              isTraining={isTrainingFromEval}
            />
          )}

          {/* Step 3: Active Forecast Results & Visualizer */}
          {detailedModel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <h3 className="text-base font-semibold text-white">
                    Active Forecast Model: {detailedModel.name}
                  </h3>
                  <Badge variant="purple" className="text-[10px]">
                    ARIMA({detailedModel.model_order.join(', ')})
                  </Badge>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {new Date(detailedModel.created_at).toLocaleString()}
                </span>
              </div>

              {/* Metrics Breakdown (MAPE, RMSE, MAE, Directional Trend) */}
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
                horizon={detailedModel.horizon}
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
        </div>
      )}
    </div>
  );
};
