import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Dataset, MLTaskType, MLTrainRequest } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Cpu,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Split,
  Binary,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MLTrainingConfigProps {
  dataset: Dataset;
  onJobStarted: (jobId: number) => void;
  isTrainingActive?: boolean;
}

const REGRESSION_ALGORITHMS = [
  { id: 'linear_regression', name: 'Linear Regression', desc: 'Fast, interpretable baseline approach' },
  { id: 'random_forest', name: 'Random Forest Regressor', desc: 'Ensemble of decision trees that handles non-linear patterns' },
  { id: 'xgboost', name: 'XGBoost Regressor', desc: 'High-performance gradient boosted decision trees' },
];

const CLASSIFICATION_ALGORITHMS = [
  { id: 'logistic_regression', name: 'Logistic Regression', desc: 'Calibrated probabilistic linear classifier' },
  { id: 'random_forest', name: 'Random Forest Classifier', desc: 'Robust ensemble tree-based classifier' },
  { id: 'xgboost', name: 'XGBoost Classifier', desc: 'State-of-the-art gradient boosted trees' },
];

const isIdentifierColumn = (name: string): boolean => {
  const clean = name.toLowerCase().replace(/[\s_-]+/g, '');
  return (
    clean === 'id' ||
    clean.endsWith('id') ||
    clean.startsWith('id') ||
    clean.includes('identifier') ||
    clean.includes('transactionid') ||
    clean.includes('customerid')
  );
};

