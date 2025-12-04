'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Settings } from 'lucide-react';

interface AnalysisControlsProps {
  columns: number;
  onAnalyze: (column: number, minDistance: number, frequency: number) => void;
  isLoading?: boolean;
}

export default function AnalysisControls({ columns, onAnalyze, isLoading }: AnalysisControlsProps) {
  const [column, setColumn] = useState(4);
  const [minDistance, setMinDistance] = useState(100);
  const [frequency, setFrequency] = useState(250);
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
    onAnalyze(column, minDistance, frequency);
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
    </form>
  );
}
