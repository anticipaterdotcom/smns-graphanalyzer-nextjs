'use client';

import { useState } from 'react';
import { Plus, Minus, MousePointer, X, TrendingUp, TrendingDown } from 'lucide-react';

interface Extremum {
  value: number;
  index: number;
  type: number;
}

interface ExtremaEditorProps {
  onAddExtremum: (index: number, type: string, epsilon: number) => void;
  onRemoveExtremum: (index: number) => void;
  isActive: boolean;
  onToggleActive: () => void;
  editAction: 'add-max' | 'add-min' | 'remove' | null;
  onEditActionChange: (action: 'add-max' | 'add-min' | 'remove') => void;
  extrema: Extremum[];
  onExtremumHover?: (index: number | null) => void;
  snapToPeak: boolean;
  onSnapToPeakChange: (snap: boolean) => void;
}

export default function ExtremaEditor({
  onAddExtremum,
  onRemoveExtremum,
  isActive,
  onToggleActive,
  editAction,
  onEditActionChange,
  extrema,
  onExtremumHover,
  snapToPeak,
  onSnapToPeakChange,
}: ExtremaEditorProps) {
  const [inputIndex, setInputIndex] = useState('');
  
  const maxima = extrema.filter(e => e.type === 1);
  const minima = extrema.filter(e => e.type === 0);

  const handleAction = () => {
    const index = parseInt(inputIndex);
    if (isNaN(index) || !editAction) return;

    if (editAction === 'remove') {
      onRemoveExtremum(index);
    } else {
      const epsilon = snapToPeak ? 20 : 0;
      onAddExtremum(index, editAction === 'add-max' ? 'max' : 'min', epsilon);
    }
    setInputIndex('');
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-500/20 border border-white/10">
            <MousePointer className="w-5 h-5 text-primary-400" />
          </div>
          <h3 className="font-semibold text-white">Edit Extrema</h3>
        </div>
        <button
          onClick={onToggleActive}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            isActive
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'
          }`}
        >
          {isActive ? 'Click Mode Active' : 'Enable Click Mode'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              onEditActionChange('add-max');
              if (!isActive) onToggleActive();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              editAction === 'add-max'
                ? 'bg-primary-500/90 text-white shadow-lg shadow-primary-500/20'
                : 'bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Max
          </button>
          <button
            onClick={() => {
              onEditActionChange('add-min');
              if (!isActive) onToggleActive();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              editAction === 'add-min'
                ? 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Min
          </button>
          <button
            onClick={() => {
              onEditActionChange('remove');
              if (!isActive) onToggleActive();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              editAction === 'remove'
                ? 'bg-red-500/90 text-white shadow-lg shadow-red-500/20'
                : 'bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Minus className="w-4 h-4" />
            Remove
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={inputIndex}
            onChange={(e) => setInputIndex(e.target.value)}
            placeholder="Enter index..."
            className="flex-1 px-4 py-2.5 bg-neutral-800 border border-neutral-600 rounded-xl text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={handleAction}
            disabled={!inputIndex || !editAction}
            className="px-5 py-2.5 bg-neutral-700 border border-neutral-600 text-white font-medium rounded-xl hover:bg-neutral-600 transition-colors disabled:opacity-50"
          >
            Apply
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            {isActive
              ? 'Click on the chart to add/remove extrema at that position.'
              : 'Enable click mode or enter an index manually to edit extrema.'}
          </p>
          <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={snapToPeak}
              onChange={(e) => onSnapToPeakChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500/20"
            />
            Snap to peak
          </label>
        </div>

        {/* Extrema Lists */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Maxima List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary-400">
              <TrendingUp className="w-4 h-4" />
              Maxima ({maxima.length})
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {maxima.map((ext, i) => (
                <div
                  key={`max-${ext.index}-${i}`}
                  className="flex items-center justify-between px-2 py-1 bg-primary-500/10 hover:bg-primary-500/30 rounded-lg text-xs cursor-pointer transition-colors"
                  onMouseEnter={() => onExtremumHover?.(ext.index)}
                  onMouseLeave={() => onExtremumHover?.(null)}
                >
                  <span className="text-neutral-300">
                    #{ext.index} <span className="text-primary-400">{ext.value.toFixed(2)}</span>
                  </span>
                  <button
                    onClick={() => onRemoveExtremum(ext.index)}
                    className="p-0.5 hover:bg-red-500/20 rounded text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Minima List */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <TrendingDown className="w-4 h-4" />
              Minima ({minima.length})
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {minima.map((ext, i) => (
                <div
                  key={`min-${ext.index}-${i}`}
                  className="flex items-center justify-between px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/30 rounded-lg text-xs cursor-pointer transition-colors"
                  onMouseEnter={() => onExtremumHover?.(ext.index)}
                  onMouseLeave={() => onExtremumHover?.(null)}
                >
                  <span className="text-neutral-300">
                    #{ext.index} <span className="text-emerald-400">{ext.value.toFixed(2)}</span>
                  </span>
                  <button
                    onClick={() => onRemoveExtremum(ext.index)}
                    className="p-0.5 hover:bg-red-500/20 rounded text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