export const MLTrainingConfig: React.FC<MLTrainingConfigProps> = ({
  dataset,
  onJobStarted,
  isTrainingActive = false,
}) => {
  const queryClient = useQueryClient();

  // Cleaned dataset preference
  const [useCleaned, setUseCleaned] = useState<boolean>(Boolean(dataset.has_cleaned));
  const [targetColumn, setTargetColumn] = useState<string>('');
  const [taskType, setTaskType] = useState<MLTaskType>('classification');
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>([]);
  const [testSize, setTestSize] = useState<number>(0.2);
  const [cvFolds, setCvFolds] = useState<number>(5);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch preview to get column names and candidate targets
  const { data: previewData } = useQuery({
    queryKey: ['preview', dataset.id, useCleaned],
    queryFn: () => (useCleaned ? api.getCleanedPreview(dataset.id, 5) : api.getPreview(dataset.id, 5)),
  });

  const columns = previewData?.columns || [];

  // Filter out target from candidate features and detect identifier columns
  const availableCandidateColumns = columns.filter((c) => c !== targetColumn);
  const nonIdColumns = availableCandidateColumns.filter((c) => !isIdentifierColumn(c));
  const detectedIdColumns = availableCandidateColumns.filter((c) => isIdentifierColumn(c));

  // Set initial default target column
  useEffect(() => {
    if (columns.length > 0 && !targetColumn) {
      // Pick last column or first non-id column as default
      const candidate = columns.slice().reverse().find((c) => !isIdentifierColumn(c)) || columns[columns.length - 1];
      setTargetColumn(candidate);
    }
  }, [columns, targetColumn]);

  // Inspect target column dynamically
  const { data: inspection, isLoading: isInspecting } = useQuery({
    queryKey: ['inspect-target', dataset.id, targetColumn],
    queryFn: () => api.inspectTarget(dataset.id, targetColumn),
    enabled: Boolean(dataset.id && targetColumn),
  });

  // Auto-adapt task type and default algorithms when inspection loads
  useEffect(() => {
    if (inspection) {
      setTaskType(inspection.inferred_task_type);
      const defaultAlgos =
        inspection.inferred_task_type === 'regression'
          ? REGRESSION_ALGORITHMS.map((a) => a.id)
          : CLASSIFICATION_ALGORITHMS.map((a) => a.id);
      setSelectedAlgorithms(defaultAlgos);

      // Initialize candidate features excluding target AND excluding obvious identifiers
      if (inspection.candidate_features.length > 0) {
        const cleanFeatures = inspection.candidate_features.filter((f) => !isIdentifierColumn(f));
        setSelectedFeatures(cleanFeatures.length > 0 ? cleanFeatures : inspection.candidate_features);
      }
    }
  }, [inspection]);

  // Update algorithms when task type is manually changed
  const handleTaskTypeChange = (newTask: MLTaskType) => {
    setTaskType(newTask);
    const algos =
      newTask === 'regression'
        ? REGRESSION_ALGORITHMS.map((a) => a.id)
        : CLASSIFICATION_ALGORITHMS.map((a) => a.id);
    setSelectedAlgorithms(algos);
  };

  const toggleAlgorithm = (algoId: string) => {
    if (selectedAlgorithms.includes(algoId)) {
      if (selectedAlgorithms.length > 1) {
        setSelectedAlgorithms(selectedAlgorithms.filter((a) => a !== algoId));
      }
    } else {
      setSelectedAlgorithms([...selectedAlgorithms, algoId]);
    }
  };

  const toggleFeature = (col: string) => {
    if (selectedFeatures.includes(col)) {
      if (selectedFeatures.length > 1) {
        setSelectedFeatures(selectedFeatures.filter((f) => f !== col));
      }
    } else {
      setSelectedFeatures([...selectedFeatures, col]);
    }
  };

  const selectAllUsefulFeatures = () => {
    // Select all non-identifier features
    if (nonIdColumns.length > 0) {
      setSelectedFeatures(nonIdColumns);
    } else {
      setSelectedFeatures(availableCandidateColumns);
    }
  };

  // Training mutation
  const trainMutation = useMutation({
    mutationFn: (payload: MLTrainRequest) => api.trainModels(dataset.id, payload),
    onSuccess: (job) => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['dataset-jobs', dataset.id] });
      queryClient.invalidateQueries({ queryKey: ['dataset-models', dataset.id] });
      onJobStarted(job.id);
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to trigger training job.';
      setErrorMessage(msg);
    },
  });

  const handleStartTraining = () => {
    if (!targetColumn) {
      setErrorMessage('Please select what you want to predict.');
      return;
    }
    if (selectedAlgorithms.length === 0) {
      setErrorMessage('Please select at least one prediction approach.');
      return;
    }
    if (selectedFeatures.length === 0) {
      setErrorMessage('Please select at least one field to use for prediction.');
      return;
    }

    setErrorMessage(null);
    trainMutation.mutate({
      task_type: taskType,
      target_column: targetColumn,
      feature_columns: selectedFeatures,
      test_size: testSize,
      cv_folds: cvFolds,
      algorithms: selectedAlgorithms,
      use_cleaned: useCleaned,
    });
  };

  const availableAlgorithms =
    taskType === 'regression' ? REGRESSION_ALGORITHMS : CLASSIFICATION_ALGORITHMS;

  const isReady = Boolean(targetColumn && selectedFeatures.length > 0 && selectedAlgorithms.length > 0);

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-white font-semibold">
                Predictive Model Setup
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Choose what you want to predict, select information to use, and let InfoLoom compare the best approaches.
              </CardDescription>
            </div>
          </div>

          {dataset.has_cleaned && (
            <div className="flex items-center gap-2 bg-[#120d24] px-3 py-1.5 rounded-lg border border-purple-500/20">
              <span className="text-xs text-slate-300">Dataset Source:</span>
              <button
                type="button"
                onClick={() => setUseCleaned(!useCleaned)}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors ${
                  useCleaned
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {useCleaned ? 'Cleaned Data' : 'Original Data'}
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Target Column Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Target Column Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
              <span>What do you want to predict?</span>
              {isInspecting && <span className="text-purple-400 text-[11px] animate-pulse">Inspecting column...</span>}
            </label>
            <p className="text-[11px] text-slate-400">
              Choose the column InfoLoom should predict.
            </p>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              className="w-full bg-[#120d24] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              {columns.map((col) => (
                <option key={col} value={col} className="bg-[#120d24] text-white">
                  {col}
                </option>
              ))}
            </select>

            {/* Target Inspection Badge & Stats */}
            {inspection && (
              <div className="mt-2.5 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Outcome Nature:</span>
                  <Badge variant="purple" className="text-[11px]">
                    {taskType === 'regression' ? 'Numerical Outcome' : 'Category / Classification'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Distinct Values in Target:</span>
                  <span className="text-slate-200 font-mono">{inspection.unique_count}</span>
                </div>
                {inspection.warning && (
                  <div className="text-[11px] text-amber-300/90 pt-1 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{inspection.warning}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Prediction Type (Category vs Number) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200">Prediction type</label>
            <p className="text-[11px] text-slate-400">
              Specify whether the outcome is a distinct group or a continuous numerical value.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
              <button
                type="button"
                onClick={() => handleTaskTypeChange('classification')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  taskType === 'classification'
                    ? 'border-purple-500 bg-purple-600/15 shadow-md shadow-purple-600/10'
                    : 'border-white/[0.08] bg-[#120d24] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Binary
                      className={`w-4 h-4 ${
                        taskType === 'classification' ? 'text-purple-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-white">Predict a category</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
                  Use this when the answer is a group or outcome, such as Yes/No, High/Medium/Low, or customer churn.
                </p>
                <span className="text-[10px] text-purple-300/80 font-mono">Category (Classification)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTaskTypeChange('regression')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  taskType === 'regression'
                    ? 'border-purple-500 bg-purple-600/15 shadow-md shadow-purple-600/10'
                    : 'border-white/[0.08] bg-[#120d24] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={`w-4 h-4 ${
                        taskType === 'regression' ? 'text-purple-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="text-sm font-semibold text-white">Predict a number</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
                  Use this when the answer is a numerical value, such as sales, revenue, price, or quantity.
                </p>
                <span className="text-[10px] text-purple-300/80 font-mono">Numerical (Regression)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Prediction Approaches (Automated by default) */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-xs font-semibold text-slate-200">Prediction approaches</label>
            <span className="text-[11px] text-slate-400">
              InfoLoom can test several approaches on your data and compare how well they predict the selected outcome.
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Automated Multi-Approach Testing</span>
                  <Badge variant="purple" className="text-[10px]">
                    {selectedAlgorithms.length} Approaches Selected
                  </Badge>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  InfoLoom tests diverse models (linear, tree-based ensemble, and gradient-boosted) and benchmarks them on unseen data so you get the most accurate result automatically.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs shrink-0 self-start sm:self-center"
            >
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              {showAdvanced ? 'Hide Advanced Settings' : 'Advanced Settings'}
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
              )}
            </Button>
          </div>
        </div>

        {/* 4. Predictive Features Selection */}
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div>
              <label className="text-xs font-semibold text-slate-200">
                What information should we use?
              </label>
              <p className="text-[11px] text-slate-400">
                Select the fields InfoLoom should use to make the prediction ({selectedFeatures.length} of {availableCandidateColumns.length} fields selected).
              </p>
            </div>
            <button
              type="button"
              onClick={selectAllUsefulFeatures}
              className="text-purple-400 hover:text-purple-300 text-xs font-medium self-start sm:self-auto"
            >
              Select all useful fields
            </button>
          </div>

          {detectedIdColumns.length > 0 && (
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04] text-[11px] text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Obvious identifier fields ({detectedIdColumns.join(', ')}) are excluded from predictive features by default to avoid misleading models.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 rounded-xl bg-[#120d24]/60 border border-white/[0.06]">
            {availableCandidateColumns.map((col) => {
              const isSelected = selectedFeatures.includes(col);
              const isId = isIdentifierColumn(col);
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => toggleFeature(col)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                      : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'
                  }`}
                >
                  <span>{col}</span>
                  {isId && (
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/60 text-amber-300 font-sans">
                      ID
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Optional Advanced Settings (Algorithms & Validation) */}
        {showAdvanced && (
          <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Advanced Settings
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">For experienced data practitioners</span>
            </div>

            {/* Algorithm Selection Checkboxes */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Individual Model Algorithms ({selectedAlgorithms.length} selected)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {availableAlgorithms.map((algo) => {
                  const isSelected = selectedAlgorithms.includes(algo.id);
                  return (
                    <div
                      key={algo.id}
                      onClick={() => toggleAlgorithm(algo.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-950/30'
                          : 'border-white/[0.08] bg-[#120d24]/60 hover:border-white/20 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-white">{algo.name}</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0 ${
                            isSelected
                              ? 'bg-purple-600 text-white'
                              : 'border border-white/20 text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{algo.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation Split & Folds */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5 text-purple-400" />
                    Holdout Test Set Size
                  </span>
                  <span className="text-purple-300 font-mono font-semibold">
                    {Math.round(testSize * 100)}% ({Math.round((1 - testSize) * 100)}% Training)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.4"
                  step="0.05"
                  value={testSize}
                  onChange={(e) => setTestSize(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">
                  InfoLoom automatically sets aside part of your data to check how well the model performs on data it has not seen before.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    Cross-Validation Folds
                  </span>
                  <span className="text-purple-300 font-mono font-semibold">{cvFolds}-Fold CV</span>
                </div>
                <div className="flex gap-2">
                  {[3, 5, 10].map((folds) => (
                    <button
                      key={folds}
                      type="button"
                      onClick={() => setCvFolds(folds)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        cvFolds === folds
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-[#181130] text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {folds} Folds
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Multiple validation folds ensure performance is reliable and not influenced by lucky splits.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 6. Primary Action Button */}
        <div className="pt-2 flex justify-end">
          <Button
            variant="glow"
            size="lg"
            onClick={handleStartTraining}
            disabled={!isReady || trainMutation.isPending || isTrainingActive || !inspection?.is_supported}
            className="w-full sm:w-auto"
          >
            {trainMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Starting Model Training...
              </span>
            ) : isTrainingActive ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-transparent animate-spin" />
                Training In Progress...
              </span>
            ) : (
              <span className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-4 h-4" />
                Train & Compare Models
                <ArrowRight className="w-4 h-4 ml-1" />
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
