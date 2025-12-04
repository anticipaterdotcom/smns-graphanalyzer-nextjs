'use client';

import { useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import { Extremum } from '@/lib/api';

interface GraphChartProps {
  data: number[];
  extrema: Extremum[];
  onChartClick?: (index: number) => void;
  selectedPattern?: number[];
  patternRanges?: { start: number; end: number }[];
  highlightRange?: { start: number; end: number } | null;
  highlightIndex?: number | null;
}

export default function GraphChart({
  data,
  extrema,
  onChartClick,
  patternRanges = [],
  highlightRange,
  highlightIndex,
}: GraphChartProps) {
  const chartData = useMemo(() => {
    return data.map((value, index) => ({
      index,
      value,
    }));
  }, [data]);

  const maxima = useMemo(() => extrema.filter((e) => e.type === 1), [extrema]);
  const minima = useMemo(() => extrema.filter((e) => e.type === 0), [extrema]);

  const handleClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!onChartClick) return;
      
      const index = e?.activeLabel ?? e?.activePayload?.[0]?.payload?.index;
      if (index !== undefined) {
        onChartClick(index);
      }
    },
    [onChartClick]
  );

  const isInPatternRange = useCallback(
    (index: number) => {
      return patternRanges.some((range) => index >= range.start && index <= range.end);
    },
    [patternRanges]
  );

  const isInHighlightRange = useCallback(
    (index: number) => {
      if (!highlightRange) return false;
      return index >= highlightRange.start && index <= highlightRange.end;
    },
    [highlightRange]
  );

  const enhancedChartData = useMemo(() => {
    return chartData.map((point) => ({
      ...point,
      inPattern: isInPatternRange(point.index) ? point.value : null,
      highlighted: isInHighlightRange(point.index) ? point.value : null,
    }));
  }, [chartData, isInPatternRange, isInHighlightRange]);

  if (data.length === 0) {
    return (
      <div className="card p-8 text-center text-neutral-400">
        No data to display. Upload a CSV file and run analysis.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-white">Signal Graph</h3>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-2 text-neutral-300">
            <span className="w-3 h-3 rounded-full bg-primary-500" />
            Maxima ({maxima.length})
          </span>
          <span className="flex items-center gap-2 text-neutral-300">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Minima ({minima.length})
          </span>
        </div>
      </div>

      <div className="h-[400px] rounded-xl bg-neutral-900/50 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={enhancedChartData} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="index"
              stroke="#64748b"
              fontSize={12}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '12px',
                color: '#fff',
              }}
              formatter={(value: number) => [value.toFixed(4), 'Value']}
              labelFormatter={(label) => `Index: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="inPattern"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="highlighted"
              stroke="#f59e0b"
              strokeWidth={4}
              dot={false}
              isAnimationActive={false}
            />
            {maxima.map((ext) => (
              <ReferenceDot
                key={`max-${ext.index}`}
                x={ext.index}
                y={ext.value}
                r={6}
                fill="#3b82f6"
                stroke="#0f172a"
                strokeWidth={2}
              />
            ))}
            {minima.map((ext) => (
              <ReferenceDot
                key={`min-${ext.index}`}
                x={ext.index}
                y={ext.value}
                r={6}
                fill="#10b981"
                stroke="#0f172a"
                strokeWidth={2}
              />
            ))}
            {highlightIndex !== null && highlightIndex !== undefined && (
              <ReferenceDot
                key="highlight"
                x={highlightIndex}
                y={data[highlightIndex] ?? 0}
                r={12}
                fill="#f59e0b"
                stroke="#fff"
                strokeWidth={3}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-neutral-500 mt-4">
        Click on the chart to add/remove extrema. Total points: {data.length}
      </p>
    </div>
  );
}
