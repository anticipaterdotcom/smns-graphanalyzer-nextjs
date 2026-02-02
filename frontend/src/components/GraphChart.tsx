'use client';

import { useMemo, useCallback, useRef } from 'react';
import { Download, Image } from 'lucide-react';
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
  const chartRef = useRef<HTMLDivElement>(null);

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
      if (!onChartClick || !e) return;
      
      const index = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
      if (index !== undefined && index !== null) {
        onChartClick(Number(index));
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
      a.download = `signal_graph.svg`;
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
              a.download = `signal_graph.jpg`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }, 'image/jpeg', 0.95);
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }
  }, []);

  const exportCSV = useCallback(() => {
    const headers = ['index', 'value'];
    const rows = data.map((val, i) => [i, val]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal_graph.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

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

      <div ref={chartRef} className="h-[400px] rounded-xl bg-neutral-900/50 p-4">
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
            {maxima.map((ext, i) => (
              <ReferenceDot
                key={`max-${ext.index}-${i}`}
                x={ext.index}
                y={ext.value}
                r={6}
                fill="#3b82f6"
                stroke="#0f172a"
                strokeWidth={2}
              />
            ))}
            {minima.map((ext, i) => (
              <ReferenceDot
                key={`min-${ext.index}-${i}`}
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

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-neutral-500">
          Click on the chart to add/remove extrema. Total points: {data.length}
        </p>
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
    </div>
  );
}
