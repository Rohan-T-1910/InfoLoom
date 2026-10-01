import React, { useState } from 'react';
import { Scatter } from 'react-chartjs-2';
import { ClusteringModelResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Eye, Sliders, Sparkles, Crosshair } from 'lucide-react';

interface ClusterScatterPlotProps {
  model: ClusteringModelResponse;
}

const CLUSTER_COLORS = [
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#84cc16', // lime
];

export const ClusterScatterPlot: React.FC<ClusterScatterPlotProps> = ({ model }) => {
  const features = model.feature_names;
  const [xAxisFeature, setXAxisFeature] = useState<string>(features[0] || '');
  const [yAxisFeature, setYAxisFeature] = useState<string>(
    features.length > 1 ? features[1] : features[0] || ''
  );

interface ScatterPoint {
  x: number;
  y: number;
  index?: number;
  clusterName?: string;
}

  const samples = model.sample_assignments || [];

  // Group sample points by cluster
  const clusterDatasets = model.cluster_profiles.map((profile, idx) => {
    const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
    const points: ScatterPoint[] = samples
      .filter((s) => s.cluster === profile.cluster_id)
      .map((s) => ({
        x: s.features[xAxisFeature] ?? s.x ?? 0,
        y: s.features[yAxisFeature] ?? s.y ?? 0,
        index: s.index,
      }));

    return {
      label: profile.name,
      data: points,
      backgroundColor: color,
      borderColor: color,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: '#ffffff',
    };
  });

  // Add cluster centroids dataset
  const centerPoints: ScatterPoint[] = model.cluster_profiles.map((profile, idx) => {
    const xVals = model.cluster_centers[xAxisFeature] || [];
    const yVals = model.cluster_centers[yAxisFeature] || [];
    return {
      x: xVals[idx] ?? 0,
      y: yVals[idx] ?? 0,
      clusterName: profile.name,
    };
  });

  const centroidsDataset = {
    label: 'Centroids (Cluster Centers)',
    data: centerPoints,
    backgroundColor: '#ffffff',
    borderColor: '#eab308',
    borderWidth: 2,
    pointRadius: 9,
    pointStyle: 'star' as const,
    pointHoverRadius: 12,
  };

  const chartData = {
    datasets: [...clusterDatasets, centroidsDataset],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#cbd5e1',
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          font: { size: 11 },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 10, 30, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 10,
        callbacks: {
          label: (context: any) => {
            const raw = context.raw;
            if (raw.clusterName) {
              return `★ Centroid: ${raw.clusterName} (${xAxisFeature}: ${raw.x.toFixed(2)}, ${yAxisFeature}: ${raw.y.toFixed(2)})`;
            }
            return `${context.dataset.label}: (${xAxisFeature}: ${raw.x.toFixed(2)}, ${yAxisFeature}: ${raw.y.toFixed(2)})`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xAxisFeature,
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
        },
      },
      y: {
        title: {
          display: true,
          text: yAxisFeature,
          color: '#94a3b8',
          font: { size: 11, weight: 'bold' as const },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
        },
      },
    },
  };

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                2D Segment Cluster Visualization
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Interactive scatter plot with cluster-colored points and prominent star centroids.
              </CardDescription>
            </div>
          </div>

          {/* 2D Axis Selectors */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>X-Axis:</span>
              <select
                value={xAxisFeature}
                onChange={(e) => setXAxisFeature(e.target.value)}
                className="bg-[#120d24] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              >
                {features.map((f) => (
                  <option key={f} value={f} className="bg-[#120d24]">
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Y-Axis:</span>
              <select
                value={yAxisFeature}
                onChange={(e) => setYAxisFeature(e.target.value)}
                className="bg-[#120d24] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
              >
                {features.map((f) => (
                  <option key={f} value={f} className="bg-[#120d24]">
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-4">
        <div className="h-96 w-full">
          <Scatter data={chartData} options={chartOptions} />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.04]">
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400 font-bold">★</span>
            <span>Star markers indicate multi-dimensional cluster centroids</span>
          </span>
          <span>Showing {samples.length} sample points</span>
        </div>
      </CardContent>
    </Card>
  );
};
