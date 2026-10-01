import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Cpu,
  Layers,
} from 'lucide-react';

export const InsightsPage: React.FC = () => {
  const { data: datasetsData } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 10),
  });

  const datasets = datasetsData?.items || [];
  const primaryDataset = datasets[0] || null;

  const { data: edaData } = useQuery({
    queryKey: ['eda', primaryDataset?.id, true, null],
    queryFn: () => api.getEDA(primaryDataset!.id),
    enabled: !!primaryDataset,
  });

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Automated Dataset Intelligence & Signals
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Algorithmic heuristics synthesized from Phase 3 EDA profiling, correlation matrices, and distribution shapes.
        </p>
      </div>

      {!primaryDataset ? (
        <Card className="p-8 text-center border-dashed border-white/10 bg-[#0c0818]/60">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-slate-300">No active dataset for insight extraction.</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Upload or select a dataset to generate automated statistical recommendations.
          </p>
          <Link to="/datasets">
            <Button variant="glow" size="sm">
              Upload Dataset
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Signal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Correlation Signal */}
            <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Linear Collinearity
                </span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                {edaData?.correlation_matrix.strong_correlations.length || 0} Strong Feature Pairings
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {edaData?.correlation_matrix.strong_correlations.length
                  ? `Identified high correlation pairs like ${edaData.correlation_matrix.strong_correlations[0]?.feature_a} ↔ ${edaData.correlation_matrix.strong_correlations[0]?.feature_b}.`
                  : 'Low pairwise linear correlation across numerical dimensions.'}
              </p>
            </Card>

            {/* Missingness Signal */}
            <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Data Quality & Completeness
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                {edaData?.kpis ? `${100 - edaData.kpis.missing_percentage}% Health Score` : 'Analyzing...'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                {edaData?.kpis.missing_percentage === 0
                  ? 'Complete dataset matrix with 0% missing cells across all features.'
                  : `${edaData?.kpis.missing_percentage}% cells missing. Automated median/mode imputation recommended.`}
              </p>
            </Card>

            {/* Target Heuristic */}
            <Card className="p-5 border border-white/[0.08] bg-[#0c0818]/90">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Supervised Target Detection
                </span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-sm font-semibold text-white mb-1">
                Target: {edaData?.feature_importance?.target_column || 'None Detected'}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Baseline {edaData?.feature_importance?.model_used || 'Tree Model'} trained with score:{' '}
                <strong className="text-purple-300">
                  {edaData?.feature_importance?.baseline_score !== null
                    ? edaData?.feature_importance?.baseline_score
                    : 'N/A'}
                </strong>
                .
              </p>
            </Card>
          </div>

          <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-6">
            <h3 className="text-base font-semibold text-white mb-2">Automated Next-Step Recommendations</h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Execute Exploratory Correlation Heatmap</h4>
                  <p className="text-[11px] text-slate-400">
                    Verify pairwise scatter plots and multicollinearity before Phase 4 regression/classification.
                  </p>
                </div>
                <Link to={`/eda?datasetId=${primaryDataset.id}`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    View in EDA
                  </Button>
                </Link>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Prepare Training / Validation Split</h4>
                  <p className="text-[11px] text-slate-400">
                    Target column '{edaData?.feature_importance?.target_column}' is ready for downstream scikit-learn pipelines.
                  </p>
                </div>
                <Badge variant="purple" className="text-xs">
                  Phase 4 Ready
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
