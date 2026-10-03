import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../../lib/chartSetup';
import {
  ForecastModelResponse,
  TimeSeriesPoint,
  FutureForecastPoint,
  ForecastBacktestPoint,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Eye,
  Table as TableIcon,
  LineChart as LineChartIcon,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';

interface ForecastChartCardProps {
  model: ForecastModelResponse;
}

type ViewMode = 'all' | 'future' | 'backtest' | 'table';

export const ForecastChartCard: React.FC<ForecastChartCardProps> = ({ model }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const historical = model.historical_points || [];
  const future = model.forecast_points || [];
  const backtest = model.backtest_points || [];

  // Export forecast CSV
  const handleExportCSV = () => {
    if (!future.length) return;
    const headers = ['Timestamp', 'Forecast', 'Lower_95_CI', 'Upper_95_CI'];
    const rows = future.map((f) => [
      f.timestamp,
      f.forecast.toFixed(4),
      f.lower_ci.toFixed(4),
      f.upper_ci.toFixed(4),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${model.name.replace(/\s+/g, '_')}_forecast_${model.horizon}steps.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date helper
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      if (model.frequency === 'h') {
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return iso;
    }
  };

  // Prepare Chart Data based on current viewMode
  const chartData = useMemo(() => {
    if (viewMode === 'future') {
      // Future Forecast Only
      const labels = future.map((f) => formatDate(f.timestamp));
      return {
        labels,
        datasets: [
          {
            label: 'Upper 95% Confidence Bound',
            data: future.map((f) => f.upper_ci),
            borderColor: 'rgba(56, 189, 248, 0.3)',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
            fill: '+1', // Fill down to Lower CI
            tension: 0.2,
          },
          {
            label: 'Lower 95% Confidence Bound',
            data: future.map((f) => f.lower_ci),
            borderColor: 'rgba(56, 189, 248, 0.3)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
            fill: false,
            tension: 0.2,
          },
          {
            label: 'Forecast Projected Values',
            data: future.map((f) => f.forecast),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.4)',
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            tension: 0.2,
          },
        ],
      };
    }

    if (viewMode === 'backtest') {
      // Backtest Holdout View
      const labels = backtest.map((b) => formatDate(b.timestamp));
      return {
        labels,
        datasets: [
          {
            label: 'Actual Ground Truth',
            data: backtest.map((b) => b.actual),
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#fff',
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.2,
          },
          {
            label: 'Backtest Prediction',
            data: backtest.map((b) => b.predicted),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#fff',
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.2,
          },
        ],
      };
    }

    // Default 'all': Historical + Future
    // We concatenate historical dates and future dates
    const allLabels: string[] = [
      ...historical.map((h) => formatDate(h.timestamp)),
      ...future.map((f) => formatDate(f.timestamp)),
    ];

    const histCount = historical.length;
    const futureCount = future.length;

    // Historical dataset: values for first histCount, null for future
    const histData: (number | null)[] = [
      ...historical.map((h) => h.value),
      ...new Array(futureCount).fill(null),
    ];

    // Bridge point: Connect last historical point to first future point for smooth line
    const lastHistVal = histCount > 0 ? historical[histCount - 1].value : null;

    // Forecast dataset: null for history except last historical point, then future forecasts
    const forecastData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.forecast),
    ];

    // Upper CI dataset
    const upperCIData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.upper_ci),
    ];

    // Lower CI dataset
    const lowerCIData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.lower_ci),
    ];

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Upper 95% Confidence Interval',
          data: upperCIData,
          borderColor: 'rgba(56, 189, 248, 0.35)',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3],
          fill: '+1',
          tension: 0.2,
        },
        {
          label: 'Lower 95% Confidence Interval',
          data: lowerCIData,
          borderColor: 'rgba(56, 189, 248, 0.35)',
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3],
          fill: false,
          tension: 0.2,
        },
        {
          label: 'Historical Actuals',
          data: histData,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#fff',
          pointRadius: historical.length > 80 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.15,
        },
        {
          label: 'Projected Forecast',
          data: forecastData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          borderDash: [6, 4],
          tension: 0.2,
        },
      ],
    };
  }, [historical, future, backtest, viewMode, model.frequency]);

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          boxWidth: 14,
          padding: 16,
          filter: (item: any) =>
            !item.text.includes('Lower 95%') && !item.text.includes('Upper 95%'),
        },
      },
      tooltip: {
        backgroundColor: '#0c0818',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            if (val === null || val === undefined) return '';
            return ` ${context.dataset.label}: ${val.toFixed(3)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          maxRotation: 45,
          maxTicksLimit: 14,
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (value: any) =>
            typeof value === 'number' && Math.abs(value) >= 1000
              ? `${(value / 1000).toFixed(1)}k`
              : value,
        },
      },
    },
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <CardTitle className="text-base font-semibold text-white">
              {model.name}
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              {model.target_column}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Date Column: <strong className="text-slate-300">{model.date_column}</strong> •{' '}
            Frequency: <strong className="text-slate-300">{model.frequency}</strong> • Horizon:{' '}
            <strong className="text-cyan-400">{model.horizon} steps</strong>
          </CardDescription>
        </div>

        {/* View Mode Controls & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Full Series
            </button>
            <button
              onClick={() => setViewMode('future')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'future'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Forecast Only
            </button>
            {backtest.length > 0 && (
              <button
                onClick={() => setViewMode('backtest')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  viewMode === 'backtest'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Backtest Holdout
              </button>
            )}
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs text-slate-300 h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Export CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {viewMode !== 'table' ? (
          <div className="h-96 w-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          /* Tabular Forecast View */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Displaying <strong>{future.length}</strong> forecasted future time points with 95% confidence bounds.
              </span>
              <span className="font-mono text-[11px] text-cyan-400">
                Sorted chronologically
              </span>
            </div>
            <div className="overflow-x-auto max-h-96 rounded-xl border border-white/[0.08] bg-[#090514]">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/[0.08] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Step #</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4 text-right">Forecast Value</th>
                    <th className="py-2.5 px-4 text-right">Lower 95% Bound</th>
                    <th className="py-2.5 px-4 text-right">Upper 95% Bound</th>
                    <th className="py-2.5 px-4 text-right">Confidence Spread</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {future.map((point, idx) => {
                    const spread = point.upper_ci - point.lower_ci;
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-500">t + {idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">
                          {formatDate(point.timestamp)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-400">
                          {point.forecast.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                          {point.lower_ci.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                          {point.upper_ci.toFixed(4)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                          ±{(spread / 2).toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend notes */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-500" />
              <span>Historical Observations ({historical.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 border-dashed" />
              <span>Forecast ({future.length} steps)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-sky-500/20 border border-sky-400/40 rounded-sm" />
              <span>95% Confidence Band</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500">
            Model: {model.model_type} ({model.model_order.join(', ')})
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
