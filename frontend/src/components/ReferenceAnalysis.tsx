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
  frequency: number;
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
  frequency: propFrequency,
}: ReferenceAnalysisProps) {
  const [topColumn, setTopColumn] = useState(analyzedColumn);
  const [bottomColumn, setBottomColumn] = useState(0);
  const [topData, setTopData] = useState<number[]>(analyzedData);
  const [bottomData, setBottomData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  const [selectedPattern, setSelectedPattern] = useState<'low-high-low' | 'high-low-high'>('low-high-low');
  const [refPatternEvents, setRefPatternEvents] = useState<RefPatternEvent[]>([]);
  const frequency = propFrequency;
  const [localHighlightIndex, setLocalHighlightIndex] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<{start: number, end: number} | null>(null);
  const [topExtrema, setTopExtrema] = useState<Extremum[]>(mainExtrema);
  const [allBottomExtrema, setAllBottomExtrema] = useState<Record<number, Extremum[]>>({});
  const [bottomEditMode, setBottomEditMode] = useState(false);
  const [bottomEditAction, setBottomEditAction] = useState<'add-max' | 'add-min' | 'remove' | null>(null);
  const [bottomEpsilon, setBottomEpsilon] = useState(20);
  const [bottomHighlightIndex, setBottomHighlightIndex] = useState<number | null>(null);
  const [bottomPatternEvents, setBottomPatternEvents] = useState<RefPatternEvent[]>([]);
  const [showTopAreas, setShowTopAreas] = useState(true);
  const [showBottomAreas, setShowBottomAreas] = useState(false);

  const findExtremaLocal = useCallback((data: number[], minDistance: number = 10): Extremum[] => {
    if (data.length < 3) return [];
    const maxima: Extremum[] = [];
    const minima: Extremum[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        maxima.push({ value: data[i], index: i, type: 1 });
      }
      if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        minima.push({ value: data[i], index: i, type: 0 });
      }
    }
    const filterByDistance = (peaks: Extremum[], isMax: boolean): Extremum[] => {
      if (peaks.length === 0) return [];
      const sorted = [...peaks].sort((a, b) =>
        isMax ? b.value - a.value : a.value - b.value
      );
      const kept: Extremum[] = [];
      for (const p of sorted) {
        if (kept.every(k => Math.abs(k.index - p.index) >= minDistance)) {
          kept.push(p);
        }
      }
      return kept;
    };
    return [...filterByDistance(maxima, true), ...filterByDistance(minima, false)]
      .sort((a, b) => a.index - b.index);
  }, []);

  const bottomExtrema = useMemo(() => allBottomExtrema[bottomColumn] ?? [], [allBottomExtrema, bottomColumn]);
  const setBottomExtrema = useCallback((updater: Extremum[] | ((prev: Extremum[]) => Extremum[])) => {
    setAllBottomExtrema(prev => {
      const current = prev[bottomColumn] ?? [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [bottomColumn]: next };
    });
  }, [bottomColumn]);

  useEffect(() => {
    const loadTopData = async () => {
      if (topColumn === analyzedColumn) {
        setTopData(analyzedData);
        setTopExtrema(mainExtrema);
        return;
      }
      try {
        const result = await getColumnData(sessionId, topColumn);
        setTopData(result.data);
        setTopExtrema(findExtremaLocal(result.data));
      } catch (err) {
        console.error('Failed to load top chart data:', err);
      }
    };
    loadTopData();
  }, [sessionId, topColumn, analyzedColumn, analyzedData, mainExtrema, findExtremaLocal]);

  useEffect(() => {
    const loadBottomData = async () => {
      setIsLoading(true);
      try {
        let data: number[];
        if (bottomColumn === analyzedColumn) {
          data = analyzedData;
        } else {
          const result = await getColumnData(sessionId, bottomColumn);
          data = result.data;
        }
        setBottomData(data);
        if (!allBottomExtrema[bottomColumn] || allBottomExtrema[bottomColumn].length === 0) {
          const extrema = bottomColumn === analyzedColumn ? mainExtrema : findExtremaLocal(data);
          setAllBottomExtrema(prev => ({ ...prev, [bottomColumn]: extrema }));
        }
      } catch (err) {
        console.error('Failed to load bottom chart data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBottomData();
  }, [sessionId, bottomColumn, analyzedColumn, analyzedData, mainExtrema, findExtremaLocal]);

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

  const refMaxima = useMemo(() => topExtrema.filter((e: Extremum) => e.type === 1), [topExtrema]);
  const refMinima = useMemo(() => topExtrema.filter((e: Extremum) => e.type === 0), [topExtrema]);
  const bottomMaxima = useMemo(() => bottomExtrema.filter(e => e.type === 1), [bottomExtrema]);
  const bottomMinima = useMemo(() => bottomExtrema.filter(e => e.type === 0), [bottomExtrema]);
  const bottomPatternRanges = useMemo(() =>
    bottomPatternEvents.map(e => ({ start: e.startIndex, end: e.endIndex })),
  [bottomPatternEvents]);

  const addTopExtremum = useCallback((clickIndex: number, type: 'max' | 'min') => {
    if (topData.length === 0) return;
    const start = Math.max(0, clickIndex - epsilon);
    const end = Math.min(topData.length, clickIndex + epsilon + 1);
    const window = topData.slice(start, end);
    const localIdx = type === 'max'
      ? window.indexOf(Math.max(...window))
      : window.indexOf(Math.min(...window));
    const actualIdx = start + localIdx;
    const newExt: Extremum = {
      value: topData[actualIdx],
      index: actualIdx,
      type: type === 'max' ? 1 : 0,
    };
    setTopExtrema(prev => {
      const filtered = prev.filter(e => e.index !== actualIdx);
      return [...filtered, newExt].sort((a, b) => a.index - b.index);
    });
  }, [topData, epsilon]);

  const removeTopExtremum = useCallback((targetIndex: number) => {
    setTopExtrema(prev => {
      const closest = prev.reduce<Extremum | null>((best, e) =>
        !best || Math.abs(e.index - targetIndex) < Math.abs(best.index - targetIndex) ? e : best, null);
      if (closest && Math.abs(closest.index - targetIndex) < 15) {
        return prev.filter(e => e.index !== closest.index);
      }
      return prev;
    });
  }, []);

  const handleTopChartClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!editMode || !editAction || !e) return;
      const index = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
      if (index === undefined || index === null) return;
      const idx = Number(index);
      if (editAction === 'remove') {
        removeTopExtremum(idx);
      } else {
        addTopExtremum(idx, editAction === 'add-max' ? 'max' : 'min');
      }
    },
    [editMode, editAction, addTopExtremum, removeTopExtremum]
  );

  const addBottomExtremum = useCallback((clickIndex: number, type: 'max' | 'min') => {
    if (bottomData.length === 0) return;
    const start = Math.max(0, clickIndex - bottomEpsilon);
    const end = Math.min(bottomData.length, clickIndex + bottomEpsilon + 1);
    const window = bottomData.slice(start, end);
    const localIdx = type === 'max'
      ? window.indexOf(Math.max(...window))
      : window.indexOf(Math.min(...window));
    const actualIdx = start + localIdx;
    const newExt: Extremum = {
      value: bottomData[actualIdx],
      index: actualIdx,
      type: type === 'max' ? 1 : 0,
    };
    setBottomExtrema(prev => {
      const filtered = prev.filter(e => e.index !== actualIdx);
      return [...filtered, newExt].sort((a, b) => a.index - b.index);
    });
  }, [bottomData, bottomEpsilon]);

  const removeBottomExtremum = useCallback((targetIndex: number) => {
    setBottomExtrema(prev => {
      const closest = prev.reduce<Extremum | null>((best, e) =>
        !best || Math.abs(e.index - targetIndex) < Math.abs(best.index - targetIndex) ? e : best, null);
      if (closest && Math.abs(closest.index - targetIndex) < 15) {
        return prev.filter(e => e.index !== closest.index);
      }
      return prev;
    });
  }, []);

  const handleBottomChartClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!bottomEditMode || !bottomEditAction || !e) return;
      const index = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
      if (index === undefined || index === null) return;
      const idx = Number(index);
      if (bottomEditAction === 'remove') {
        removeBottomExtremum(idx);
      } else {
        addBottomExtremum(idx, bottomEditAction === 'add-max' ? 'max' : 'min');
      }
    },
    [bottomEditMode, bottomEditAction, addBottomExtremum, removeBottomExtremum]
  );

  const detectPatterns = useCallback((extrema: Extremum[], pattern: 'low-high-low' | 'high-low-high'): RefPatternEvent[] => {
    if (extrema.length < 3) return [];
    const sorted = [...extrema].sort((a, b) => a.index - b.index);
    const result: RefPatternEvent[] = [];
    const avgCycleLen = events.length > 0
      ? events.reduce((sum, e) => sum + (e.end_index - e.start_index), 0) / events.length
      : 100;
    const tolerance = Math.round(avgCycleLen * 0.2);

    for (let i = 0; i < sorted.length - 2; i++) {
      const first = sorted[i];
      const second = sorted[i + 1];
      const third = sorted[i + 2];
      const isLHL = first.type === 0 && second.type === 1 && third.type === 0;
      const isHLH = first.type === 1 && second.type === 0 && third.type === 1;

      if ((pattern === 'low-high-low' && isLHL) || (pattern === 'high-low-high' && isHLH)) {
        const cycleTime = (third.index - first.index) / frequency;
        let mainCycleIndex = -1;
        let delayTime = 0;
        for (let j = 0; j < events.length; j++) {
          const mainEvent = events[j];
          if (first.index >= mainEvent.start_index - tolerance && first.index <= mainEvent.end_index + tolerance) {
            mainCycleIndex = j;
            delayTime = (first.index - mainEvent.start_index) / frequency;
            break;
          }
        }
        result.push({
          startIndex: first.index, inflectionIndex: second.index, endIndex: third.index,
          startValue: first.value, inflectionValue: second.value, endValue: third.value,
          cycleTime, mainCycleIndex, delayTime,
        });
        i += 2;
      }
    }
    return result;
  }, [frequency, events]);

  useEffect(() => {
    setRefPatternEvents(detectPatterns(topExtrema, selectedPattern));
  }, [topExtrema, selectedPattern, detectPatterns]);

  useEffect(() => {
    setBottomPatternEvents(detectPatterns(bottomExtrema, selectedPattern));
  }, [bottomExtrema, selectedPattern, detectPatterns]);

  const exportParametersCSV = useCallback(() => {
    const headers = [
      'Chart', '#', 'Start Index', 'Inflection Index', 'End Index',
      'Start Value', 'Inflection Value', 'End Value',
      'Cycle Time (s)', 'Main Cycle #', 'Delay Time (s)',
      'Amplitude', 'Rise Time (s)', 'Fall Time (s)'
    ];
    const buildRows = (evts: RefPatternEvent[], label: string) =>
      evts.map((evt, i) => {
        const amplitude = Math.abs(evt.inflectionValue - evt.startValue);
        const riseTime = (evt.inflectionIndex - evt.startIndex) / frequency;
        const fallTime = (evt.endIndex - evt.inflectionIndex) / frequency;
        return [
          label, i + 1, evt.startIndex, evt.inflectionIndex, evt.endIndex,
          evt.startValue.toFixed(2), evt.inflectionValue.toFixed(2), evt.endValue.toFixed(2),
          evt.cycleTime.toFixed(3), evt.mainCycleIndex >= 0 ? evt.mainCycleIndex + 1 : 'N/A', evt.delayTime.toFixed(3),
          amplitude.toFixed(2), riseTime.toFixed(3), fallTime.toFixed(3)
        ];
      });
    const rows = [...buildRows(refPatternEvents, `Top (Col ${topColumn + 1})`)];
    const colKeys = Object.keys(allBottomExtrema).map(Number).sort((a, b) => a - b);
    for (const col of colKeys) {
      const extrema = allBottomExtrema[col];
      if (!extrema || extrema.length === 0) continue;
      const colEvents = detectPatterns(extrema, selectedPattern);
      rows.push(...buildRows(colEvents, `Bottom (Col ${col + 1})`));
    }
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const patternName = selectedPattern === 'low-high-low' ? 'LHL' : 'HLH';
    a.download = `reference_parameters_${patternName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [refPatternEvents, allBottomExtrema, detectPatterns, frequency, selectedPattern, topColumn]);

  const buildChartSvg = useCallback((
    colData: number[], title: string, extrema: Extremum[],
    ranges: { start: number; end: number; color: string; opacity: number }[],
    chartW: number, chartH: number, margin: { top: number; right: number; bottom: number; left: number }
  ): string => {
    const plotW = chartW - margin.left - margin.right;
    const plotH = chartH - margin.top - margin.bottom;
    const vals = colData.filter(v => v !== 0);
    const yMin = vals.length > 0 ? Math.min(...vals) : 0;
    const yMax = vals.length > 0 ? Math.max(...vals) : 10;
    const yPad = (yMax - yMin) * 0.05 || 1;
    const scaleX = (i: number) => margin.left + (i / Math.max(colData.length - 1, 1)) * plotW;
    const scaleY = (v: number) => margin.top + plotH - ((v - (yMin - yPad)) / ((yMax + yPad) - (yMin - yPad))) * plotH;

    let svg = `<g>`;
    svg += `<rect x="0" y="0" width="${chartW}" height="${chartH}" fill="#0f172a"/>`;
    svg += `<text x="10" y="18" fill="#e5e5e5" font-size="13" font-family="sans-serif" font-weight="bold">${title}</text>`;

    const yTicks = 5;
    for (let t = 0; t <= yTicks; t++) {
      const val = (yMin - yPad) + ((yMax + yPad) - (yMin - yPad)) * (t / yTicks);
      const y = scaleY(val);
      svg += `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${margin.left + plotW}" y2="${y.toFixed(1)}" stroke="rgba(148,163,184,0.1)"/>`;
      svg += `<text x="${margin.left - 4}" y="${(y + 3).toFixed(1)}" fill="#94a3b8" font-size="9" font-family="sans-serif" text-anchor="end">${val.toFixed(1)}</text>`;
    }

    for (const range of ranges) {
      const x1 = scaleX(range.start);
      const x2 = scaleX(range.end);
      svg += `<rect x="${Math.min(x1, x2).toFixed(1)}" y="${margin.top}" width="${Math.abs(x2 - x1).toFixed(1)}" height="${plotH}" fill="${range.color}" opacity="${range.opacity}"/>`;
    }

    svg += `<rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" fill="none" stroke="rgba(148,163,184,0.15)"/>`;

    const points = colData.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="#ef4444" stroke-width="1.5"/>`;

    for (const ext of extrema) {
      if (ext.index >= 0 && ext.index < colData.length) {
        const cx = scaleX(ext.index);
        const cy = scaleY(ext.value);
        const color = ext.type === 1 ? '#3b82f6' : '#10b981';
        svg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>`;
      }
    }

    svg += `</g>`;
    return svg;
  }, []);

  const [isExportingImage, setIsExportingImage] = useState(false);

  const exportImage = useCallback(async (format: 'png' | 'svg') => {
    setIsExportingImage(true);
    try {
      const allColData: number[][] = [];
      for (let col = 0; col < totalColumns; col++) {
        if (col === analyzedColumn) {
          allColData.push(analyzedData);
        } else if (col === topColumn) {
          allColData.push(topData);
        } else if (col === bottomColumn) {
          allColData.push(bottomData);
        } else {
          const result = await getColumnData(sessionId, col);
          allColData.push(result.data);
        }
      }

      const chartW = 900;
      const chartH = 160;
      const margin = { top: 28, right: 20, bottom: 10, left: 55 };
      const gap = 8;
      const totalH = totalColumns * (chartH + gap);

      const yellowRanges = patternRanges.map(r => ({ start: r.start, end: r.end, color: '#fbbf24', opacity: 0.2 }));

      let combinedInner = '';
      let yOff = 0;
      for (let col = 0; col < totalColumns; col++) {
        const colExtrema = [
          ...(col === topColumn ? topExtrema : []),
          ...(allBottomExtrema[col] ?? []),
        ];
        const title = `Column ${col + 1}`;
        const chartSvg = buildChartSvg(allColData[col], title, colExtrema, yellowRanges, chartW, chartH, margin);
        combinedInner += `<g transform="translate(0,${yOff})">${chartSvg}</g>`;
        yOff += chartH + gap;
      }

      const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${chartW}" height="${totalH}">`
        + `<rect width="${chartW}" height="${totalH}" fill="#0f172a"/>`
        + combinedInner + `</svg>`;

      if (format === 'svg') {
        const blob = new Blob([fullSvg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reference_all_columns.svg`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = chartW * scale;
        canvas.height = totalH * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const img = new window.Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reference_all_columns.jpg`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }, 'image/jpeg', 0.95);
          };
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(fullSvg)));
        }
      }
    } catch (err) {
      console.error('Export image failed:', err);
    } finally {
      setIsExportingImage(false);
    }
  }, [totalColumns, analyzedColumn, analyzedData, topColumn, topData, topExtrema, bottomColumn, bottomData, sessionId, allBottomExtrema, patternRanges, buildChartSvg]);

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
              <LineChart data={topChartData} onClick={handleTopChartClick}>
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
                {showTopAreas && patternRanges.map((range, i) => (
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

        <div className="mt-3 p-4 bg-neutral-900/50 rounded-xl">
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
            <button
              onClick={() => setShowTopAreas(prev => !prev)}
              className={`px-3 py-1 text-xs rounded ${showTopAreas ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
            >
              Pattern {showTopAreas ? 'ON' : 'OFF'}
            </button>
          </div>

          {refPatternEvents.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-white">Reference Parameters ({refPatternEvents.length} cycles)</h4>
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

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-neutral-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-400">Maxima ({refMaxima.length})</span>
                {editMode && editAction === 'add-max' && (
                  <span className="text-xs text-orange-400">Click chart to add</span>
                )}
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1">
                {refMaxima.map((ext: Extremum, i: number) => (
                  <div
                    key={`max-${ext.index}-${i}`}
                    className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${localHighlightIndex === ext.index ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                    onMouseEnter={() => setLocalHighlightIndex(ext.index)}
                    onMouseLeave={() => setLocalHighlightIndex(null)}
                  >
                    <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                    <button
                      onClick={() => removeTopExtremum(ext.index)}
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
                {refMinima.map((ext: Extremum, i: number) => (
                  <div
                    key={`min-${ext.index}-${i}`}
                    className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${localHighlightIndex === ext.index ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                    onMouseEnter={() => setLocalHighlightIndex(ext.index)}
                    onMouseLeave={() => setLocalHighlightIndex(null)}
                  >
                    <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                    <button
                      onClick={() => removeTopExtremum(ext.index)}
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
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2 mt-4">
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
          <div className={`h-[200px] rounded-xl bg-neutral-900/50 p-4 ${bottomEditMode ? 'cursor-crosshair ring-2 ring-orange-500/50' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bottomChartData} onClick={handleBottomChartClick}>
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
                {showTopAreas && patternRanges.map((range, i) => (
                  <ReferenceArea
                    key={`main-${i}`}
                    x1={range.start}
                    x2={range.end}
                    fill="#3b82f6"
                    fillOpacity={0.15}
                    stroke="#3b82f6"
                    strokeOpacity={0.3}
                  />
                ))}
                {showBottomAreas && bottomPatternRanges.map((range, i) => (
                  <ReferenceArea
                    key={`bp-${i}`}
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
                {bottomExtrema.filter(e => e.type === 1).map((ext, i) => (
                  <ReferenceDot
                    key={`bmax-${ext.index}-${i}`}
                    x={ext.index}
                    y={ext.value}
                    r={bottomHighlightIndex === ext.index ? 6 : 4}
                    fill="#3b82f6"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
                {bottomExtrema.filter(e => e.type === 0).map((ext, i) => (
                  <ReferenceDot
                    key={`bmin-${ext.index}-${i}`}
                    x={ext.index}
                    y={ext.value}
                    r={bottomHighlightIndex === ext.index ? 6 : 4}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={1}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 p-3 bg-neutral-900/50 rounded-xl">
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">Edit:</span>
                <button
                  onClick={() => {
                    const next = !bottomEditMode;
                    setBottomEditMode(next);
                    if (next) setBottomEditAction('add-max');
                  }}
                  className={`flex items-center gap-1 px-3 py-1 text-xs rounded ${bottomEditMode ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <MousePointer className="w-3 h-3" />
                  {bottomEditMode ? 'ON' : 'OFF'}
                </button>
                {bottomEditMode && (
                  <>
                    <button
                      onClick={() => setBottomEditAction('add-max')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${bottomEditAction === 'add-max' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <Plus className="w-3 h-3" /> Max
                    </button>
                    <button
                      onClick={() => setBottomEditAction('add-min')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${bottomEditAction === 'add-min' ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                    >
                      <Plus className="w-3 h-3" /> Min
                    </button>
                    <button
                      onClick={() => setBottomEditAction('remove')}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${bottomEditAction === 'remove' ? 'bg-red-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
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
                  value={bottomEpsilon}
                  onChange={(e) => setBottomEpsilon(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
                  min={1}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400">{bottomMaxima.length} Max</span>
                <span className="text-xs text-emerald-400">{bottomMinima.length} Min</span>
              </div>
              <button
                onClick={() => setShowBottomAreas(prev => !prev)}
                className={`px-3 py-1 text-xs rounded ${showBottomAreas ? 'bg-yellow-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
              >
                Pattern {showBottomAreas ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <span className="text-xs font-medium text-blue-400 mb-2 block">Maxima ({bottomMaxima.length})</span>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {bottomMaxima.map((ext, i) => (
                    <div
                      key={`bmax-list-${ext.index}-${i}`}
                      className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${bottomHighlightIndex === ext.index ? 'bg-blue-600/30 ring-1 ring-blue-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                      onMouseEnter={() => setBottomHighlightIndex(ext.index)}
                      onMouseLeave={() => setBottomHighlightIndex(null)}
                    >
                      <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                      <button
                        onClick={() => removeBottomExtremum(ext.index)}
                        className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {bottomMaxima.length === 0 && <span className="text-xs text-neutral-500">No maxima</span>}
                </div>
              </div>
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <span className="text-xs font-medium text-emerald-400 mb-2 block">Minima ({bottomMinima.length})</span>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {bottomMinima.map((ext, i) => (
                    <div
                      key={`bmin-list-${ext.index}-${i}`}
                      className={`flex items-center justify-between text-xs px-2 py-1 rounded group cursor-pointer transition-colors ${bottomHighlightIndex === ext.index ? 'bg-emerald-600/30 ring-1 ring-emerald-500' : 'bg-neutral-900/50 hover:bg-neutral-800'}`}
                      onMouseEnter={() => setBottomHighlightIndex(ext.index)}
                      onMouseLeave={() => setBottomHighlightIndex(null)}
                    >
                      <span className="text-neutral-300">#{ext.index} = {ext.value.toFixed(2)}</span>
                      <button
                        onClick={() => removeBottomExtremum(ext.index)}
                        className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {bottomMinima.length === 0 && <span className="text-xs text-neutral-500">No minima</span>}
                </div>
              </div>
            </div>

          {bottomPatternEvents.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-white">Reference Parameters ({bottomPatternEvents.length} cycles)</h4>
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
                    {bottomPatternEvents.map((evt, i) => (
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
        </div>
      </div>

      <div className="flex items-center justify-end mt-4">
        <div className="flex gap-2">
          <button
            onClick={exportParametersCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-500 transition-colors"
          >
            <Download className="w-4 h-4" />
            Parameters
          </button>
          <button
            onClick={() => exportImage('png')}
            disabled={isExportingImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            {isExportingImage ? 'Exporting...' : 'JPG'}
          </button>
          <button
            onClick={() => exportImage('svg')}
            disabled={isExportingImage}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            <Image className="w-4 h-4" />
            SVG
          </button>
        </div>
      </div>
    </div>
  );
}
