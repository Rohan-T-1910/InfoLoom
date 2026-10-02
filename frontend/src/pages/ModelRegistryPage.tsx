import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Box,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  Trash2,
  Plus,
  Play,
  Database,
  Cpu,
  ShieldCheck,
  TrendingUp,
  FileCheck,
  Info,
  X,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';
import {
  RegisteredModelResponse,
  MLModelLeaderboardItem,
  MLPredictResponse,
} from '../types';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';

export const ModelRegistryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetIdParam = searchParams.get('datasetId');
  const selectedDatasetId = datasetIdParam ? parseInt(datasetIdParam, 10) : null;

  // Filter states
  const [taskFilter, setTaskFilter] = useState<'all' | 'regression' | 'classification'>('all');
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Action States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<RegisteredModelResponse | null>(null);
  const [modelToRollback, setModelToRollback] = useState<RegisteredModelResponse | null>(null);
  const [predictingModel, setPredictingModel] = useState<RegisteredModelResponse | null>(null);

  // Form states for Register Model
  const [registerDatasetId, setRegisterDatasetId] = useState<number | null>(selectedDatasetId);
  const [selectedSourceModelId, setSelectedSourceModelId] = useState<number | null>(null);
  const [modelFamilyName, setModelFamilyName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [setActiveOnRegister, setSetActiveOnRegister] = useState(true);

  // Prediction input state
  const [predictInputs, setPredictInputs] = useState<Record<string, string>>({});
  const [predictResult, setPredictResult] = useState<MLPredictResponse | null>(null);

  // Alerts
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch user datasets
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 100),
  });
  const datasets = datasetsData?.items || [];

  // 2. Fetch registered models
  const {
    data: registryData,
    isLoading: isLoadingModels,
    refetch: refetchModels,
  } = useQuery({
    queryKey: ['registered-models', selectedDatasetId, taskFilter, activeOnlyFilter],
    queryFn: () =>
      api.listRegisteredModels({
        dataset_id: selectedDatasetId ?? undefined,
        task_type: taskFilter === 'all' ? undefined : taskFilter,
        is_active: activeOnlyFilter ? true : undefined,
      }),
  });
  const models = registryData?.items || [];

  // 3. Fetch trained models for registration dropdown when dataset selected
  const effectiveRegisterDatasetId = registerDatasetId ?? (datasets[0]?.id ?? null);
  const { data: trainedModels = [], isLoading: isLoadingTrainedModels } = useQuery({
    queryKey: ['dataset-trained-models', effectiveRegisterDatasetId],
    queryFn: () =>
      effectiveRegisterDatasetId ? api.listDatasetModels(effectiveRegisterDatasetId) : Promise.resolve([]),
    enabled: isRegisterModalOpen && !!effectiveRegisterDatasetId,
  });

  // Mutations
  const registerMutation = useMutation({
    mutationFn: () => {
      if (!effectiveRegisterDatasetId) throw new Error('Please select a dataset');
      if (!selectedSourceModelId) throw new Error('Please select a trained model artifact');
      if (!modelFamilyName.trim()) throw new Error('Model family name is required');

      return api.registerModel({
        name: modelFamilyName.trim(),
        dataset_id: effectiveRegisterDatasetId,
        source_model_id: selectedSourceModelId,
        description: modelDescription.trim() || undefined,
        set_active: setActiveOnRegister,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['registered-models'] });
      setIsRegisterModalOpen(false);
      setModelFamilyName('');
      setModelDescription('');
      setSelectedSourceModelId(null);
      setFeedbackMessage({
        type: 'success',
        text: `Model "${data.name}" version ${data.version} registered successfully!`,
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to register model.' });
    },
  });

  const activateMutation = useMutation({
    mutationFn: (modelId: number) => api.activateModelVersion(modelId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['registered-models'] });
      setFeedbackMessage({
        type: 'success',
        text: `Model "${data.name}" version ${data.version} is now active for prediction.`,
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to activate model.' });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (modelId: number) => api.rollbackModelVersion(modelId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['registered-models'] });
      setModelToRollback(null);
      setFeedbackMessage({
        type: 'success',
        text: `Model "${data.name}" rolled back successfully to version ${data.version}.`,
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to roll back model.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (modelId: number) => api.deleteModelVersion(modelId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['registered-models'] });
      setModelToDelete(null);
      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Model version deleted and artifacts cleaned up.',
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete model version.' });
    },
  });

  const predictMutation = useMutation({
    mutationFn: async () => {
      if (!predictingModel) throw new Error('No model selected');
      // Format inputs into numbers/strings based on user inputs
      const parsedInputs: Record<string, any> = {};
      predictingModel.feature_names.forEach((feat) => {
        const val = predictInputs[feat];
        if (val !== undefined && val !== '') {
          parsedInputs[feat] = isNaN(Number(val)) ? val : Number(val);
        } else {
          parsedInputs[feat] = 0;
        }
      });
      return api.predictWithRegisteredModel(predictingModel.id, parsedInputs);
    },
    onSuccess: (res) => {
      setPredictResult(res);
    },
    onError: (err: any) => {
      setFeedbackMessage({ type: 'error', text: err.message || 'Inference execution failed.' });
    },
  });

  // Filtered models
  const filteredModels = models.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchAlgo = m.algorithm.toLowerCase().includes(q);
      const matchTarget = m.target_column.toLowerCase().includes(q);
      const matchDataset = m.dataset_name?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchAlgo && !matchTarget && !matchDataset) return false;
    }
    return true;
  });

  const activeModel = models.find((m) => m.is_active);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleOpenPredictDrawer = (model: RegisteredModelResponse) => {
    setPredictingModel(model);
    setPredictResult(null);
    const initialInputs: Record<string, string> = {};
    model.feature_names.forEach((f) => {
      initialInputs[f] = '';
    });
    setPredictInputs(initialInputs);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-purple-950/40 via-[#0e091b] to-[#080512] p-8 backdrop-blur-xl">
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold mb-4">
            <Layers className="w-3.5 h-3.5" />
            <span>Phase 10 Model Management & Lineage Registry</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Model Registry & Version Lifecycle
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Track, activate, rollback, test, and safely govern trained ML models across versions.
            Ensure artifact integrity with physical file lineage and execute real-time production inference.
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <Box className="w-4 h-4 text-purple-400" />
              <span className="text-slate-400">Total Versions:</span>
              <span className="font-semibold text-white font-mono">{models.length}</span>
            </div>

            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-400">Active Models:</span>
              <span className="font-semibold text-emerald-400 font-mono">
                {models.filter((m) => m.is_active).length}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-400">Datasets Linked:</span>
              <span className="font-semibold text-white font-mono">
                {new Set(models.map((m) => m.dataset_id)).size}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {/* Dataset Scope Filter */}
              <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                <select
                  aria-label="Filter models by dataset"
                  value={selectedDatasetId ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setSearchParams({ datasetId: val });
                    } else {
                      setSearchParams({});
                    }
                  }}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer pr-2"
                >
                  <option value="" className="bg-slate-900 text-white">All Datasets</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                      {d.original_filename}
                    </option>
                  ))}
                </select>
              </div>

              {/* Register Model Action */}
              <Button
                onClick={() => {
                  setIsRegisterModalOpen(true);
                  setRegisterDatasetId(selectedDatasetId ?? datasets[0]?.id ?? null);
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 text-xs font-semibold h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Register New Model
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Global Alerts */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center justify-between p-4 rounded-xl border text-xs ${
              feedbackMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Model Spotlight Banner (if active model exists) */}
      {activeModel && (
        <Card className="border border-emerald-500/30 bg-emerald-950/10 backdrop-blur-md relative overflow-hidden">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                    ACTIVE PRODUCTION MODEL
                  </Badge>
                  <span className="font-mono text-xs font-bold text-white">
                    {activeModel.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-white/20 text-slate-300">
                    v{activeModel.version}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  <span>Target: <strong className="text-white">{activeModel.target_column}</strong></span>
                  <span>•</span>
                  <span>Algorithm: <strong className="text-white capitalize">{activeModel.algorithm.replace('_', ' ')}</strong></span>
                  <span>•</span>
                  <span>Dataset: <strong className="text-white">{activeModel.dataset_name || `ID ${activeModel.dataset_id}`}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={() => handleOpenPredictDrawer(activeModel)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Test Live Inference
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Task Type Filter */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-lg p-1 text-xs">
            <button
              onClick={() => setTaskFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                taskFilter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTaskFilter('regression')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                taskFilter === 'regression' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Regression
            </button>
            <button
              onClick={() => setTaskFilter('classification')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                taskFilter === 'classification' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Classification
            </button>
          </div>

          {/* Active only toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveOnlyFilter(!activeOnlyFilter)}
            className={`text-xs h-8 border-white/10 ${
              activeOnlyFilter ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40' : 'text-slate-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Active Only
          </Button>
        </div>

        {/* Search Input */}
        <div className="w-72">
          <Input
            placeholder="Search by name, algorithm, target..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-xs bg-black/40 border-white/10 text-white"
          />
        </div>
      </div>

      {/* Model Versions Grid / Cards */}
      {isLoadingModels ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-white/[0.06] bg-[#0c0818]/60 p-6 space-y-4">
              <Skeleton className="h-6 w-3/4 bg-white/5" />
              <Skeleton className="h-4 w-1/2 bg-white/5" />
              <Skeleton className="h-16 w-full bg-white/5" />
              <Skeleton className="h-8 w-full bg-white/5" />
            </Card>
          ))}
        </div>
      ) : filteredModels.length === 0 ? (
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-12 text-center">
          <Box className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">No Registered Models Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            Register trained machine learning models from Phase 4 to manage versions, promote active models,
            and enable lineage tracking.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => setIsRegisterModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Register First Model
            </Button>
            <Link to="/models">
              <Button variant="outline" className="text-xs border-white/10 text-slate-300">
                Train New ML Models
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredModels.map((model) => (
            <Card
              key={model.id}
              className={`border transition-all duration-200 bg-[#0c0818]/90 overflow-hidden flex flex-col justify-between ${
                model.is_active
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                  : 'border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div>
                {/* Card Header */}
                <CardHeader className="p-5 pb-3 border-b border-white/[0.04]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white truncate max-w-[180px]">
                          {model.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] bg-purple-950/40 text-purple-300 border-purple-500/30"
                        >
                          v{model.version}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {model.description || `Dataset: ${model.dataset_name || `ID ${model.dataset_id}`}`}
                      </p>
                    </div>

                    {model.is_active ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-semibold shrink-0">
                        ACTIVE
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 border-white/10 text-[10px] shrink-0">
                        STANDBY
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                {/* Card Body */}
                <CardContent className="p-5 space-y-4 text-xs">
                  {/* Model Metadata Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-slate-300 font-mono text-[10px]">
                      {model.algorithm.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-950/30 text-purple-300 font-medium text-[10px]">
                      {model.task_type.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-950/30 text-blue-300 text-[10px]">
                      Target: {model.target_column}
                    </span>
                  </div>

                  {/* Primary Metrics Box */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] grid grid-cols-2 gap-2 text-center">
                    {model.task_type === 'regression' ? (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">R² Score</div>
                          <div className="font-mono text-sm font-bold text-purple-300">
                            {model.metrics.r2 !== undefined ? Number(model.metrics.r2).toFixed(4) : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">RMSE</div>
                          <div className="font-mono text-sm font-bold text-slate-200">
                            {model.metrics.rmse !== undefined ? Number(model.metrics.rmse).toFixed(3) : 'N/A'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Accuracy</div>
                          <div className="font-mono text-sm font-bold text-emerald-300">
                            {model.metrics.accuracy !== undefined ? `${(Number(model.metrics.accuracy) * 100).toFixed(1)}%` : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider">F1 Score</div>
                          <div className="font-mono text-sm font-bold text-purple-300">
                            {model.metrics.f1 !== undefined ? Number(model.metrics.f1).toFixed(3) : 'N/A'}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Artifact Lineage & Integrity */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      {model.has_artifact ? (
                        <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                      )}
                      <span className={model.has_artifact ? 'text-slate-300' : 'text-rose-300'}>
                        {model.has_artifact ? 'Artifact Verified' : 'Missing File'}
                      </span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {formatFileSize(model.artifact_size_bytes)}
                    </span>
                  </div>

                  {/* Registered Timestamp */}
                  <div className="text-[10px] text-slate-400">
                    Registered: {new Date(model.created_at).toLocaleDateString()} at{' '}
                    {new Date(model.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </CardContent>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 bg-white/[0.02] border-t border-white/[0.04] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Activate / Promoted status */}
                  {!model.is_active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => activateMutation.mutate(model.id)}
                      disabled={activateMutation.isPending || !model.has_artifact}
                      className="text-xs h-8 border-purple-500/30 text-purple-300 hover:bg-purple-950/40"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Activate
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] h-8 px-2 flex items-center">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Live Active
                    </Badge>
                  )}

                  {/* Rollback button (if version > 1) */}
                  {model.version > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setModelToRollback(model)}
                      disabled={rollbackMutation.isPending}
                      className="text-xs h-8 border-white/10 text-slate-400 hover:text-white"
                      title="Roll back to previous version"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Rollback
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Predict Test */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenPredictDrawer(model)}
                    disabled={!model.has_artifact}
                    className="text-xs h-8 text-purple-300 hover:bg-purple-950/40 hover:text-white"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Test
                  </Button>

                  {/* Delete version */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setModelToDelete(model)}
                    className="text-xs h-8 text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                    title="Delete model version"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. Register Model Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e091b] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <Box className="w-5 h-5 text-purple-400" />
                  <h3 className="text-base font-bold text-white">Register Model Version</h3>
                </div>
                <button
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Dataset Selection */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Source Dataset
                  </label>
                  <select
                    value={effectiveRegisterDatasetId ?? ''}
                    onChange={(e) => {
                      setRegisterDatasetId(Number(e.target.value));
                      setSelectedSourceModelId(null);
                    }}
                    className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                        {d.original_filename} (ID: {d.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trained Model Artifact Selector */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Select Trained Model Artifact (Phase 4)
                  </label>
                  {isLoadingTrainedModels ? (
                    <Skeleton className="h-10 w-full bg-white/5" />
                  ) : trainedModels.length === 0 ? (
                    <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-amber-300">
                      No trained models found for this dataset. Please train models in the ML Models tab first.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {trainedModels.map((tm) => (
                        <div
                          key={tm.id}
                          onClick={() => {
                            setSelectedSourceModelId(tm.id);
                            if (!modelFamilyName) {
                              const safeName = (tm.name || tm.algorithm_name || tm.algorithm).toLowerCase().replace(/[^a-z0-9]+/g, '-');
                              setModelFamilyName(`${safeName}`);
                            }
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                            selectedSourceModelId === tm.id
                              ? 'border-purple-500 bg-purple-950/40 text-white'
                              : 'border-white/10 bg-black/30 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-xs text-white">{tm.name || tm.algorithm_name || tm.algorithm}</div>
                            <div className="text-[10px] text-slate-400 capitalize mt-0.5">
                              {tm.algorithm.replace('_', ' ')} • {tm.task_type}
                            </div>
                          </div>
                          {tm.is_best && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]">
                              BEST MODEL
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model Family Name */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Model Family Identifier / Name
                  </label>
                  <Input
                    placeholder="e.g. sales-predictor or customer-churn"
                    value={modelFamilyName}
                    onChange={(e) => setModelFamilyName(e.target.value)}
                    className="bg-black/40 border-white/10 text-white text-xs h-9"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Versions will be sequentially incremented (v1, v2, v3) under this model family name.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-1.5">
                    Version Description / Release Notes
                  </label>
                  <Input
                    placeholder="e.g. Baseline Random Forest trained on 80/20 split"
                    value={modelDescription}
                    onChange={(e) => setModelDescription(e.target.value)}
                    className="bg-black/40 border-white/10 text-white text-xs h-9"
                  />
                </div>

                {/* Make Active Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="set_active_cb"
                    checked={setActiveOnRegister}
                    onChange={(e) => setSetActiveOnRegister(e.target.checked)}
                    className="rounded bg-black/40 border-white/20 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="set_active_cb" className="text-slate-300 cursor-pointer">
                    Promote this version to <strong>Active Production Model</strong> immediately
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <Button
                  variant="outline"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="text-xs border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending || !selectedSourceModelId || !modelFamilyName.trim()}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  {registerMutation.isPending ? 'Registering...' : 'Register Version'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. Rollback Confirmation Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {modelToRollback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e091b] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <RotateCcw className="w-6 h-6" />
                <h3 className="text-base font-bold text-white">Confirm Model Rollback</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to roll back <strong>{modelToRollback.name}</strong> from version{' '}
                <strong>v{modelToRollback.version}</strong> to its previous version?
              </p>
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-200">
                The target version will be verified on disk and automatically activated for all production predictions.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <Button
                  variant="outline"
                  onClick={() => setModelToRollback(null)}
                  className="text-xs border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => rollbackMutation.mutate(modelToRollback.id)}
                  disabled={rollbackMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                >
                  {rollbackMutation.isPending ? 'Rolling back...' : 'Confirm Rollback'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. Delete Confirmation Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {modelToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0e091b] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-base font-bold text-white">Delete Model Version</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete <strong>{modelToDelete.name} (v{modelToDelete.version})</strong>?
              </p>
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[11px] text-rose-200">
                This action is irreversible. The database record and its associated physical model artifact will be safely deleted from storage.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                <Button
                  variant="outline"
                  onClick={() => setModelToDelete(null)}
                  className="text-xs border-white/10 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate(modelToDelete.id)}
                  disabled={deleteMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete Version'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4. Interactive Test Inference Drawer / Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {predictingModel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0e091b] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Live Inference: {predictingModel.name} (v{predictingModel.version})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Target: <strong className="text-white">{predictingModel.target_column}</strong> •{' '}
                      {predictingModel.task_type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setPredictingModel(null);
                    setPredictResult(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Feature Input Fields */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-300 block">
                  Input Feature Values ({predictingModel.feature_names.length} features):
                </span>
                <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                  {predictingModel.feature_names.map((feat) => (
                    <div key={feat}>
                      <label className="text-[11px] text-slate-400 font-mono block mb-1 truncate" title={feat}>
                        {feat}
                      </label>
                      <Input
                        placeholder="0.0"
                        value={predictInputs[feat] ?? ''}
                        onChange={(e) =>
                          setPredictInputs({ ...predictInputs, [feat]: e.target.value })
                        }
                        className="h-8 text-xs bg-black/40 border-white/10 text-white font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Predict Trigger */}
              <Button
                onClick={() => predictMutation.mutate()}
                disabled={predictMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold h-9"
              >
                {predictMutation.isPending ? 'Executing Inference...' : 'Execute Prediction'}
              </Button>

              {/* Prediction Results Display */}
              {predictResult && (
                <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      Predicted Output ({predictingModel.target_column}):
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-bold font-mono">
                      {String(predictResult.predictions[0])}
                    </Badge>
                  </div>

                  {/* Probabilities if classification */}
                  {predictResult.probabilities && predictResult.probabilities[0] && (
                    <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Class Probabilities
                      </span>
                      <div className="space-y-1">
                        {Object.entries(predictResult.probabilities[0]).map(([cls, prob]) => (
                          <div key={cls} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-mono">{cls}:</span>
                            <span className="font-mono text-purple-300 font-bold">
                              {(Number(prob) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
