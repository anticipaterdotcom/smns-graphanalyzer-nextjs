'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Layers, Download, Image } from 'lucide-react';
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
  onClose?: () => void;
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
  const chartRef = useRef<HTMLDivElement>(null);

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

  const getXAxisConfig = useMemo(() => {
    const len = Math.max(analyzedData.length, referenceData.length);
    if (len === 0) return { ticks: [1], max: 100 };
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
  }, [analyzedData.length, referenceData.length]);

  const sharedYDomain = useMemo((): [number, number] => {
    const allValues = [...analyzedData, ...referenceData].filter(v => v !== 0);
    if (allValues.length === 0) return [0, 10];
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    let yMax: number;
    if (maxVal < 5) yMax = 5;
    else yMax = Math.ceil(maxVal / 10) * 10;
    const yMin = Math.floor(minVal / 10) * 10;
    return [yMin, yMax];
  }, [analyzedData, referenceData]);

  const columnOptions = Array.from({ length: totalColumns }, (_, i) => i);

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
      a.download = `reference_analysis.svg`;
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
              a.download = `reference_analysis.jpg`;
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
    const headers = ['index', `col${analyzedColumn + 1}`, `col${referenceColumn + 1}`];
    const rows = analyzedData.map((val, i) => [i, val, referenceData[i] ?? '']);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference_analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [analyzedColumn, referenceColumn, analyzedData, referenceData]);

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
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div ref={chartRef} className="space-y-4">
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
                  type="number"
                  stroke="#64748b" 
                  fontSize={10}
                  domain={[1, getXAxisConfig.max]}
                  ticks={getXAxisConfig.ticks}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={sharedYDomain}
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
                  type="number"
                  stroke="#64748b" 
                  fontSize={10}
                  domain={[1, getXAxisConfig.max]}
                  ticks={getXAxisConfig.ticks}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={sharedYDomain}
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

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-neutral-500">
          Yellow/Blue highlighted areas show detected pattern regions across both columns
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-xs text-neutral-300 hover:bg-neutral-700"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={() => exportImage('png')}
            className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-xs text-neutral-300 hover:bg-neutral-700"
          >
            <Image className="w-3 h-3" />
            JPG
          </button>
          <button
            onClick={() => exportImage('svg')}
            className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-xs text-neutral-300 hover:bg-neutral-700"
          >
            <Image className="w-3 h-3" />
            SVG
          </button>
        </div>
      </div>
    </div>
  );
}
