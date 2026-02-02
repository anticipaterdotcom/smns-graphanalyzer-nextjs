'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Layers } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { getColumnData, PatternEvent } from '@/lib/api';

interface ReferenceAnalysisProps {
  sessionId: string;
  analyzedColumn: number;
  analyzedData: number[];
  events: PatternEvent[];
  totalColumns: number;
  onClose: () => void;
}

export default function ReferenceAnalysis({
  sessionId,
  analyzedColumn,
  analyzedData,
  events,
  totalColumns,
  onClose,
}: ReferenceAnalysisProps) {
  const [referenceColumn, setReferenceColumn] = useState(0);
  const [referenceData, setReferenceData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadReferenceData = async () => {
      if (referenceColumn === analyzedColumn) {
        setReferenceData(analyzedData);
        return;
      }
      
      setIsLoading(true);
      try {
        const result = await getColumnData(sessionId, referenceColumn);
        setReferenceData(result.data);
      } catch (err) {
        console.error('Failed to load reference data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadReferenceData();
  }, [sessionId, referenceColumn, analyzedColumn, analyzedData]);

  const patternRanges = useMemo(() => {
    return events.map((e) => ({ start: e.start_index, end: e.end_index }));
  }, [events]);

  const analyzedChartData = useMemo(() => {
    return analyzedData.map((value, index) => ({ index, value }));
  }, [analyzedData]);

  const referenceChartData = useMemo(() => {
    return referenceData.map((value, index) => ({ index, value }));
  }, [referenceData]);

  const sharedYDomain = useMemo(() => {
    const allValues = [...analyzedData, ...referenceData].filter(v => v !== 0);
    if (allValues.length === 0) return [0, 100];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [analyzedData, referenceData]);

  const columnOptions = Array.from({ length: totalColumns }, (_, i) => i);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
            <Layers className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Reference Analysis</h2>
            <p className="text-xs text-neutral-500">{events.length} pattern events detected</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-400">Reference Column:</label>
            <select
              value={referenceColumn}
              onChange={(e) => setReferenceColumn(Number(e.target.value))}
              className="px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-white text-sm"
            >
              {columnOptions.map((col) => (
                <option key={col} value={col}>
                  Column {col + 1}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-neutral-300 mb-2">
            Analysed Data from Column {analyzedColumn + 1}
          </p>
          <div className="h-[200px] rounded-xl bg-neutral-900/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyzedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis 
                  dataKey="index" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={sharedYDomain}
                  tickFormatter={(v) => v.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                {patternRanges.map((range, i) => (
                  <ReferenceArea
                    key={i}
                    x1={range.start}
                    x2={range.end}
                    fill="#fbbf24"
                    fillOpacity={0.2}
                    stroke="#fbbf24"
                    strokeOpacity={0.5}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-300 mb-2">
            Reference Data from Column {referenceColumn + 1}
            {isLoading && <span className="text-neutral-500 ml-2">Loading...</span>}
          </p>
          <div className="h-[200px] rounded-xl bg-neutral-900/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={referenceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis 
                  dataKey="index" 
                  stroke="#64748b" 
                  fontSize={10}
                  tickFormatter={(v) => `${v}`}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={sharedYDomain}
                  tickFormatter={(v) => v.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                {patternRanges.map((range, i) => (
                  <ReferenceArea
                    key={i}
                    x1={range.start}
                    x2={range.end}
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    stroke="#3b82f6"
                    strokeOpacity={0.6}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-xs text-neutral-500 mt-4 text-center">
        Yellow/Blue highlighted areas show detected pattern regions across both columns
      </p>
    </div>
  );
}
