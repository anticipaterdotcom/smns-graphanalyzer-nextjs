'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Layers, Download, Image, Plus, Minus, MousePointer } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';
import { getColumnData, PatternEvent, Extremum } from '@/lib/api';

interface RefExtremum {
  index: number;
  value: number;
  type: 'max' | 'min';
}

interface RefPatternEvent {
  startIndex: number;
  inflectionIndex: number;
  endIndex: number;
  startValue: number;
  inflectionValue: number;
  endValue: number;
  cycleTime: number;
  mainCycleIndex: number;
  delayTime: number;
}

interface ReferenceAnalysisProps {
  sessionId: string;
  analyzedColumn: number;
  analyzedData: number[];
  events: PatternEvent[];
  totalColumns: number;
  onClose?: () => void;
  mainExtrema: Extremum[];
  editMode: boolean;
  editAction: 'add-max' | 'add-min' | 'remove' | null;
  onChartClick: (index: number) => void;
  highlightedExtremumIndex?: number | null;
  onToggleEditMode: () => void;
  onEditActionChange: (action: 'add-max' | 'add-min' | 'remove' | null) => void;
  onAddExtremum: (index: number, type: string, epsilon?: number) => void;
  onRemoveExtremum: (index: number) => void;
  epsilon: number;
  onEpsilonChange: (value: number) => void;
  onPatternChange: (pattern: number[]) => void;
  currentPattern: number[];
}

