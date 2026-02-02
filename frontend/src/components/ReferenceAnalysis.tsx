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
  const [topColumn, setTopColumn] = useState(analyzedColumn);
  const [bottomColumn, setBottomColumn] = useState(0);
  const [topData, setTopData] = useState<number[]>(analyzedData);
  const [bottomData, setBottomData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadTopData = async () => {
      if (topColumn === analyzedColumn) {
        setTopData(analyzedData);
        return;
      }
      try {
        const result = await getColumnData(sessionId, topColumn);
        setTopData(result.data);
      } catch (err) {
        console.error('Failed to load top chart data:', err);
      }
    };
    loadTopData();
  }, [sessionId, topColumn, analyzedColumn, analyzedData]);

  useEffect(() => {
    const loadBottomData = async () => {
      if (bottomColumn === analyzedColumn) {
        setBottomData(analyzedData);
        return;
      }
      setIsLoading(true);
      try {
        const result = await getColumnData(sessionId, bottomColumn);
        setBottomData(result.data);
      } catch (err) {
        console.error('Failed to load bottom chart data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBottomData();
  }, [sessionId, bottomColumn, analyzedColumn, analyzedData]);

  const patternRanges = useMemo(() => {
    return events.map((e) => ({ start: e.start_index, end: e.end_index }));
  }, [events]);

  const topChartData = useMemo(() => {
    return topData.map((value, index) => ({ index, value }));
  }, [topData]);

  const bottomChartData = useMemo(() => {
    return bottomData.map((value, index) => ({ index, value }));
  }, [bottomData]);

  const getXAxisConfig = useMemo(() => {
    const len = Math.max(topData.length, bottomData.length);
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
  }, [topData.length, bottomData.length]);

  const sharedYDomain = useMemo((): [number, number] => {
    const allValues = [...topData, ...bottomData].filter(v => v !== 0);
    if (allValues.length === 0) return [0, 10];
    const maxVal = Math.max(...allValues);
    const minVal = Math.min(...allValues);
    let yMax: number;
    if (maxVal < 5) yMax = 5;
    else yMax = Math.ceil(maxVal / 10) * 10;
    const yMin = Math.floor(minVal / 10) * 10;
    return [yMin, yMax];
  }, [topData, bottomData]);

  const columnOptions = Array.from({ length: totalColumns }, (_, i) => i);

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    if (!chartRef.current) return;
    const svgElements = chartRef.current.querySelectorAll('svg');
    if (svgElements.length === 0) return;

    const titles = [`Column ${topColumn + 1}`, `Column ${bottomColumn + 1}`];
    const titleHeight = 30;

    if (format === 'svg') {
      const combinedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      let totalHeight = 0;
      const width = svgElements[0]?.clientWidth || 800;
      
      svgElements.forEach((svg, index) => {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', '10');
        title.setAttribute('y', String(totalHeight + 20));
        title.setAttribute('fill', '#e5e5e5');
        title.setAttribute('font-size', '14');
        title.setAttribute('font-family', 'sans-serif');
        title.textContent = titles[index] || `Chart ${index + 1}`;
        combinedSvg.appendChild(title);
        totalHeight += titleHeight;

        const clone = svg.cloneNode(true) as SVGElement;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(0, ${totalHeight})`);
        g.appendChild(clone);
        combinedSvg.appendChild(g);
        totalHeight += svg.clientHeight + 20;
      });
      
      combinedSvg.setAttribute('width', String(width));
      combinedSvg.setAttribute('height', String(totalHeight));
      combinedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      const svgData = new XMLSerializer().serializeToString(combinedSvg);
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
      const width = (svgElements[0]?.clientWidth || 800) * 2;
      let totalHeight = 0;
      svgElements.forEach((svg) => { totalHeight += svg.clientHeight + titleHeight; });
      totalHeight = totalHeight * 2 + 40;
      
      canvas.width = width;
      canvas.height = totalHeight;
      
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        let yOffset = 0;
        let loaded = 0;
        
        svgElements.forEach((svg, index) => {
          ctx.fillStyle = '#e5e5e5';
          ctx.font = '28px sans-serif';
          ctx.fillText(titles[index] || `Chart ${index + 1}`, 20, yOffset + 40);
          yOffset += titleHeight * 2;

          const svgData = new XMLSerializer().serializeToString(svg);
          const img = new window.Image();
          const currentY = yOffset;
          
          img.onload = () => {
            ctx.drawImage(img, 0, currentY, width, svg.clientHeight * 2);
            loaded++;
            if (loaded === svgElements.length) {
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
          yOffset += svg.clientHeight * 2 + 20;
        });
      }
    }
  }, [topColumn, bottomColumn]);

  const exportCSV = useCallback(() => {
    const headers = ['index', `col${topColumn + 1}`, `col${bottomColumn + 1}`];
    const rows = topData.map((val, i) => [i, val, bottomData[i] ?? '']);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference_analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [topColumn, bottomColumn, topData, bottomData]);

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
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div ref={chartRef} className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-neutral-300">Top Chart:</p>
            <select
              value={topColumn}
              onChange={(e) => setTopColumn(Number(e.target.value))}
              className="px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
            >
              {columnOptions.map((col) => (
                <option key={col} value={col}>Column {col + 1}</option>
              ))}
            </select>
          </div>
          <div className="h-[200px] rounded-xl bg-neutral-900/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={topChartData}>
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
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium text-neutral-300">Bottom Chart:</p>
            <select
              value={bottomColumn}
              onChange={(e) => setBottomColumn(Number(e.target.value))}
              className="px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
            >
              {columnOptions.map((col) => (
                <option key={col} value={col}>Column {col + 1}</option>
              ))}
            </select>
            {isLoading && <span className="text-neutral-500 text-xs">Loading...</span>}
          </div>
          <div className="h-[200px] rounded-xl bg-neutral-900/50 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bottomChartData}>
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
