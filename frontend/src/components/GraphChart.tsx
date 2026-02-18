'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { Image, Plus, Minus, MousePointer, X } from 'lucide-react';
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
import { Extremum, PatternEvent, exportAllColumns } from '@/lib/api';
import { Download } from 'lucide-react';

interface GraphChartProps {
  data: number[];
  extrema: Extremum[];
  onChartClick?: (index: number) => void;
  selectedPattern?: number[];
  patternRanges?: { start: number; end: number }[];
  highlightRange?: { start: number; end: number } | null;
  highlightIndex?: number | null;
  editMode?: boolean;
  editAction?: 'add-max' | 'add-min' | 'remove' | null;
  onToggleEditMode?: () => void;
  onEditActionChange?: (action: 'add-max' | 'add-min' | 'remove') => void;
  onAddExtremum?: (index: number, type: string, epsilon?: number) => void;
  onRemoveExtremum?: (index: number) => void;
  epsilon?: number;
  onEpsilonChange?: (value: number) => void;
  highlightedExtremumIndex?: number | null;
  events?: PatternEvent[];
  onPatternChange?: (pattern: number[]) => void;
  onEventHover?: (event: PatternEvent | null) => void;
  onClose?: () => void;
  sessionId?: string;
  frequency?: number;
}

export default function GraphChart({
  data,
  extrema,
  onChartClick,
  selectedPattern = [0, 1, 0],
  patternRanges = [],
  highlightRange,
  highlightIndex,
  editMode = false,
  editAction,
  onToggleEditMode,
  onEditActionChange,
  onAddExtremum,
  onRemoveExtremum,
  epsilon = 20,
  onEpsilonChange,
  highlightedExtremumIndex,
  events = [],
  onPatternChange,
  onEventHover,
  onClose,
  sessionId,
  frequency = 250,
}: GraphChartProps) {
  const isHighLowHigh = selectedPattern[1] === 0;
  const chartRef = useRef<HTMLDivElement>(null);
  const [localHighlightIndex, setLocalHighlightIndex] = useState<number | null>(null);

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
      if (!e) return;
      const index = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
      if (index === undefined || index === null) return;
      const numIndex = Number(index);

      if (editMode && editAction) {
        if (editAction === 'remove') {
          onRemoveExtremum?.(numIndex);
        } else {
          onAddExtremum?.(numIndex, editAction === 'add-max' ? 'max' : 'min', epsilon);
        }
        return;
      }

      onChartClick?.(numIndex);
    },
    [onChartClick, editMode, editAction, onAddExtremum, onRemoveExtremum, epsilon]
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

  const getXAxisConfig = useMemo(() => {
    const len = data.length;
    let step: number;
    if (len <= 50) step = 5;
    else if (len <= 100) step = 10;
    else if (len <= 200) step = 20;
    else if (len <= 500) step = 50;
    else if (len <= 1000) step = 100;
    else if (len <= 2000) step = 200;
    else step = 500;
    
    const ticks: number[] = [1];
    const max = Math.ceil(len / step) * step;
    for (let i = step; i <= max; i += step) {
      ticks.push(i);
    }
    return { ticks, max };
  }, [data.length]);

  const getYAxisDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 10];
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    let yMax: number;
    if (maxVal < 5) yMax = 5;
    else yMax = Math.ceil(maxVal / 10) * 10;
    const yMin = Math.floor(minVal / 10) * 10;
    return [yMin, yMax];
  }, [data]);

  const buildCSV = useCallback(() => {
    if (events.length === 0) return '';
    const headers = [
      'Cycle', 'Pattern Type',
      'Start Value', 'Start Time (s)', 'Start Index',
      'Inflexion Value', 'Inflexion Time (s)', 'Inflexion Index',
      'End Value', 'End Time (s)', 'End Index',
      'Shift Start-Inflexion', 'Shift Inflexion-End',
      'Time Start-Inflexion (s)', 'Time Inflexion-End (s)',
      'Cycle Time (s)', 'Intercycle Time (s)',
    ];
    const rows = events.map((evt, i) => [
      i + 1, evt.pattern_type,
      evt.start_value.toFixed(4), evt.start_time.toFixed(4), evt.start_index,
      evt.inflexion_value.toFixed(4), evt.inflexion_time.toFixed(4), evt.inflexion_index,
      evt.end_value.toFixed(4), evt.end_time.toFixed(4), evt.end_index,
      evt.shift_start_to_inflexion.toFixed(4), evt.shift_inflexion_to_end.toFixed(4),
      evt.time_start_to_inflexion.toFixed(4), evt.time_inflexion_to_end.toFixed(4),
      evt.cycle_time.toFixed(4),
      evt.intercycle_time !== null ? evt.intercycle_time.toFixed(4) : '',
    ]);
    return [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  }, [events]);

  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = useCallback(async () => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const result = await exportAllColumns(sessionId, selectedPattern, 10, frequency);
      const patternName = selectedPattern[1] === 1 ? 'LHL' : 'HLH';
      const headers = [
        'Column', 'Cycle', 'Pattern Type',
        'Start Value', 'Start Time (s)', 'Start Index',
        'Inflexion Value', 'Inflexion Time (s)', 'Inflexion Index',
        'End Value', 'End Time (s)', 'End Index',
        'Shift Start-Inflexion', 'Shift Inflexion-End',
        'Time Start-Inflexion (s)', 'Time Inflexion-End (s)',
        'Cycle Time (s)', 'Intercycle Time (s)',
      ];
      const rows: string[][] = [];
      for (let col = 0; col < result.columns; col++) {
        const colResult = result.results[String(col)];
        if (!colResult || colResult.events.length === 0) continue;
        colResult.events.forEach((evt, i) => {
          rows.push([
            `Col ${col + 1}`, String(i + 1), evt.pattern_type,
            evt.start_value.toFixed(4), evt.start_time.toFixed(4), String(evt.start_index),
            evt.inflexion_value.toFixed(4), evt.inflexion_time.toFixed(4), String(evt.inflexion_index),
            evt.end_value.toFixed(4), evt.end_time.toFixed(4), String(evt.end_index),
            evt.shift_start_to_inflexion.toFixed(4), evt.shift_inflexion_to_end.toFixed(4),
            evt.time_start_to_inflexion.toFixed(4), evt.time_inflexion_to_end.toFixed(4),
            evt.cycle_time.toFixed(4),
            evt.intercycle_time !== null ? evt.intercycle_time.toFixed(4) : '',
          ]);
        });
      }
      const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
      const filename = `parameters_all_columns_${patternName}_${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [sessionId, selectedPattern, frequency]);

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    if (!chartRef.current) return;
    const svgElement = chartRef.current.querySelector('svg');
    if (!svgElement) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `main_trend.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new window.Image();
      canvas.width = svgElement.clientWidth * 2;
      canvas.height = svgElement.clientHeight * 2;
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `main_trend.jpg`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }, 'image/jpeg', 0.95);
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  }, []);


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
        <h3 className="font-semibold text-white">Main Trend</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 text-neutral-300">
            <span className="w-3 h-3 rounded-full bg-primary-500" />
            Maxima ({maxima.length})
          </span>
          <span className="flex items-center gap-2 text-neutral-300">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            Minima ({minima.length})
          </span>
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

      <div ref={chartRef} className={`h-[400px] rounded-xl bg-neutral-900/50 p-4 ${editMode ? 'cursor-crosshair ring-2 ring-primary-500/50' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={enhancedChartData} onClick={handleClick}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
            <XAxis
              dataKey="index"
              type="number"
              stroke="#64748b"
              fontSize={12}
              domain={[1, getXAxisConfig.max]}
              ticks={getXAxisConfig.ticks}
            />
            <YAxis stroke="#64748b" fontSize={12} domain={getYAxisDomain} />
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
            {maxima.map((ext, i) => {
              const isHighlighted = highlightedExtremumIndex === ext.index || localHighlightIndex === ext.index;
              return (
                <ReferenceDot
                  key={`max-${ext.index}-${i}`}
                  x={ext.index}
                  y={ext.value}
                  r={isHighlighted ? 10 : 6}
                  fill={isHighLowHigh ? '#10b981' : '#3b82f6'}
                  stroke={isHighlighted ? '#fff' : '#0f172a'}
                  strokeWidth={isHighlighted ? 3 : 2}
                />
              );
            })}
            {minima.map((ext, i) => {
              const isHighlighted = highlightedExtremumIndex === ext.index || localHighlightIndex === ext.index;
              return (
                <ReferenceDot
                  key={`min-${ext.index}-${i}`}
                  x={ext.index}
                  y={ext.value}
                  r={isHighlighted ? 10 : 6}
                  fill={isHighLowHigh ? '#3b82f6' : '#10b981'}
                  stroke={isHighlighted ? '#fff' : '#0f172a'}
                  strokeWidth={isHighlighted ? 3 : 2}
                />
              );
            })}
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

      {onPatternChange && (
        <div className="mt-4 p-4 bg-neutral-900/50 rounded-xl">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Pattern:</span>
              <button
                onClick={() => onPatternChange([0, 1, 0])}
                className={`px-3 py-1 text-xs rounded ${selectedPattern[1] === 1 ? 'bg-primary-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                Low → High → Low
              </button>
              <button
                onClick={() => onPatternChange([1, 0, 1])}
                className={`px-3 py-1 text-xs rounded ${selectedPattern[1] === 0 ? 'bg-primary-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                High → Low → High
              </button>
            </div>
            {onToggleEditMode && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">Edit:</span>
                <button
                  onClick={onToggleEditMode}
                  className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${editMode ? 'bg-primary-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <MousePointer className="w-3 h-3" />
                  {editMode ? 'ON' : 'OFF'}
                </button>
                {editMode && (
                  <>
                    <button
                      onClick={() => onEditActionChange?.('add-max')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'add-max' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <Plus className="w-3 h-3" /> Max
                    </button>
                    <button
                      onClick={() => onEditActionChange?.('add-min')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'add-min' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <Plus className="w-3 h-3" /> Min
                    </button>
                    <button
                      onClick={() => onEditActionChange?.('remove')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'remove' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <Minus className="w-3 h-3" /> Remove
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Epsilon:</span>
              <input
                type="number"
                value={epsilon}
                onChange={(e) => onEpsilonChange?.(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
                min={1}
                max={100}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Extrema:</span>
              <span className="text-xs text-blue-400">{maxima.length} Max</span>
              <span className="text-xs text-emerald-400">{minima.length} Min</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Events:</span>
              <span className="text-xs text-primary-400 font-semibold">{events.length}</span>
            </div>
          </div>

          {events.length > 0 && (
            <>
            <div className="flex items-center justify-end mb-2">
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-500 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {isExporting ? 'Exporting...' : 'Export Parameters'}
              </button>
            </div>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-neutral-900">
                  <tr className="text-neutral-400 border-b border-white/10">
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Start</th>
                    <th className="px-2 py-1 text-left">Inflexion</th>
                    <th className="px-2 py-1 text-left">End</th>
                    <th className="px-2 py-1 text-left">Cycle Time</th>
                    <th className="px-2 py-1 text-left">Intercycle</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((evt, i) => (
                    <tr
                      key={i}
                      className="text-neutral-300 border-b border-white/5 cursor-pointer hover:bg-primary-500/20 transition-colors"
                      onMouseEnter={() => onEventHover?.(evt)}
                      onMouseLeave={() => onEventHover?.(null)}
                    >
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{evt.start_value.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.inflexion_value.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.end_value.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.cycle_time.toFixed(3)}s</td>
                      <td className="px-2 py-1">{evt.intercycle_time !== null ? `${evt.intercycle_time.toFixed(3)}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {onRemoveExtremum && (
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-blue-400">Maxima ({maxima.length})</span>
              {editMode && editAction === 'add-max' && (
                <span className="text-xs text-primary-400">Click chart to add</span>
              )}
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {maxima.map((ext, i) => (
                <div
                  key={`max-${ext.index}-${i}`}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${localHighlightIndex === ext.index ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                  onMouseEnter={() => setLocalHighlightIndex(ext.index)}
                  onMouseLeave={() => setLocalHighlightIndex(null)}
                >
                  <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                  <button
                    onClick={() => onRemoveExtremum(ext.index)}
                    className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {maxima.length === 0 && <span className="text-xs text-neutral-500">No maxima</span>}
            </div>
          </div>
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-emerald-400">Minima ({minima.length})</span>
              {editMode && editAction === 'add-min' && (
                <span className="text-xs text-primary-400">Click chart to add</span>
              )}
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {minima.map((ext, i) => (
                <div
                  key={`min-${ext.index}-${i}`}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${localHighlightIndex === ext.index ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                  onMouseEnter={() => setLocalHighlightIndex(ext.index)}
                  onMouseLeave={() => setLocalHighlightIndex(null)}
                >
                  <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                  <button
                    onClick={() => onRemoveExtremum(ext.index)}
                    className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {minima.length === 0 && <span className="text-xs text-neutral-500">No minima</span>}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-neutral-500">
          Total points: {data.length}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => exportImage('png')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            <Image className="w-4 h-4" />
            JPG
          </button>
          <button
            onClick={() => exportImage('svg')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            <Image className="w-4 h-4" />
            SVG
          </button>
        </div>
      </div>
    </div>
  );
}