export default function ReferenceAnalysis({
  sessionId,
  analyzedColumn,
  analyzedData,
  events,
  totalColumns,
  onClose,
  mainExtrema,
  editMode,
  editAction,
  onChartClick,
  highlightedExtremumIndex,
  onToggleEditMode,
  onEditActionChange,
  onAddExtremum,
  onRemoveExtremum,
  epsilon,
  onEpsilonChange,
  onPatternChange,
  currentPattern,
}: ReferenceAnalysisProps) {
  const [topColumn, setTopColumn] = useState(analyzedColumn);
  const [bottomColumn, setBottomColumn] = useState(0);
  const [topData, setTopData] = useState<number[]>(analyzedData);
  const [bottomData, setBottomData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  const [selectedPattern, setSelectedPattern] = useState<'low-high-low' | 'high-low-high'>('low-high-low');
  const [refPatternEvents, setRefPatternEvents] = useState<RefPatternEvent[]>([]);
  const [frequency, setFrequency] = useState(250);
  const [localHighlightIndex, setLocalHighlightIndex] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<{start: number, end: number} | null>(null);

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

  const refMaxima = useMemo(() => mainExtrema.filter((e: Extremum) => e.type === 1), [mainExtrema]);
  const refMinima = useMemo(() => mainExtrema.filter((e: Extremum) => e.type === 0), [mainExtrema]);

  const handleBottomChartClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!editMode || !editAction || !e) return;
      const index = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
      if (index === undefined || index === null) return;
      onChartClick(Number(index));
    },
    [editMode, editAction, onChartClick]
  );

  const detectRefPatterns = useCallback(() => {
    if (mainExtrema.length < 3) {
      setRefPatternEvents([]);
      return;
    }

    const sorted = [...mainExtrema].sort((a, b) => a.index - b.index);
    const newEvents: RefPatternEvent[] = [];

    for (let i = 0; i < sorted.length - 2; i++) {
      const first = sorted[i];
      const second = sorted[i + 1];
      const third = sorted[i + 2];

      const isLHL = first.type === 0 && second.type === 1 && third.type === 0;
      const isHLH = first.type === 1 && second.type === 0 && third.type === 1;

      if ((selectedPattern === 'low-high-low' && isLHL) || (selectedPattern === 'high-low-high' && isHLH)) {
        const cycleTime = (third.index - first.index) / frequency;
        
        let mainCycleIndex = -1;
        let delayTime = 0;
        for (let j = 0; j < events.length; j++) {
          const mainEvent = events[j];
          if (first.index >= mainEvent.start_index - 50 && first.index <= mainEvent.end_index + 50) {
            mainCycleIndex = j;
            delayTime = (first.index - mainEvent.start_index) / frequency;
            break;
          }
        }

        newEvents.push({
          startIndex: first.index,
          inflectionIndex: second.index,
          endIndex: third.index,
          startValue: first.value,
          inflectionValue: second.value,
          endValue: third.value,
          cycleTime,
          mainCycleIndex,
          delayTime,
        });
      }
    }

    setRefPatternEvents(newEvents);
  }, [mainExtrema, selectedPattern, frequency, events]);

  useEffect(() => {
    detectRefPatterns();
  }, [detectRefPatterns]);

  const exportParametersCSV = useCallback(() => {
    const headers = [
      '#', 'Start Index', 'Inflection Index', 'End Index',
      'Start Value', 'Inflection Value', 'End Value',
      'Cycle Time (s)', 'Main Cycle #', 'Delay Time (s)',
      'Amplitude', 'Rise Time (s)', 'Fall Time (s)'
    ];
    const rows = refPatternEvents.map((evt, i) => {
      const amplitude = Math.abs(evt.inflectionValue - evt.startValue);
      const riseTime = (evt.inflectionIndex - evt.startIndex) / frequency;
      const fallTime = (evt.endIndex - evt.inflectionIndex) / frequency;
      return [
        i + 1, evt.startIndex, evt.inflectionIndex, evt.endIndex,
        evt.startValue.toFixed(2), evt.inflectionValue.toFixed(2), evt.endValue.toFixed(2),
        evt.cycleTime.toFixed(3), evt.mainCycleIndex >= 0 ? evt.mainCycleIndex + 1 : 'N/A', evt.delayTime.toFixed(3),
        amplitude.toFixed(2), riseTime.toFixed(3), fallTime.toFixed(3)
      ];
    });
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference_parameters.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [refPatternEvents, frequency]);

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
            <h2 className="text-lg font-semibold text-white">Reference Trend</h2>
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
          <div className={`h-[200px] rounded-xl bg-neutral-900/50 p-4 ${editMode ? 'cursor-crosshair ring-2 ring-orange-500/50' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={topChartData} onClick={handleBottomChartClick}>
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
                {highlightRange && (
                  <ReferenceArea
                    x1={highlightRange.start}
                    x2={highlightRange.end}
                    fill="#f97316"
                    fillOpacity={0.4}
                    stroke="#f97316"
                    strokeOpacity={0.8}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                {refMaxima.map((ext: Extremum, i: number) => {
                  const isHighlighted = highlightedExtremumIndex === ext.index || localHighlightIndex === ext.index;
                  return (
                    <ReferenceDot
                      key={`max-${i}`}
                      x={ext.index}
                      y={ext.value}
                      r={isHighlighted ? 10 : 6}
                      fill="#3b82f6"
                      stroke={isHighlighted ? '#fff' : '#0f172a'}
                      strokeWidth={isHighlighted ? 3 : 2}
                    />
                  );
                })}
                {refMinima.map((ext: Extremum, i: number) => {
                  const isHighlighted = highlightedExtremumIndex === ext.index || localHighlightIndex === ext.index;
                  return (
                    <ReferenceDot
                      key={`min-${i}`}
                      x={ext.index}
                      y={ext.value}
                      r={isHighlighted ? 10 : 6}
                      fill="#10b981"
                      stroke={isHighlighted ? '#fff' : '#0f172a'}
                      strokeWidth={isHighlighted ? 3 : 2}
                    />
                  );
                })}
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
                {highlightRange && (
                  <ReferenceArea
                    x1={highlightRange.start}
                    x2={highlightRange.end}
                    fill="#f97316"
                    fillOpacity={0.4}
                    stroke="#f97316"
                    strokeOpacity={0.8}
                  />
                )}
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

      <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="bg-neutral-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-400">Maxima ({refMaxima.length})</span>
                {editMode && editAction === 'add-max' && (
                  <span className="text-xs text-orange-400">Click chart to add</span>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {refMaxima.map((ext: Extremum) => (
                  <div 
                    key={ext.index} 
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
                {refMaxima.length === 0 && <span className="text-xs text-neutral-500">No maxima</span>}
              </div>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-emerald-400">Minima ({refMinima.length})</span>
                {editMode && editAction === 'add-min' && (
                  <span className="text-xs text-orange-400">Click chart to add</span>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {refMinima.map((ext: Extremum) => (
                  <div 
                    key={ext.index} 
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
                {refMinima.length === 0 && <span className="text-xs text-neutral-500">No minima</span>}
              </div>
            </div>
          </div>

      <div className="mt-4 p-4 bg-neutral-900/50 rounded-xl">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Pattern:</span>
            <button
              onClick={() => {
                setSelectedPattern('low-high-low');
                onPatternChange([0, 1, 0]);
              }}
              className={`px-3 py-1 text-xs rounded ${currentPattern[1] === 1 ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              Low → High → Low
            </button>
            <button
              onClick={() => {
                setSelectedPattern('high-low-high');
                onPatternChange([1, 0, 1]);
              }}
              className={`px-3 py-1 text-xs rounded ${currentPattern[1] === 0 ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              High → Low → High
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Edit:</span>
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${editMode ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              <MousePointer className="w-3 h-3" />
              {editMode ? 'ON' : 'OFF'}
            </button>
            {editMode && (
              <>
                <button
                  onClick={() => onEditActionChange('add-max')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'add-max' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <Plus className="w-3 h-3" /> Max
                </button>
                <button
                  onClick={() => onEditActionChange('add-min')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'add-min' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <Plus className="w-3 h-3" /> Min
                </button>
                <button
                  onClick={() => onEditActionChange('remove')}
                  className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${editAction === 'remove' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <Minus className="w-3 h-3" /> Remove
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Epsilon:</span>
            <input
              type="number"
              value={epsilon}
              onChange={(e) => onEpsilonChange(Number(e.target.value))}
              className="w-16 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
              min={1}
              max={100}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Extrema:</span>
            <span className="text-xs text-blue-400">{refMaxima.length} Max</span>
            <span className="text-xs text-emerald-400">{refMinima.length} Min</span>
          </div>
        </div>

        {refPatternEvents.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white">Reference Parameters ({refPatternEvents.length} cycles)</h4>
              <button
                onClick={exportParametersCSV}
                className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-500"
              >
                <Download className="w-3 h-3" /> Export Parameters
              </button>
            </div>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-neutral-900">
                  <tr className="text-neutral-400 border-b border-white/10">
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Start</th>
                    <th className="px-2 py-1 text-left">Inflection</th>
                    <th className="px-2 py-1 text-left">End</th>
                    <th className="px-2 py-1 text-left">Cycle Time</th>
                    <th className="px-2 py-1 text-left">Main Cycle</th>
                    <th className="px-2 py-1 text-left">Delay Time</th>
                    <th className="px-2 py-1 text-left">Amplitude</th>
                  </tr>
                </thead>
                <tbody>
                  {refPatternEvents.map((evt, i) => (
                    <tr 
                      key={i} 
                      className={`text-neutral-300 border-b border-white/5 cursor-pointer transition-colors ${highlightRange?.start === evt.startIndex ? 'bg-orange-600/20' : 'hover:bg-white/5'}`}
                      onMouseEnter={() => setHighlightRange({ start: evt.startIndex, end: evt.endIndex })}
                      onMouseLeave={() => setHighlightRange(null)}
                    >
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{evt.startValue.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.inflectionValue.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.endValue.toFixed(2)}</td>
                      <td className="px-2 py-1">{evt.cycleTime.toFixed(3)}s</td>
                      <td className="px-2 py-1">{evt.mainCycleIndex >= 0 ? `#${evt.mainCycleIndex + 1}` : 'N/A'}</td>
                      <td className="px-2 py-1 text-orange-400">{evt.delayTime.toFixed(3)}s</td>
                      <td className="px-2 py-1">{Math.abs(evt.inflectionValue - evt.startValue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-neutral-500">
          Click on bottom chart to add/remove extrema. Yellow/Blue areas show main trend cycles.
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
