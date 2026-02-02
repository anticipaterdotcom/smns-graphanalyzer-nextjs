'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Settings, AlertTriangle } from 'lucide-react';

interface AnalysisControlsProps {
  columns: number;
  onAnalyze: (column: number, minDistance: number, frequency: number) => void;
  isLoading?: boolean;
  hasExtrema?: boolean;
}

export default function AnalysisControls({ columns, onAnalyze, isLoading, hasExtrema }: AnalysisControlsProps) {
  const [column, setColumn] = useState(4);
  const [minDistance, setMinDistance] = useState(100);
  const [frequency, setFrequency] = useState(250);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<{column: number, minDistance: number, frequency: number} | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      onAnalyze(column, minDistance, frequency);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column, minDistance, frequency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasExtrema) {
      setPendingAnalysis({ column, minDistance, frequency });
      setShowWarning(true);
    } else {
      onAnalyze(column, minDistance, frequency);
    }
  };

  const confirmAnalysis = () => {
    if (pendingAnalysis) {
      onAnalyze(pendingAnalysis.column, pendingAnalysis.minDistance, pendingAnalysis.frequency);
    }
    setShowWarning(false);
    setPendingAnalysis(null);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary-500/20 border border-white/10">
          <Settings className="w-5 h-5 text-primary-400" />
        </div>
        <h3 className="font-semibold text-white">Analysis Parameters</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Column to Analyze</label>
          <select
            value={column}
            onChange={(e) => setColumn(Number(e.target.value))}
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {Array.from({ length: columns }, (_, i) => (
              <option key={i} value={i} className="bg-neutral-800">
                Column {i + 1}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Min Distance</label>
          <input
            type="number"
            value={minDistance}
            onChange={(e) => setMinDistance(Number(e.target.value))}
            min={1}
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">Frequency (Hz)</label>
          <input
            type="number"
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
            min={1}
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-emerald-500 transition-all disabled:opacity-50"
      >
        <Play className="w-4 h-4" />
        {isLoading ? 'Analyzing...' : 'Run Analysis'}
      </button>

      {showWarning && (
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">Warning: This will reset your extrema</p>
              <p className="text-xs text-neutral-400 mt-1">Running analysis will replace all manually edited extrema with auto-detected ones.</p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={confirmAnalysis}
                  className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-500 transition-colors"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setShowWarning(false)}
                  className="px-3 py-1.5 bg-neutral-700 text-white text-sm font-medium rounded-lg hover:bg-neutral-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
