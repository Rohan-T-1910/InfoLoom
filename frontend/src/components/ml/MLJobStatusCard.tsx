import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { MLJob } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  Cpu,
  Trophy,
} from 'lucide-react';

interface MLJobStatusCardProps {
  jobId: number;
  onJobCompleted?: (job: MLJob) => void;
}

export const MLJobStatusCard: React.FC<MLJobStatusCardProps> = ({ jobId, onJobCompleted }) => {
  const { data: job, isLoading, error } = useQuery({
    queryKey: ['ml-job', jobId],
    queryFn: () => api.getJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'running' ? 1200 : false;
    },
  });

  useEffect(() => {
    if (job?.status === 'completed' && onJobCompleted) {
      onJobCompleted(job);
    }
  }, [job?.status]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-[#0d091a] border border-white/10 animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <span className="text-sm text-slate-300">Connecting to training job runtime...</span>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-sm">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
        <span>We couldn't retrieve the training job status. Please check your network connection and try again.</span>
      </div>
    );
  }

  const isPending = job.status === 'pending';
  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  const featureCount = Array.isArray(job.feature_columns) ? job.feature_columns.length : 0;
  const testSplitPct = typeof job.test_size === 'number' ? Math.round(job.test_size * 100) : 20;
  const taskTitle = typeof job.task_type === 'string' ? job.task_type.toUpperCase() : 'PREDICTION';

  if (isFailed && job.error_message) {
    console.error('InfoLoom ML Job Failure:', job.error_message);
  }

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/95 overflow-hidden">
      {/* Top Running Progress Bar */}
      {(isPending || isRunning) && (
        <div className="h-1 w-full bg-purple-950 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 animate-pulse duration-1000 w-full" />
        </div>
      )}

      <CardContent className="p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-purple-600/20 text-purple-400 border border-purple-500/30 animate-pulse'
              }`}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isFailed ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Cpu className="w-5 h-5 animate-spin duration-3000" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-white">
                  {isRunning || isPending
                    ? 'Training and comparing models...'
                    : isCompleted
                    ? 'Model Training & Evaluation Completed'
                    : 'Prediction Analysis Incomplete'}
                </h4>
                <Badge
                  variant={isCompleted ? 'success' : isFailed ? 'destructive' : 'purple'}
                  className="capitalize text-[10px] px-2 py-0.5"
                >
                  {job.status}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target: <span className="text-purple-300 font-mono font-medium">{job.target_column}</span> •{' '}
                {featureCount} predictive features • {testSplitPct}% unseen test split
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(isRunning || isPending) && (
              <span className="text-xs text-purple-300 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Training and comparing models...
              </span>
            )}

            {isCompleted && job.best_model_id && (
              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-emerald-300 text-xs">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Top Performer: Model #{job.best_model_id}
                </span>
              </div>
            )}

            {isFailed && (
              <div className="text-xs text-rose-300 max-w-md">
                We couldn't complete the prediction analysis. Please check your selected target and data and try again.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
