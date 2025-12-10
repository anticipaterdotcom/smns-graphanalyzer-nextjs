'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Download, X } from 'lucide-react';
import { MeanTrendResponse } from '@/lib/api';

interface MeanTrendChartProps {
  data: MeanTrendResponse | null;
  isLoading?: boolean;
  targetLength: number | 'auto';
  onTargetLengthChange: (value: number | 'auto') => void;
  onClose?: () => void;
}

export default function MeanTrendChart({
  data,
  isLoading,
  targetLength,
  onTargetLengthChange,
  onClose,
}: MeanTrendChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.mean.map((mean, index) => ({
      index,
      mean,
      upper: mean + data.std[index],
      lower: mean - data.std[index],
      std: data.std[index],
    }));
  }, [data]);

  const handleExportCSV = () => {
    if (!data) return;

    const headers = ['index', 'mean', 'std', 'upper_bound', 'lower_bound'];
    const rows = chartData.map((row) => [
      row.index,
      row.mean.toFixed(6),
      row.std.toFixed(6),
      row.upper.toFixed(6),
      row.lower.toFixed(6),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mean_trend_${data.event_count}_cycles.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 border border-white/10">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Mean Trend</h3>
            {data && (
              <p className="text-xs text-neutral-400">
                Averaged from {data.event_count} cycles
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-neutral-400">Length:</label>
            <select
              value={targetLength === 'auto' ? 'auto' : targetLength}
              onChange={(e) =>
                onTargetLengthChange(
                  e.target.value === 'auto' ? 'auto' : Number(e.target.value)
                )
              }
              className="px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="auto">Auto</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          {data && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="h-[300px] rounded-xl bg-neutral-900/50 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/30 border-t-purple-500" />
          </div>
        ) : !data || data.mean.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500">
            No pattern events detected. Select a pattern to calculate mean trend.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="index"
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Normalized Time', position: 'bottom', fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Value', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = {
                    mean: 'Mean',
                    upper: 'Upper (μ+σ)',
                    lower: 'Lower (μ-σ)',
                  };
                  return [value.toFixed(4), labels[name] || name];
                }}
                labelFormatter={(label) => `Point: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="none"
                fill="#ef4444"
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="none"
                fill="#0f172a"
                fillOpacity={1}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="upper"
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="lower"
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="mean"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {data && data.mean.length > 0 && (
        <div className="flex gap-6 mt-4 text-xs text-neutral-400">
          <span className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-purple-500 rounded" />
            Mean trend
          </span>
          <span className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-red-500 rounded opacity-50" style={{ borderStyle: 'dashed' }} />
            ±1 Std deviation
          </span>
        </div>
      )}
    </div>
  );
}
