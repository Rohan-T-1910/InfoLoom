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
  Sparkles,
  AlertTriangle,
  Play,
  Clock,
  ChevronDown,
  Sliders,
} from 'lucide-react';

interface ForecastingConfigProps {
  dataset: Dataset;
  onEvaluationComplete: (res: ForecastEvaluationResponse) => void;
  onRunComplete: (model: ForecastModelResponse) => void;
}

export const ForecastingConfig: React.FC<ForecastingConfigProps> = ({
  dataset,
  onEvaluationComplete,
  onRunComplete,
}) => {
  const [selectedTargetCol, setSelectedTargetCol] = useState<string>('');
  const [selectedDateCol, setSelectedDateCol] = useState<string>('');
  const [horizon, setHorizon] = useState<number>(14);
  const [frequency, setFrequency] = useState<string>('auto');
  const [customName, setCustomName] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch candidate columns
  const {
    data: columnsData,
    isLoading: isLoadingColumns,
  } = useQuery<ForecastingColumnsResponse>({
    queryKey: ['forecasting-columns', dataset.id],
    queryFn: () => api.inspectForecastingColumns(dataset.id, true),
  });

  const dateColumns = columnsData?.datetime_columns || columnsData?.date_columns || [];
  const numericColumns = columnsData?.numeric_columns || [];
  const hasDateCols = dateColumns.length > 0;
  const hasNumericCols = numericColumns.length > 0;

  // Auto-select recommended columns
  useEffect(() => {
    if (columnsData) {
      if (!selectedDateCol && columnsData.recommended_date_column) {
        setSelectedDateCol(columnsData.recommended_date_column);
      } else if (!selectedDateCol && dateColumns.length > 0) {
        setSelectedDateCol(dateColumns[0].name);
      }

      if (!selectedTargetCol && columnsData.recommended_target_column) {
        setSelectedTargetCol(columnsData.recommended_target_column);
      } else if (!selectedTargetCol && numericColumns.length > 0) {
        const priorityTarget = numericColumns.find((c) =>
          /amount|total|sales|revenue|quantity|price/i.test(c.name)
        );
        setSelectedTargetCol(priorityTarget ? priorityTarget.name : numericColumns[0].name);
      }
    }
  }, [columnsData, selectedDateCol, selectedTargetCol, dateColumns, numericColumns]);

  // Handle Historical Backtest Test
  const handleEvaluate = async () => {
    if (!selectedDateCol || !selectedTargetCol) {
      setErrorMessage('Please select what you want to forecast and which date column to use.');
      return;
    }
    setErrorMessage(null);
    setIsEvaluating(true);
    try {
      const res = await api.evaluateForecasting(dataset.id, {
        date_column: selectedDateCol,
        target_column: selectedTargetCol,
        horizon: Number(horizon),
        forecast_horizon: Number(horizon),
        frequency: frequency === 'auto' ? null : frequency,
        use_cleaned: true,
      });
      onEvaluationComplete(res);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to check historical accuracy. Please check column selections.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Generate Forecast
  const handleRun = async () => {
    if (!selectedDateCol || !selectedTargetCol) {
      setErrorMessage('Please select what you want to forecast and which date column to use.');
      return;
    }
    setErrorMessage(null);
    setIsRunning(true);
    try {
      const model = await api.runForecasting(dataset.id, {
        date_column: selectedDateCol,
        target_column: selectedTargetCol,
        horizon: Number(horizon),
        forecast_horizon: Number(horizon),
        frequency: frequency === 'auto' ? null : frequency,
        name: customName.trim() || `${selectedTargetCol} Forecast (${horizon} periods)`,
        use_cleaned: true,
      });
      onRunComplete(model);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to generate forecast for the selected series.');
    } finally {
      setIsRunning(false);
    }
  };

  const totalRows = columnsData?.total_rows || dataset.row_count || 0;
  const isTooSmall = totalRows > 0 && totalRows < 10;

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden shadow-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-base font-semibold text-white">
                Forecast Setup
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Select what to forecast, choose the timeline, and specify how far ahead to project.
            </CardDescription>
          </div>
          <Badge variant="purple" className="text-[11px] self-start sm:self-auto">
            {dataset.original_filename} ({totalRows.toLocaleString()} rows)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Error / Warning Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Setup Notice</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {isTooSmall && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              This dataset has only <strong>{totalRows}</strong> rows. Reliable forecasts generally require at least 15 chronological records.
            </span>
          </div>
        )}

        {!isLoadingColumns && !hasDateCols && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              No recognized date or timestamp columns found in this dataset. Please ensure dates are in standard formats (e.g. YYYY-MM-DD).
            </span>
          </div>
        )}

        {/* 3 Core Business Questions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Question 1: What are you forecasting? */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              What are you forecasting?
            </label>
            <p className="text-[11px] text-slate-400">
              The business measure you want to estimate into the future.
            </p>
            <select
              value={selectedTargetCol}
              onChange={(e) => setSelectedTargetCol(e.target.value)}
              disabled={isLoadingColumns || !hasNumericCols}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select business metric...</option>
              {numericColumns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            {columnsData?.recommended_target_column && (
              <span className="text-[10px] text-cyan-400 block">
                Recommended: {columnsData.recommended_target_column}
              </span>
            )}
          </div>

          {/* Question 2: Which timeline should we use? */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-400" />
              Which timeline should we use?
            </label>
            <p className="text-[11px] text-slate-400">
              The date column that defines your chronological order.
            </p>
            <select
              value={selectedDateCol}
              onChange={(e) => setSelectedDateCol(e.target.value)}
              disabled={isLoadingColumns || !hasDateCols}
              className="w-full bg-[#090514] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
            >
              <option value="">Select date column...</option>
              {dateColumns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.non_null_count || totalRows} recorded dates)
                </option>
              ))}
            </select>
            {columnsData?.recommended_date_column && (
              <span className="text-[10px] text-purple-400 block">
                Recommended: {columnsData.recommended_date_column}
              </span>
            )}
          </div>

          {/* Question 3: How far ahead? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                How far ahead?
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                {horizon} periods
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Choose how many future periods to project.
            </p>
            {/* Quick preset buttons: 7 / 14 / 30 / 60 */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[7, 14, 30, 60].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setHorizon(preset)}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                    horizon === preset
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold shadow-sm shadow-cyan-950/50'
                      : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {preset} periods
                </button>
              ))}
            </div>
            <input
              type="range"
              min={1}
              max={60}
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer pt-2"
            />
          </div>
        </div>

        {/* Collapsible Additional Options (Out of main visual flow) */}
        <div className="pt-2 border-t border-white/[0.04]">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>Additional Options</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Time Interval</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="auto">Auto-Detect Interval</option>
                  <option value="D">Daily</option>
                  <option value="W">Weekly</option>
                  <option value="M">Monthly</option>
                  <option value="h">Hourly</option>
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Aligns records into regular business calendar buckets.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-300 font-medium">Forecast Name (Optional)</label>
                <input
                  type="text"
                  placeholder={`e.g. ${selectedTargetCol || 'Sales'} Projection`}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full bg-[#090514] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  Name used to identify this run in previous forecasts.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {selectedTargetCol && selectedDateCol ? (
              <span>
                Ready to project <strong className="text-white">{selectedTargetCol}</strong> over next{' '}
                <strong className="text-cyan-400">{horizon} periods</strong>.
              </span>
            ) : (
              'Select what to forecast and your timeline above to proceed.'
            )}
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={isEvaluating || isRunning || !selectedDateCol || !selectedTargetCol || isTooSmall}
              className="text-xs text-slate-300 hover:text-white"
            >
              <Sparkles className={`w-3.5 h-3.5 mr-1.5 text-purple-400 ${isEvaluating ? 'animate-spin' : ''}`} />
              {isEvaluating ? 'Testing...' : 'Check Historical Accuracy'}
            </Button>

            <Button
              variant="glow"
              size="sm"
              onClick={handleRun}
              disabled={isRunning || isEvaluating || !selectedDateCol || !selectedTargetCol || isTooSmall}
              className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-md shadow-cyan-950/40"
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
