import React from 'react';
import { Scatter } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { AnomalyScatterPoint } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Crosshair, ShieldAlert } from 'lucide-react';

interface AnomalyScatterPlotProps {
  points: AnomalyScatterPoint[];
  featureNames: string[];
}

export const AnomalyScatterPlot: React.FC<AnomalyScatterPlotProps> = ({
  points,
  featureNames,
}) => {
  if (!points || points.length === 0) {
    return null;
  }

  const normalPoints = points
    .filter((p) => !p.is_anomaly)
    .map((p) => ({ x: p.x, y: p.y, rawPoint: p }));

  const anomalyPoints = points
    .filter((p) => p.is_anomaly)
    .map((p) => ({ x: p.x, y: p.y, rawPoint: p }));

  const isPCA = featureNames.length > 2;
  const xLabel = isPCA ? 'Principal Component 1 (PCA)' : featureNames[0];
  const yLabel = isPCA ? 'Principal Component 2 (PCA)' : featureNames[1] || 'Index';

  const chartData = {
    datasets: [
      {
        label: 'Normal Observations',
        data: normalPoints,
        backgroundColor: 'rgba(168, 85, 247, 0.55)',
        borderColor: '#c084fc',
        borderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Flagged Outliers (Anomalies)',
        data: anomalyPoints,
        backgroundColor: 'rgba(244, 63, 94, 0.95)',
        borderColor: '#fff',
        borderWidth: 1.5,
        pointRadius: 7,
        pointHoverRadius: 9,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          boxWidth: 12,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#0c0818',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
        bodyFont: { size: 11, family: "'JetBrains Mono', monospace" },
        callbacks: {
          label: (context: any) => {
            const raw = context.raw?.rawPoint;
            if (!raw) return '';
            const statusStr = raw.is_anomaly ? 'ANOMALY' : 'NORMAL';
            return [
              ` Row #${raw.index} [${statusStr}]`,
              ` Score: ${raw.score.toFixed(4)}`,
              ` Severity: ${(raw.normalized_score * 100).toFixed(1)}%`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xLabel,
          color: '#94a3b8',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
      },
      y: {
        title: {
          display: true,
          text: yLabel,
          color: '#94a3b8',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 },
        },
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
      },
    },
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-rose-400" />
            <CardTitle className="text-base font-semibold text-white">
              2D Outlier Feature Space Projection
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              {isPCA ? 'PCA Projection' : 'Bivariate Scatter'}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Visual separation of standard inliers vs isolated multidimensional outliers.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Inlier ({normalPoints.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 border border-white" />
            <span className="text-rose-300 font-medium">Anomaly ({anomalyPoints.length})</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="h-80 w-full">
          <Scatter data={chartData} options={chartOptions} />
        </div>
      </CardContent>
    </Card>
  );
};
