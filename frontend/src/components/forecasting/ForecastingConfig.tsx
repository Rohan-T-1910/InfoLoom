import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Dataset,
  ForecastingColumnsResponse,
  ForecastEvaluationResponse,
  ForecastModelResponse,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface ForecastingConfigProps {
  dataset: Dataset;
  onEvaluationComplete: (res: ForecastEvaluationResponse) => void;
  onRunComplete: (model: ForecastModelResponse) => void;
  externalTriggerRun?: boolean;
}

export const ForecastingConfig: React.FC<ForecastingConfigProps> = ({
  dataset,
  onEvaluationComplete,
  onRunComplete,
}) => {
  const [useCleaned, setUseCleaned] = useState<boolean>(true);
  const [selectedDateCol, setSelectedDateCol] = useState<string>('');
  const [selectedTargetCol, setSelectedTargetCol] = useState<string>('');
  const [horizon, setHorizon] = useState<number>(14);
  const [frequency, setFrequency] = useState<string>('auto');
  const [customName, setCustomName] = useState<string>('');

  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch candidate columns for this dataset
  const {
    data: columnsData,
    isLoading: isLoadingColumns,
    error: columnsError,
  } = useQuery<ForecastingColumnsResponse>({
    queryKey: ['forecasting-columns', dataset.id, useCleaned],
    queryFn: () => api.inspectForecastingColumns(dataset.id, useCleaned),
  });

  // Auto-select recommended columns when data loads
  useEffect(() => {
    if (columnsData) {
      if (!selectedDateCol && columnsData.recommended_date_column) {
        setSelectedDateCol(columnsData.recommended_date_column);
      } else if (
        !selectedDateCol &&
        columnsData.datetime_columns &&
        columnsData.datetime_columns.length > 0
      ) {
        setSelectedDateCol(columnsData.datetime_columns[0].name);
      }

      if (!selectedTargetCol && columnsData.recommended_target_column) {
        setSelectedTargetCol(columnsData.recommended_target_column);
      } else if (
        !selectedTargetCol &&
        columnsData.numeric_columns &&
        columnsData.numeric_columns.length > 0
      ) {
        setSelectedTargetCol(columnsData.numeric_columns[0].name);
      }
    }
  }, [columnsData, selectedDateCol, selectedTargetCol]);

  // Handle Backtest Evaluation
  const handleEvaluate = async () => {
    if (!selectedDateCol || !selectedTargetCol) {
      setErrorMessage('Please select both a date/time column and a numeric target column.');
      return;
    }
    setErrorMessage(null);
    setIsEvaluating(true);
    try {
      const res = await api.evaluateForecasting(dataset.id, {
        date_column: selectedDateCol,
        target_column: selectedTargetCol,
        horizon: Number(horizon),
        frequency: frequency === 'auto' ? null : frequency,
        use_cleaned: useCleaned,
      });
      onEvaluationComplete(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to evaluate forecasting backtest.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Full Forecast Run
  const handleRun = async () => {
    if (!selectedDateCol || !selectedTargetCol) {
      setErrorMessage('Please select both a date/time column and a numeric target column.');
      return;
    }
    setErrorMessage(null);
    setIsRunning(true);
    try {
      const model = await api.runForecasting(dataset.id, {
        date_column: selectedDateCol,
        target_column: selectedTargetCol,
        horizon: Number(horizon),
        frequency: frequency === 'auto' ? null : frequency,
        name: customName.trim() || undefined,
        use_cleaned: useCleaned,
      });
      onRunComplete(model);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate time-series forecast.');
    } finally {
      setIsRunning(false);
    }
  };

  const hasDatetime = columnsData?.datetime_columns && columnsData.datetime_columns.length > 0;
  const hasNumeric = columnsData?.numeric_columns && columnsData.numeric_columns.length > 0;
  const totalRows = columnsData?.total_rows || dataset.row_count || 0;
  const isTooSmall = totalRows > 0 && totalRows < 15;

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-base font-semibold text-white">
                Forecast Configuration
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Select date and target columns, choose time resolution, and set your future horizon.
            </CardDescription>
          </div>

          {/* Cleaned vs Raw Toggle */}
          <div className="flex items-center gap-2 bg-[#090514] px-3 py-1.5 rounded-xl border border-white/[0.08]">
            <input
              type="checkbox"
              id="use-cleaned-forecast"
              checked={useCleaned}
              onChange={(e) => setUseCleaned(e.target.checked)}
              className="accent-purple-500 w-3.5 h-3.5 rounded cursor-pointer"
            />
            <label
              htmlFor="use-cleaned-forecast"
              className="text-xs text-slate-300 cursor-pointer select-none font-medium"
            >
              Use Cleaned Data
            </label>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Error / Warning Alerts */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isTooSmall && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              This dataset only has <strong>{totalRows}</strong> rows. Reliable time-series modeling requires at least 15 chronological observations.
            </span>
          </div>
        )}

        {!isLoadingColumns && !hasDatetime && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              No parseable date/timestamp columns found in this dataset. Make sure your dates are formatted as ISO 8601 (e.g. YYYY-MM-DD) or common timestamp representations.
            </span>
          </div>
        )}

        {/* Input Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Date Column */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Date / Time Column
            </label>
            <select
              value={selectedDateCol}
              onChange={(e) => setSelectedDateCol(e.target.value)}
              disabled={isLoadingColumns || !hasDatetime}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select date column...</option>
              {columnsData?.datetime_columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.non_null_count} valid dates)
                </option>
              ))}
            </select>
            {columnsData?.recommended_date_column && (
              <span className="text-[10px] text-purple-400 font-mono">
                Suggested: {columnsData.recommended_date_column}
              </span>
            )}
          </div>

          {/* 2. Target Column */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Numeric Target Column
            </label>
            <select
              value={selectedTargetCol}
              onChange={(e) => setSelectedTargetCol(e.target.value)}
              disabled={isLoadingColumns || !hasNumeric}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select target value...</option>
              {columnsData?.numeric_columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.non_null_count} rows)
                </option>
              ))}
            </select>
            {columnsData?.recommended_target_column && (
              <span className="text-[10px] text-cyan-400 font-mono">
                Suggested: {columnsData.recommended_target_column}
              </span>
            )}
          </div>

          {/* 3. Horizon */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Forecast Horizon
              </label>
              <span className="text-xs font-mono font-bold text-white bg-white/[0.06] px-2 py-0.5 rounded">
                {horizon} steps
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 step</span>
              <span>30 steps</span>
              <span>60 steps</span>
            </div>
          </div>

          {/* 4. Frequency */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Temporal Resolution
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              <option value="auto">Auto-Detect Cadence</option>
              <option value="D">Daily (D)</option>
              <option value="h">Hourly (h)</option>
              <option value="W">Weekly (W)</option>
              <option value="M">Monthly (M)</option>
              <option value="B">Business Days (B)</option>
            </select>
            <span className="text-[10px] text-slate-400">
              Duplicates averaged, gaps regularized
            </span>
          </div>
        </div>

        {/* Model Name & Action Bar */}
        <div className="pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-sm">
            <input
              type="text"
              placeholder={`Forecast Name (e.g. ${selectedTargetCol || 'Sales'} Projection)`}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={isEvaluating || isRunning || !selectedDateCol || !selectedTargetCol || isTooSmall}
              className="text-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-purple-400 ${isEvaluating ? 'animate-spin' : ''}`} />
              {isEvaluating ? 'Testing Accuracy...' : 'Test Accuracy'}
            </Button>

            <Button
              variant="glow"
              size="sm"
              onClick={handleRun}
              disabled={isRunning || isEvaluating || !selectedDateCol || !selectedTargetCol || isTooSmall}
              className="text-xs"
            >
              <Play className={`w-3.5 h-3.5 mr-1.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
              {isRunning ? 'Generating Forecast...' : 'Generate Forecast'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
