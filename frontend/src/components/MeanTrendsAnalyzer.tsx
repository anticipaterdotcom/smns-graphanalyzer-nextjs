'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Download, X, Upload, Image } from 'lucide-react';
import { MeanTrendExtendedResponse, getMeanTrendExtended } from '@/lib/api';

interface MeanTrendsAnalyzerProps {
  sessionId: string | null;
  pattern: number[];
  column: number;
  events: { start_index: number; end_index: number }[];
  onClose?: () => void;
}

type PlotView = 'mean' | 'overlay' | 'raw';
type LengthMode = 'average' | 'percentage';
type InterpolationMethod = 'linear' | 'spline';

const CYCLE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#eab308', '#dc2626', '#a855f7', '#d946ef',
];

export default function MeanTrendsAnalyzer({
  sessionId,
  pattern,
  column,
  events,
  onClose,
}: MeanTrendsAnalyzerProps) {
  const [data, setData] = useState<MeanTrendExtendedResponse | null>(null);
  const [csvData, setCsvData] = useState<number[][] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plotView, setPlotView] = useState<PlotView>('mean');
  const [lengthMode, setLengthMode] = useState<LengthMode>('average');
  const [interpolation, setInterpolation] = useState<InterpolationMethod>('linear');
  
  const chartRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromSession = useCallback(async () => {
    if (!sessionId || events.length < 2) return;
    
    setIsLoading(true);
    setError(null);
    setCsvData(null);
    
    try {
      const result = await getMeanTrendExtended(
        sessionId,
        pattern,
        column,
        undefined,
        lengthMode,
        interpolation
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trend data');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, pattern, column, events.length, lengthMode, interpolation]);

  useEffect(() => {
    loadFromSession();
  }, []);

  const processCSVWithInterpolation = useCallback((segments: number[][]) => {
    const lengths = segments.map(s => s.length);
    const avgLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const targetLength = lengthMode === 'percentage' ? 100 : avgLength;
    
    const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
      const t2 = t * t;
      const t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    
    const normalized: number[][] = segments.map(segment => {
      const result: number[] = [];
      for (let i = 0; i < targetLength; i++) {
        const pos = (i / (targetLength - 1)) * (segment.length - 1);
        const low = Math.floor(pos);
        const high = Math.ceil(pos);
        const frac = pos - low;
        
        if (interpolation === 'spline' && segment.length >= 4) {
          const p0 = segment[Math.max(0, low - 1)];
          const p1 = segment[low];
          const p2 = segment[Math.min(segment.length - 1, high)];
          const p3 = segment[Math.min(segment.length - 1, high + 1)];
          result.push(catmull(p0, p1, p2, p3, frac));
        } else {
          result.push(segment[low] + frac * (segment[high] - segment[low]));
        }
      }
      return result;
    });
    
    const mean: number[] = [];
    const std: number[] = [];
    for (let i = 0; i < targetLength; i++) {
      const values = normalized.map(s => s[i]);
      const m = values.reduce((a, b) => a + b, 0) / values.length;
      mean.push(m);
      const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
      std.push(Math.sqrt(variance));
    }
    
    setData({
      mean,
      std,
      normalized_segments: normalized,
      raw_segments: segments,
      target_length: targetLength,
      average_length: avgLength,
      event_count: segments.length,
      lengths,
    });
  }, [lengthMode, interpolation]);

  useEffect(() => {
    if (csvData && csvData.length > 0) {
      processCSVWithInterpolation(csvData);
    } else if (data) {
      loadFromSession();
    }
  }, [lengthMode, interpolation, csvData, processCSVWithInterpolation, loadFromSession]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split('\n');
        const delimiter = text.includes(';') ? ';' : ',';
        
        const columns: number[][] = [];
        const numCols = lines[0].split(delimiter).length;
        
        for (let i = 0; i < numCols; i++) {
          columns.push([]);
        }
        
        for (const line of lines) {
          const values = line.split(delimiter).map(v => parseFloat(v.trim()));
          values.forEach((val, idx) => {
            if (idx < numCols && !isNaN(val)) {
              columns[idx].push(val);
            }
          });
        }
        
        const validColumns = columns.filter(col => col.length > 0);
        if (validColumns.length === 0) {
          setError('No valid data found in CSV');
          return;
        }
        
        setCsvData(validColumns);
        processCSVWithInterpolation(validColumns);
      } catch (err) {
        setError('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [processCSVWithInterpolation]);

  const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  };

  const meanChartData = useMemo(() => {
    if (!data) return [];
    return data.mean.map((mean, index) => ({
      index: index + 1,
      mean,
      upper: mean + data.std[index],
      lower: mean - data.std[index],
    }));
  }, [data]);

  const getXAxisConfig = useMemo(() => {
    if (!data) return { ticks: undefined, max: undefined };
    const len = data.target_length;
    let step: number;
    if (len <= 50) step = 5;
    else if (len <= 100) step = 10;
    else if (len <= 200) step = 20;
    else if (len <= 500) step = 50;
    else step = 100;
    
    const ticks: number[] = [];
    const max = Math.ceil(len / step) * step;
    for (let i = step; i <= max; i += step) {
      ticks.push(i);
    }
    return { ticks, max };
  }, [data]);

  const getYAxisDomain = useMemo((): [number, number] | undefined => {
    if (!data) return undefined;
    const allValues = [
      ...data.mean,
      ...data.mean.map((m, i) => m + data.std[i]),
      ...data.normalized_segments.flat(),
      ...data.raw_segments.flat(),
    ];
    const maxVal = Math.max(...allValues);
    let yMax: number;
    if (maxVal < 5) {
      yMax = 5;
    } else {
      yMax = Math.ceil(maxVal / 10) * 10;
    }
    return [0, yMax];
  }, [data]);

  const overlayChartData = useMemo(() => {
    if (!data) return [];
    return data.mean.map((mean, index) => {
      const point: Record<string, number> = {
        index: index + 1,
        mean,
        upper: mean + data.std[index],
        lower: mean - data.std[index],
      };
      data.normalized_segments.forEach((seg, i) => {
        point[`cycle${i}`] = seg[index];
      });
      return point;
    });
  }, [data]);

  const rawChartData = useMemo(() => {
    if (!data) return [];
    const maxLen = Math.max(...data.raw_segments.map(s => s.length));
    const result: Record<string, number | undefined>[] = [];
    for (let i = 0; i < maxLen; i++) {
      const point: Record<string, number | undefined> = { index: i + 1 };
      data.raw_segments.forEach((seg, j) => {
        point[`cycle${j}`] = i < seg.length ? seg[i] : undefined;
      });
      result.push(point);
    }
    return result;
  }, [data]);

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
      a.download = `mean_trends_${plotView}.svg`;
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
              a.download = `mean_trends_${plotView}.jpg`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }, 'image/jpeg', 0.95);
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  }, [plotView]);

  const exportCSV = useCallback(() => {
    if (!data) return;
    
    let csv = '';
    if (plotView === 'mean') {
      csv = 'index,mean,std,upper,lower\n';
      meanChartData.forEach(row => {
        csv += `${row.index},${row.mean},${data.std[row.index]},${row.upper},${row.lower}\n`;
      });
    } else if (plotView === 'overlay') {
      const headers = ['index', 'mean', 'upper', 'lower', ...data.normalized_segments.map((_, i) => `cycle${i + 1}`)];
      csv = headers.join(',') + '\n';
      overlayChartData.forEach(row => {
        const values = [row.index, row.mean, row.upper, row.lower, ...data.normalized_segments.map((_, i) => row[`cycle${i}`])];
        csv += values.join(',') + '\n';
      });
    } else {
      const headers = ['index', ...data.raw_segments.map((_, i) => `cycle${i + 1}`)];
      csv = headers.join(',') + '\n';
      rawChartData.forEach(row => {
        const values = [row.index, ...data.raw_segments.map((_, i) => row[`cycle${i}`] ?? '')];
        csv += values.join(',') + '\n';
      });
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mean_trends_${plotView}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, plotView, meanChartData, overlayChartData, rawChartData]);

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-white/10">
            <TrendingUp className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Mean Trends</h3>
            {data && (
              <p className="text-xs text-neutral-400">
                {data.event_count} cycles • Target length: {data.target_length}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Controls */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Data Source */}
        <div className="space-y-2">
          <label className="text-xs text-neutral-400 uppercase tracking-wide">Data Source</label>
          <div className="flex gap-2">
            <button
              onClick={loadFromSession}
              disabled={isLoading || !sessionId || events.length < 2}
              className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              Use Events
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
              title="Upload CSV (columns = cycles)"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          <a
            href="/example_cycles.csv"
            download
            className="text-xs text-purple-400 hover:text-purple-300 underline"
          >
            Example CSV
          </a>
        </div>

        {/* Length Mode */}
        <div className="space-y-2">
          <label className="text-xs text-neutral-400 uppercase tracking-wide">Normalize To</label>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setLengthMode('percentage')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                lengthMode === 'percentage'
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              100%
            </button>
            <button
              onClick={() => setLengthMode('average')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                lengthMode === 'average'
                  ? 'bg-purple-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Mean Length
            </button>
          </div>
        </div>

        {/* Interpolation */}
        <div className="space-y-2">
          <label className="text-xs text-neutral-400 uppercase tracking-wide">Interpolation</label>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setInterpolation('linear')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                interpolation === 'linear'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Linear
            </button>
            <button
              onClick={() => setInterpolation('spline')}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                interpolation === 'spline'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Spline
            </button>
          </div>
        </div>

        {/* Plot View */}
        <div className="space-y-2">
          <label className="text-xs text-neutral-400 uppercase tracking-wide">Plot View</label>
          <select
            value={plotView}
            onChange={(e) => setPlotView(e.target.value as PlotView)}
            className="w-full px-3 py-2 bg-neutral-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <option value="mean">Mean ± SD</option>
            <option value="overlay">Mean + All Normalized</option>
            <option value="raw">Raw Cycles</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Chart */}
      <div ref={chartRef} className="h-[350px] rounded-xl bg-neutral-900/50 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500/30 border-t-purple-500" />
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2">
            <TrendingUp className="w-8 h-8 opacity-50" />
            <p>Load data from detected events or upload a CSV file</p>
          </div>
        ) : plotView === 'mean' ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={meanChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="index"
                type="number"
                stroke="#64748b"
                fontSize={12}
                domain={[1, getXAxisConfig.max || 'auto']}
                ticks={getXAxisConfig.ticks}
                label={{ value: lengthMode === 'percentage' ? 'Normalized Time (%)' : 'Normalized Time', position: 'bottom', fill: '#64748b', fontSize: 11 }}
              />
              <YAxis stroke="#64748b" fontSize={12} domain={getYAxisDomain} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { mean: 'Mean', upper: 'Upper (μ+σ)', lower: 'Lower (μ-σ)' };
                  return [value.toFixed(4), labels[name] || name];
                }}
              />
              <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.2} isAnimationActive={false} />
              <Area type="monotone" dataKey="lower" stroke="none" fill="#0f172a" fillOpacity={1} isAnimationActive={false} />
              <Line type="monotone" dataKey="upper" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="lower" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="mean" stroke="#ec4899" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : plotView === 'overlay' ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={overlayChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="index"
                type="number"
                stroke="#64748b"
                fontSize={12}
                domain={[1, getXAxisConfig.max || 'auto']}
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
              />
              <Area type="monotone" dataKey="upper" stroke="none" fill="#8b5cf6" fillOpacity={0.15} isAnimationActive={false} />
              <Area type="monotone" dataKey="lower" stroke="none" fill="#0f172a" fillOpacity={1} isAnimationActive={false} />
              {data.normalized_segments.map((_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`cycle${i}`}
                  stroke={CYCLE_COLORS[i % CYCLE_COLORS.length]}
                  strokeWidth={1}
                  strokeOpacity={0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              <Line type="monotone" dataKey="mean" stroke="#ec4899" strokeWidth={3} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rawChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                dataKey="index"
                stroke="#64748b"
                fontSize={12}
                domain={[1, 'auto']}
                label={{ value: 'Original Time', position: 'bottom', fill: '#64748b', fontSize: 11 }}
              />
              <YAxis stroke="#64748b" fontSize={12} domain={getYAxisDomain} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              {data.raw_segments.map((seg, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`cycle${i}`}
                  stroke={CYCLE_COLORS[i % CYCLE_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend & Export */}
      {data && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-4 text-xs text-neutral-400">
            {plotView === 'mean' && (
              <>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-pink-500 rounded" />
                  Mean
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-purple-500 rounded opacity-50" />
                  ±1 SD
                </span>
              </>
            )}
            {plotView === 'overlay' && (
              <span>
                Showing {data.event_count} normalized cycles + mean
              </span>
            )}
            {plotView === 'raw' && (
              <span>
                Showing {data.event_count} raw cycles (lengths: {Math.min(...data.lengths)} - {Math.max(...data.lengths)})
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
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
      )}
    </div>
  );
}
