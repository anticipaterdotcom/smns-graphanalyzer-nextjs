'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { X, Layers, Download, Image, Plus, Minus, MousePointer, Maximize2, Trash2, Play, Eye, EyeOff } from 'lucide-react';
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
import { getColumnData, getPatternEventsFromExtrema, PatternEvent, Extremum } from '@/lib/api';

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
  startTime: number;
  inflectionValue: number;
  inflectionTime: number;
  endValue: number;
  endTime: number;
  shiftStartToInflexion: number;
  shiftInflexionToEnd: number;
  timeStartToInflexion: number;
  timeInflexionToEnd: number;
  cycleTime: number;
  intercycleTime: number | null;
  patternType: string;
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
  topChartHeight?: number;
  bottomChartHeight?: number;
  onTopChartHeightChange?: (height: number) => void;
  onBottomChartHeightChange?: (height: number) => void;
  minDistance?: number;
  onMinDistanceChange?: (v: number) => void;
  onClearExtrema?: () => void;
  onRunDetection?: () => void;
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
  topChartHeight: propTopChartHeight,
  bottomChartHeight: propBottomChartHeight,
  onTopChartHeightChange,
  onBottomChartHeightChange,
  minDistance,
  onMinDistanceChange,
  onClearExtrema,
  onRunDetection,
}: ReferenceAnalysisProps) {
  const [topColumn, setTopColumn] = useState(analyzedColumn);
  const [bottomColumn, setBottomColumn] = useState(analyzedColumn === 0 ? 1 : 0);

  useEffect(() => {
    if (bottomColumn === topColumn) {
      for (let c = 0; c < totalColumns; c++) {
        if (c !== topColumn) { setBottomColumn(c); break; }
      }
    }
  }, [topColumn, bottomColumn, totalColumns]);
  const [topData, setTopData] = useState<number[]>(analyzedData);
  const [bottomData, setBottomData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const topChartRef = useRef<HTMLDivElement>(null);
  const bottomChartRef = useRef<HTMLDivElement>(null);
  
  const [selectedPattern, setSelectedPattern] = useState<'low-high-low' | 'high-low-high'>(
    currentPattern && currentPattern[1] === 0 ? 'high-low-high' : 'low-high-low'
  );
  useEffect(() => {
    setSelectedPattern(currentPattern && currentPattern[1] === 0 ? 'high-low-high' : 'low-high-low');
  }, [currentPattern]);
  const [refPatternEvents, setRefPatternEvents] = useState<RefPatternEvent[]>([]);
  const frequency = propFrequency;
  const [localHighlightIndex, setLocalHighlightIndex] = useState<number | null>(null);
  const [highlightRange, setHighlightRange] = useState<{start: number, end: number} | null>(null);
  const [topExtrema, setTopExtrema] = useState<Extremum[]>(mainExtrema);
  const [allBottomExtrema, setAllBottomExtrema] = useState<Record<number, Extremum[]>>(() => {
    if (typeof window === 'undefined' || !sessionId) return {};
    try {
      const raw = localStorage.getItem(`ref-bottom-extrema:${sessionId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!sessionId) return;
    try {
      localStorage.setItem(`ref-bottom-extrema:${sessionId}`, JSON.stringify(allBottomExtrema));
    } catch {
      // ignore quota errors
    }
  }, [allBottomExtrema, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    try {
      const raw = localStorage.getItem(`ref-bottom-extrema:${sessionId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setAllBottomExtrema(parsed);
      }
    } catch {
      // ignore
    }
  }, [sessionId]);
  const [bottomEditMode, setBottomEditMode] = useState(false);
  const [bottomEditAction, setBottomEditAction] = useState<'add-max' | 'add-min' | 'remove' | null>(null);
  const [bottomEpsilon, setBottomEpsilon] = useState(0);
  const [bottomHighlightIndex, setBottomHighlightIndex] = useState<number | null>(null);
  const [bottomRemoveCandidate, setBottomRemoveCandidate] = useState<number | null>(null);
  const [bottomMinDistance, setBottomMinDistance] = useState(95);
  const [bottomAutoDetected, setBottomAutoDetected] = useState(false);
  const [bottomPatternEvents, setBottomPatternEvents] = useState<RefPatternEvent[]>([]);
  const [showTopAreas, setShowTopAreas] = useState(true);
  const [showBottomAreas, setShowBottomAreas] = useState(false);
  const [topYZoom, setTopYZoom] = useState(1);
  const [bottomYZoom, setBottomYZoom] = useState(1);
  const [topYCenter, setTopYCenter] = useState<number | null>(null);
  const [bottomYCenter, setBottomYCenter] = useState<number | null>(null);
  const [topXZoom, setTopXZoom] = useState(1);
  const [bottomXZoom, setBottomXZoom] = useState(1);
  const [topXCenter, setTopXCenter] = useState<number | null>(null);
  const [bottomXCenter, setBottomXCenter] = useState<number | null>(null);
  const [topIsDragging, setTopIsDragging] = useState(false);
  const [bottomIsDragging, setBottomIsDragging] = useState(false);
  const [topDragStart, setTopDragStart] = useState<{x: number, y: number, xCenter: number, yCenter: number} | null>(null);
  const [bottomDragStart, setBottomDragStart] = useState<{x: number, y: number, xCenter: number, yCenter: number} | null>(null);
  const [topChartHeight, setTopChartHeight] = useState(propTopChartHeight || 200);
  const [bottomChartHeight, setBottomChartHeight] = useState(propBottomChartHeight || 200);
  
  useEffect(() => {
    if (propTopChartHeight !== undefined) {
      setTopChartHeight(propTopChartHeight);
    }
  }, [propTopChartHeight]);
  
  useEffect(() => {
    if (propBottomChartHeight !== undefined) {
      setBottomChartHeight(propBottomChartHeight);
    }
  }, [propBottomChartHeight]);
  
  useEffect(() => {
    if (onTopChartHeightChange && topChartHeight !== propTopChartHeight) {
      onTopChartHeightChange(topChartHeight);
    }
  }, [topChartHeight, onTopChartHeightChange, propTopChartHeight]);
  
  useEffect(() => {
    if (onBottomChartHeightChange && bottomChartHeight !== propBottomChartHeight) {
      onBottomChartHeightChange(bottomChartHeight);
    }
  }, [bottomChartHeight, onBottomChartHeightChange, propBottomChartHeight]);
  const topYDomainRef = useRef<[number, number]>([0, 10]);
  const bottomYDomainRef = useRef<[number, number]>([0, 10]);
  const topXDomainRef = useRef<{min: number, max: number}>({min: 1, max: 100});
  const bottomXDomainRef = useRef<{min: number, max: number}>({min: 1, max: 100});

  useEffect(() => {
    const topElement = topChartRef.current;
    if (!topElement) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        const rect = topElement.getBoundingClientRect();
        
        // Calculate mouse position relative to chart (0 to 1)
        const mouseXRatio = (e.clientX - rect.left) / rect.width;
        const mouseYRatio = (e.clientY - rect.top) / rect.height;
        
        // Get current domain values
        const currentYDomain = topYDomainRef.current;
        const currentXDomain = topXDomainRef.current;
        
        // Calculate the data value at mouse position BEFORE zoom
        const mouseYValue = currentYDomain[0] + (currentYDomain[1] - currentYDomain[0]) * (1 - mouseYRatio);
        const mouseXValue = currentXDomain.min + (currentXDomain.max - currentXDomain.min) * mouseXRatio;
        
        // Calculate current center
        const currentYCenter = (currentYDomain[0] + currentYDomain[1]) / 2;
        const currentXCenter = (currentXDomain.min + currentXDomain.max) / 2;
        
        // Calculate new center to keep mouse point fixed
        const newYCenter = mouseYValue + (currentYCenter - mouseYValue) / zoomFactor;
        const newXCenter = mouseXValue + (currentXCenter - mouseXValue) / zoomFactor;
        
        // Set new centers
        setTopYCenter(newYCenter);
        setTopXCenter(newXCenter);
        
        setTopYZoom(prev => {
          const newZoom = prev * zoomFactor;
          return Math.max(0.1, Math.min(10, newZoom));
        });
        setTopXZoom(prev => {
          const newZoom = prev * zoomFactor;
          return Math.max(0.1, Math.min(10, newZoom));
        });
      }
    };

    topElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      topElement.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
    };
  }, []);

  useEffect(() => {
    const bottomElement = bottomChartRef.current;
    if (!bottomElement) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY;
        const zoomFactor = delta > 0 ? 0.9 : 1.1;
        const rect = bottomElement.getBoundingClientRect();
        
        // Calculate mouse position relative to chart (0 to 1)
        const mouseXRatio = (e.clientX - rect.left) / rect.width;
        const mouseYRatio = (e.clientY - rect.top) / rect.height;
        
        // Get current domain values
        const currentYDomain = bottomYDomainRef.current;
        const currentXDomain = bottomXDomainRef.current;
        
        // Calculate the data value at mouse position BEFORE zoom
        const mouseYValue = currentYDomain[0] + (currentYDomain[1] - currentYDomain[0]) * (1 - mouseYRatio);
        const mouseXValue = currentXDomain.min + (currentXDomain.max - currentXDomain.min) * mouseXRatio;
        
        // Calculate current center
        const currentYCenter = (currentYDomain[0] + currentYDomain[1]) / 2;
        const currentXCenter = (currentXDomain.min + currentXDomain.max) / 2;
        
        // Calculate new center to keep mouse point fixed
        const newYCenter = mouseYValue + (currentYCenter - mouseYValue) / zoomFactor;
        const newXCenter = mouseXValue + (currentXCenter - mouseXValue) / zoomFactor;
        
        // Set new centers
        setBottomYCenter(newYCenter);
        setBottomXCenter(newXCenter);
        
        setBottomYZoom(prev => {
          const newZoom = prev * zoomFactor;
          return Math.max(0.1, Math.min(10, newZoom));
        });
        setBottomXZoom(prev => {
          const newZoom = prev * zoomFactor;
          return Math.max(0.1, Math.min(10, newZoom));
        });
      }
    };

    bottomElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      bottomElement.removeEventListener('wheel', handleWheel, { capture: true } as EventListenerOptions);
    };
  }, []);

  const findExtremaLocal = useCallback((data: number[], minDistance: number = 10): Extremum[] => {
    // Port of scipy.signal.find_peaks: find all local peaks, then enforce min distance
    if (data.length < 3) return [];

    // Find all local maxima candidates
    const maxCandidates: number[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
        maxCandidates.push(i);
      }
    }

    // Find all local minima candidates
    const minCandidates: number[] = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
        minCandidates.push(i);
      }
    }

    // Enforce min distance using scipy's priority-based approach:
    // Sort peaks by prominence (value), then greedily keep peaks that
    // respect the distance constraint
    const filterByDistance = (indices: number[], isMax: boolean): number[] => {
      if (indices.length === 0) return [];
      // Sort by peak value (highest first for max, lowest first for min)
      const sorted = [...indices].sort((a, b) =>
        isMax ? data[b] - data[a] : data[a] - data[b]
      );
      const keep = new Set<number>();
      const occupied = new Set<number>();
      for (const idx of sorted) {
        let tooClose = false;
        for (let d = -minDistance + 1; d < minDistance; d++) {
          if (occupied.has(idx + d)) { tooClose = true; break; }
        }
        if (!tooClose) {
          keep.add(idx);
          occupied.add(idx);
        }
      }
      return indices.filter(i => keep.has(i));
    };

    const maxIndices = filterByDistance(maxCandidates, true);
    const minIndices = filterByDistance(minCandidates, false);

    const result: Extremum[] = [
      ...maxIndices.map(i => ({ value: data[i], index: i, type: 1 as number })),
      ...minIndices.map(i => ({ value: data[i], index: i, type: 0 as number })),
    ];
    return result.sort((a, b) => a.index - b.index);
  }, []);

  const bottomExtrema = useMemo(() => allBottomExtrema[bottomColumn] ?? [], [allBottomExtrema, bottomColumn]);
  const setBottomExtrema = useCallback((updater: Extremum[] | ((prev: Extremum[]) => Extremum[])) => {
    setAllBottomExtrema(prev => {
      const current = prev[bottomColumn] ?? [];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [bottomColumn]: next };
    });
  }, [bottomColumn]);

  const searchBottomExtrema = useCallback(() => {
    if (bottomData.length === 0) return;
    const detected = findExtremaLocal(bottomData, bottomMinDistance);
    setBottomExtrema(detected);
    setBottomAutoDetected(true);
  }, [bottomData, bottomMinDistance, findExtremaLocal, setBottomExtrema]);

  // Load top chart data when column selection changes
  // Only reset extrema when the column actually changes, not on every parent re-render
  const prevTopColumnRef = useRef<number | null>(null);
  useEffect(() => {
    const columnChanged = prevTopColumnRef.current !== topColumn;
    prevTopColumnRef.current = topColumn;

    const loadTopData = async () => {
      if (topColumn === analyzedColumn) {
        setTopData(analyzedData);
        // Only sync extrema from parent when column changes, not on every parent update
        if (columnChanged) setTopExtrema(mainExtrema);
        return;
      }
      try {
        const result = await getColumnData(sessionId, topColumn);
        setTopData(result.data);
        if (columnChanged) setTopExtrema(findExtremaLocal(result.data));
      } catch (err) {
        console.error('Failed to load top chart data:', err);
      }
    };
    loadTopData();
  }, [sessionId, topColumn, analyzedColumn, analyzedData, mainExtrema, findExtremaLocal]);

  const prevBottomColumnRef = useRef<number | null>(null);
  useEffect(() => {
    const columnChanged = prevBottomColumnRef.current !== bottomColumn;
    prevBottomColumnRef.current = bottomColumn;

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
        // Clear extrema when column changes -- user must click Search to detect
        if (columnChanged) {
          setAllBottomExtrema(prev => ({ ...prev, [bottomColumn]: [] }));
          setBottomAutoDetected(false);
        }
      } catch (err) {
        console.error('Failed to load bottom chart data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadBottomData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, bottomColumn, analyzedColumn, analyzedData]);

  // Auto-detect extrema when minDistance changes (only if we have data)
  const prevMinDistRef = useRef<number>(bottomMinDistance);
  useEffect(() => {
    if (bottomData.length === 0) return;
    // Run on minDistance change or first load (when no extrema yet)
    const minDistChanged = prevMinDistRef.current !== bottomMinDistance;
    prevMinDistRef.current = bottomMinDistance;
    if (minDistChanged || bottomExtrema.length === 0) {
      searchBottomExtrema();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomData, bottomMinDistance]);

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
    const roundedMax = Math.ceil(len / 100) * 100;
    const dataCenter = len / 2;
    const topCenter = topXCenter ?? dataCenter;
    const bottomCenter = bottomXCenter ?? dataCenter;
    const topDefault = topXCenter === null && topXZoom === 1;
    const bottomDefault = bottomXCenter === null && bottomXZoom === 1;

    const topRange = len / topXZoom;
    let topMin = Math.max(1, topCenter - topRange / 2);
    let topMax = Math.min(len, topCenter + topRange / 2);
    if (topDefault) { topMin = 0; topMax = roundedMax; }

    const bottomRange = len / bottomXZoom;
    let bottomMin = Math.max(1, bottomCenter - bottomRange / 2);
    let bottomMax = Math.min(len, bottomCenter + bottomRange / 2);
    if (bottomDefault) { bottomMin = 0; bottomMax = roundedMax; }
    
    const visibleRange = Math.max(topMax - topMin, bottomMax - bottomMin);
    let step: number;
    if (visibleRange <= 50) step = 5;
    else if (visibleRange <= 100) step = 10;
    else if (visibleRange <= 200) step = 20;
    else if (visibleRange <= 500) step = 50;
    else if (visibleRange <= 1000) step = 100;
    else if (visibleRange <= 2000) step = 200;
    else step = 500;
    
    const ticks: number[] = [];
    const startTick = Math.ceil(Math.min(topMin, bottomMin) / step) * step;
    const endTick = Math.max(topMax, bottomMax);
    for (let i = startTick; i <= endTick; i += step) {
      ticks.push(i);
    }
    
    topXDomainRef.current = { min: topMin, max: topMax };
    bottomXDomainRef.current = { min: bottomMin, max: bottomMax };
    
    return { 
      ticks, 
      max: len,
      topMin, 
      topMax,
      bottomMin,
      bottomMax
    };
  }, [topData.length, bottomData.length, topXZoom, topXCenter, bottomXZoom, bottomXCenter]);

  const niceStep = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return 100;
    if (abs >= 100) return 10;
    if (abs >= 10) return 5;
    return 1;
  };

  const topYDomain = useMemo((): [number, number] => {
    const values = topData.filter(v => v !== 0);
    if (values.length === 0) return [0, 10];
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const isDefault = topYCenter === null && topYZoom === 1;
    const dataCenter = (maxVal + minVal) / 2;
    const center = topYCenter ?? dataCenter;
    const range = (maxVal - minVal) / topYZoom;
    let yMin = center - range / 2;
    let yMax = center + range / 2;
    if (isDefault) {
      yMax = Math.ceil(maxVal / niceStep(maxVal)) * niceStep(maxVal);
      yMin = Math.floor(minVal / niceStep(minVal)) * niceStep(minVal);
    }
    const domain: [number, number] = [yMin, yMax];
    topYDomainRef.current = domain;
    return domain;
  }, [topData, topYZoom, topYCenter]);

  const bottomYDomain = useMemo((): [number, number] => {
    const values = bottomData.filter(v => v !== 0);
    if (values.length === 0) return [0, 10];
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const isDefault = bottomYCenter === null && bottomYZoom === 1;
    const dataCenter = (maxVal + minVal) / 2;
    const center = bottomYCenter ?? dataCenter;
    const range = (maxVal - minVal) / bottomYZoom;
    let yMin = center - range / 2;
    let yMax = center + range / 2;
    if (isDefault) {
      yMax = Math.ceil(maxVal / niceStep(maxVal)) * niceStep(maxVal);
      yMin = Math.floor(minVal / niceStep(minVal)) * niceStep(minVal);
    }
    const domain: [number, number] = [yMin, yMax];
    bottomYDomainRef.current = domain;
    return domain;
  }, [bottomData, bottomYZoom, bottomYCenter]);

  const resetTopView = useCallback(() => {
    setTopYZoom(1); setTopYCenter(null); setTopXZoom(1); setTopXCenter(null);
  }, []);
  const resetBottomView = useCallback(() => {
    setBottomYZoom(1); setBottomYCenter(null); setBottomXZoom(1); setBottomXCenter(null);
  }, []);

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
    let actualIdx: number;
    if (epsilon === 0) {
      actualIdx = Math.max(0, Math.min(clickIndex, topData.length - 1));
    } else {
      const start = Math.max(0, clickIndex - epsilon);
      const end = Math.min(topData.length, clickIndex + epsilon + 1);
      const win = topData.slice(start, end);
      const localIdx = type === 'max'
        ? win.reduce((best, val, i) => val > win[best] ? i : best, 0)
        : win.reduce((best, val, i) => val < win[best] ? i : best, 0);
      actualIdx = start + localIdx;
    }
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
      const exact = prev.find(e => e.index === targetIndex);
      if (exact) return prev.filter(e => e.index !== targetIndex);
      const closest = prev.reduce<Extremum | null>((best, e) =>
        !best || Math.abs(e.index - targetIndex) < Math.abs(best.index - targetIndex) ? e : best, null);
      if (closest && Math.abs(closest.index - targetIndex) <= 50) {
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
    let actualIdx: number;
    if (bottomEpsilon === 0) {
      actualIdx = Math.max(0, Math.min(clickIndex, bottomData.length - 1));
    } else {
      const start = Math.max(0, clickIndex - bottomEpsilon);
      const end = Math.min(bottomData.length, clickIndex + bottomEpsilon + 1);
      const win = bottomData.slice(start, end);
      const localIdx = type === 'max'
        ? win.reduce((best, val, i) => val > win[best] ? i : best, 0)
        : win.reduce((best, val, i) => val < win[best] ? i : best, 0);
      actualIdx = start + localIdx;
    }
    const newExt: Extremum = {
      value: bottomData[actualIdx],
      index: actualIdx,
      type: type === 'max' ? 1 : 0,
    };
    setBottomExtrema(prev => {
      // Only replace an extremum at the exact same index, never remove neighbors
      const filtered = prev.filter(e => e.index !== actualIdx);
      return [...filtered, newExt].sort((a, b) => a.index - b.index);
    });
  }, [bottomData, bottomEpsilon]);

  const removeBottomExtremum = useCallback((targetIndex: number) => {
    setBottomExtrema(prev => {
      // First try exact match
      const exact = prev.find(e => e.index === targetIndex);
      if (exact) return prev.filter(e => e.index !== targetIndex);
      // For chart clicks: find the single closest extremum
      const closest = prev.reduce<Extremum | null>((best, e) =>
        !best || Math.abs(e.index - targetIndex) < Math.abs(best.index - targetIndex) ? e : best, null);
      if (closest && Math.abs(closest.index - targetIndex) <= 50) {
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
    [bottomEditMode, bottomEditAction, bottomExtrema, addBottomExtremum, removeBottomExtremum]
  );

  const detectPatterns = useCallback(async (extrema: Extremum[], pattern: 'low-high-low' | 'high-low-high'): Promise<RefPatternEvent[]> => {
    if (extrema.length < 3) return [];
    const patternArray = pattern === 'low-high-low' ? [0, 1, 0] : [1, 0, 1];
    const { events: backendEvents } = await getPatternEventsFromExtrema(extrema, patternArray, frequency);

    const avgCycleLen = events.length > 0
      ? events.reduce((sum, e) => sum + (e.end_index - e.start_index), 0) / events.length
      : 100;
    const tolerance = Math.round(avgCycleLen * 0.2);

    return backendEvents.map(e => {
      let mainCycleIndex = -1;
      let delayTime = 0;
      for (let j = 0; j < events.length; j++) {
        const m = events[j];
        if (e.start_index >= m.start_index - tolerance && e.start_index <= m.end_index + tolerance) {
          mainCycleIndex = j;
          delayTime = (e.start_index - m.start_index) / frequency;
          break;
        }
      }
      return {
        startIndex: e.start_index,
        inflectionIndex: e.inflexion_index,
        endIndex: e.end_index,
        startValue: e.start_value,
        startTime: e.start_time,
        inflectionValue: e.inflexion_value,
        inflectionTime: e.inflexion_time,
        endValue: e.end_value,
        endTime: e.end_time,
        shiftStartToInflexion: e.shift_start_to_inflexion,
        shiftInflexionToEnd: e.shift_inflexion_to_end,
        timeStartToInflexion: e.time_start_to_inflexion,
        timeInflexionToEnd: e.time_inflexion_to_end,
        cycleTime: e.cycle_time,
        intercycleTime: e.intercycle_time,
        patternType: e.pattern_type,
        mainCycleIndex,
        delayTime,
      };
    });
  }, [frequency, events]);

  useEffect(() => {
    let cancelled = false;
    detectPatterns(topExtrema, selectedPattern).then(result => {
      if (!cancelled) setRefPatternEvents(result);
    });
    return () => { cancelled = true; };
  }, [topExtrema, selectedPattern, detectPatterns]);

  useEffect(() => {
    let cancelled = false;
    detectPatterns(bottomExtrema, selectedPattern).then(result => {
      if (!cancelled) setBottomPatternEvents(result);
    });
    return () => { cancelled = true; };
  }, [bottomExtrema, selectedPattern, detectPatterns]);

  const exportParametersCSV = useCallback(async () => {
    const headers = [
      'Chart', '#', 'Pattern Type',
      'Start Value', 'Start Time (s)',
      'Inflexion Value', 'Inflexion Time (s)',
      'End Value', 'End Time (s)',
      'Shift Start-Inflexion', 'Shift Inflexion-End',
      'Time Start-Inflexion (s)', 'Time Inflexion-End (s)',
      'Cycle Time (s)', 'Intercycle Time (s)',
      'Main Cycle #', 'Delay Time (s)'
    ];
    const buildRows = (evts: RefPatternEvent[], label: string) =>
      evts.map((evt, i) => [
        label, i + 1, evt.patternType,
        evt.startValue.toFixed(4), evt.startTime.toFixed(4),
        evt.inflectionValue.toFixed(4), evt.inflectionTime.toFixed(4),
        evt.endValue.toFixed(4), evt.endTime.toFixed(4),
        evt.shiftStartToInflexion.toFixed(4), evt.shiftInflexionToEnd.toFixed(4),
        evt.timeStartToInflexion.toFixed(4), evt.timeInflexionToEnd.toFixed(4),
        evt.cycleTime.toFixed(4),
        evt.intercycleTime !== null ? evt.intercycleTime.toFixed(4) : '',
        evt.mainCycleIndex >= 0 ? evt.mainCycleIndex + 1 : 'N/A',
        evt.delayTime.toFixed(4)
      ]);
    const colKeys = Object.keys(allBottomExtrema).map(Number).sort((a, b) => a - b);
    const rows: (string | number)[][] = [];
    for (const col of colKeys) {
      const extrema = allBottomExtrema[col];
      if (!extrema || extrema.length === 0) continue;
      const colEvents = await detectPatterns(extrema, selectedPattern);
      rows.push(...buildRows(colEvents, `Reference (Col ${col + 1})`));
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
    const rawMin = vals.length > 0 ? Math.min(...vals) : 0;
    const rawMax = vals.length > 0 ? Math.max(...vals) : 10;
    const niceStep = (v: number) => {
      const abs = Math.abs(v);
      if (abs >= 1000) return 100;
      if (abs >= 100) return 10;
      if (abs >= 10) return 5;
      return 1;
    };
    const yMax = Math.ceil(rawMax / niceStep(rawMax)) * niceStep(rawMax);
    const yMin = Math.floor(rawMin / niceStep(rawMin)) * niceStep(rawMin);
    const xMaxRounded = Math.ceil(colData.length / 100) * 100;
    const scaleX = (i: number) => margin.left + (i / Math.max(xMaxRounded, 1)) * plotW;
    const scaleY = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

    let svg = `<g>`;
    svg += `<rect x="0" y="0" width="${chartW}" height="${chartH}" fill="#0f172a"/>`;
    svg += `<text x="10" y="18" fill="#e5e5e5" font-size="13" font-family="sans-serif" font-weight="bold">${title}</text>`;

    const yTicks = 5;
    for (let t = 0; t <= yTicks; t++) {
      const val = yMin + (yMax - yMin) * (t / yTicks);
      const y = scaleY(val);
      svg += `<line x1="${margin.left}" y1="${y.toFixed(1)}" x2="${margin.left + plotW}" y2="${y.toFixed(1)}" stroke="rgba(148,163,184,0.1)"/>`;
      svg += `<text x="${margin.left - 4}" y="${(y + 3).toFixed(1)}" fill="#94a3b8" font-size="9" font-family="sans-serif" text-anchor="end">${Math.round(val)}</text>`;
    }

    for (const range of ranges) {
      const x1 = scaleX(range.start);
      const x2 = scaleX(range.end);
      svg += `<rect x="${Math.min(x1, x2).toFixed(1)}" y="${margin.top}" width="${Math.abs(x2 - x1).toFixed(1)}" height="${plotH}" fill="${range.color}" fill-opacity="${range.opacity}" stroke="${range.color}" stroke-opacity="0.5"/>`;
    }

    svg += `<rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" fill="none" stroke="rgba(148,163,184,0.15)"/>`;

    const points = colData.map((v, i) => `${scaleX(i).toFixed(1)},${scaleY(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${points}" fill="none" stroke="#10b981" stroke-width="1.5"/>`;

    const inRange = (idx: number) => ranges.some(r => idx >= r.start && idx <= r.end);
    let segment: string[] = [];
    const flushSegment = () => {
      if (segment.length >= 2) {
        svg += `<polyline points="${segment.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2"/>`;
      }
      segment = [];
    };
    for (let i = 0; i < colData.length; i++) {
      if (inRange(i)) {
        segment.push(`${scaleX(i).toFixed(1)},${scaleY(colData[i]).toFixed(1)}`);
      } else {
        flushSegment();
      }
    }
    flushSegment();

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

      const topYellowRanges = showTopAreas
        ? patternRanges.map(r => ({ start: r.start, end: r.end, color: '#fbbf24', opacity: 0.2 }))
        : [];
      const bottomYellowRanges = showBottomAreas
        ? bottomPatternRanges.map(r => ({ start: r.start, end: r.end, color: '#fbbf24', opacity: 0.2 }))
        : [];

      let combinedInner = '';
      let yOff = 0;
      for (let col = 0; col < totalColumns; col++) {
        const colExtrema = col === topColumn ? topExtrema : (allBottomExtrema[col] ?? []);
        const ranges = col === topColumn ? topYellowRanges : (col === bottomColumn ? bottomYellowRanges : []);
        const title = `Column ${col + 1}`;
        const chartSvg = buildChartSvg(allColData[col], title, colExtrema, ranges, chartW, chartH, margin);
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
  }, [totalColumns, analyzedColumn, analyzedData, topColumn, topData, topExtrema, bottomColumn, bottomData, sessionId, allBottomExtrema, patternRanges, bottomPatternRanges, showTopAreas, showBottomAreas, buildChartSvg]);

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
            <h2 className="text-lg font-semibold text-white">Reference Trend Analysis</h2>
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-neutral-300">Main Trend:</p>
              <select
                value={topColumn}
                onChange={(e) => setTopColumn(Number(e.target.value))}
                className="px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
              >
                {columnOptions.map((col) => (
                  <option key={col} value={col}>Column {col + 1}</option>
                ))}
              </select>
              <span className="text-xs text-blue-400">{refMaxima.length} Max</span>
              <span className="text-xs text-emerald-400">{refMinima.length} Min</span>
              <span className="text-xs text-primary-400 font-semibold">{events.length} Events</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTopAreas(prev => !prev)}
                className={`p-1 rounded transition-colors ${showTopAreas ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                title={showTopAreas ? 'Hide Pattern' : 'Show Pattern'}
              >
                {showTopAreas ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={resetTopView}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTopChartHeight(prev => Math.min(600, prev + 50))}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Increase Chart Size"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => setTopChartHeight(prev => Math.max(100, prev - 50))}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Decrease Chart Size"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div 
            ref={topChartRef}
            style={{ height: `${topChartHeight}px` }}
            className={`rounded-xl bg-neutral-900/50 p-4 ${topIsDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={(e) => {
              if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY;
                const [yMin, yMax] = topYDomain;
                const { topMin, topMax } = getXAxisConfig;
                setTopYCenter((yMin + yMax) / 2);
                setTopXCenter((topMin + topMax) / 2);
                setTopYZoom(prev => {
                  const newZoom = delta > 0 ? prev * 0.9 : prev * 1.1;
                  return Math.max(0.1, Math.min(10, newZoom));
                });
                setTopXZoom(prev => {
                  const newZoom = delta > 0 ? prev * 0.9 : prev * 1.1;
                  return Math.max(0.1, Math.min(10, newZoom));
                });
              }
            }}
            onMouseDown={(e) => {
              if (editMode) return;
              const [yMin, yMax] = topYDomain;
              const { topMin, topMax } = getXAxisConfig;
              setTopIsDragging(true);
              setTopDragStart({
                x: e.clientX,
                y: e.clientY,
                xCenter: (topMin + topMax) / 2,
                yCenter: (yMin + yMax) / 2
              });
            }}
            onMouseMove={(e) => {
              if (!topIsDragging || !topDragStart || editMode) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const deltaY = e.clientY - topDragStart.y;
              const deltaX = e.clientX - topDragStart.x;
              const [yMin, yMax] = topYDomain;
              const { topMin, topMax } = getXAxisConfig;
              const yRange = yMax - yMin;
              const xRange = topMax - topMin;
              const yShift = -(deltaY / rect.height) * yRange;
              const xShift = -(deltaX / rect.width) * xRange;
              setTopYCenter(topDragStart.yCenter + yShift);
              setTopXCenter(topDragStart.xCenter + xShift);
            }}
            onMouseUp={() => {
              setTopIsDragging(false);
              setTopDragStart(null);
            }}
            onMouseLeave={() => {
              setTopIsDragging(false);
              setTopDragStart(null);
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={topChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis 
                  dataKey="index"
                  type="number"
                  stroke="#64748b" 
                  fontSize={10}
                  domain={[getXAxisConfig.topMin, getXAxisConfig.topMax]}
                  ticks={getXAxisConfig.ticks}
                  allowDataOverflow={true}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={topYDomain}
                  allowDataOverflow={true}
                  tickFormatter={(v: number) => {
                    const abs = Math.abs(v);
                    if (abs >= 1000) return v.toFixed(0);
                    if (abs >= 10) return v.toFixed(1);
                    return v.toFixed(2);
                  }}
                  width={60}
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

        <div>
          <div className="flex items-center justify-between mb-2 mt-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-neutral-300">Reference Trend (Column {bottomColumn + 1}):</p>
              <select
                value={bottomColumn}
                onChange={(e) => setBottomColumn(Number(e.target.value))}
                className="px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
              >
                {columnOptions.filter(col => col !== topColumn).map((col) => (
                  <option key={col} value={col}>Column {col + 1}</option>
                ))}
              </select>
              {isLoading && <span className="text-neutral-500 text-xs">Loading...</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={searchBottomExtrema}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Run Detection"
              >
                <Play className="w-3 h-3" />
              </button>
              <button
                onClick={() => { if (confirm('Remove all extrema?')) setBottomExtrema([]); }}
                className="p-1 rounded bg-neutral-800 hover:bg-red-600 text-neutral-300 hover:text-white transition-colors"
                title="Remove All Extrema"
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setShowBottomAreas(prev => !prev)}
                className={`p-1 rounded transition-colors ${showBottomAreas ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                title={showBottomAreas ? 'Hide Pattern' : 'Show Pattern'}
              >
                {showBottomAreas ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={resetBottomView}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Reset View"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setBottomChartHeight(prev => Math.min(600, prev + 50))}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Increase Chart Size"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => setBottomChartHeight(prev => Math.max(100, prev - 50))}
                className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Decrease Chart Size"
              >
                <Minus className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div 
            ref={bottomChartRef}
            style={{ height: `${bottomChartHeight}px` }}
            className={`rounded-xl bg-neutral-900/50 p-4 ${bottomEditMode && bottomEditAction === 'remove' ? 'cursor-pointer ring-2 ring-red-500/50' : bottomEditMode ? 'cursor-crosshair ring-2 ring-orange-500/50' : bottomIsDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onWheel={(e) => {
              if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY;
                const [yMin, yMax] = bottomYDomain;
                const { bottomMin, bottomMax } = getXAxisConfig;
                setBottomYCenter((yMin + yMax) / 2);
                setBottomXCenter((bottomMin + bottomMax) / 2);
                setBottomYZoom(prev => {
                  const newZoom = delta > 0 ? prev * 0.9 : prev * 1.1;
                  return Math.max(0.1, Math.min(10, newZoom));
                });
                setBottomXZoom(prev => {
                  const newZoom = delta > 0 ? prev * 0.9 : prev * 1.1;
                  return Math.max(0.1, Math.min(10, newZoom));
                });
              }
            }}
            onMouseDown={(e) => {
              const [yMin, yMax] = bottomYDomain;
              const { bottomMin, bottomMax } = getXAxisConfig;
              setBottomIsDragging(true);
              setBottomDragStart({
                x: e.clientX,
                y: e.clientY,
                xCenter: (bottomMin + bottomMax) / 2,
                yCenter: (yMin + yMax) / 2
              });
            }}
            onMouseMove={(e) => {
              if (!bottomIsDragging || !bottomDragStart) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const deltaY = e.clientY - bottomDragStart.y;
              const deltaX = e.clientX - bottomDragStart.x;
              const [yMin, yMax] = bottomYDomain;
              const { bottomMin, bottomMax } = getXAxisConfig;
              const yRange = yMax - yMin;
              const xRange = bottomMax - bottomMin;
              const yShift = -(deltaY / rect.height) * yRange;
              const xShift = -(deltaX / rect.width) * xRange;
              setBottomYCenter(bottomDragStart.yCenter + yShift);
              setBottomXCenter(bottomDragStart.xCenter + xShift);
            }}
            onMouseUp={() => {
              setBottomIsDragging(false);
              setBottomDragStart(null);
            }}
            onMouseLeave={() => {
              setBottomIsDragging(false);
              setBottomDragStart(null);
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bottomChartData} onClick={handleBottomChartClick}
                onMouseMove={(e: any) => {
                  if (!bottomEditMode || bottomEditAction !== 'remove' || !e) {
                    setBottomRemoveCandidate(null);
                    return;
                  }
                  const idx = e.activePayload?.[0]?.payload?.index ?? e.activeLabel;
                  if (idx === undefined || idx === null) { setBottomRemoveCandidate(null); return; }
                  const numIdx = Number(idx);
                  const closest = bottomExtrema.reduce<Extremum | null>((best, ext) =>
                    !best || Math.abs(ext.index - numIdx) < Math.abs(best.index - numIdx) ? ext : best, null);
                  if (closest && Math.abs(closest.index - numIdx) <= 50) {
                    setBottomRemoveCandidate(closest.index);
                  } else {
                    setBottomRemoveCandidate(null);
                  }
                }}
                onMouseLeave={() => setBottomRemoveCandidate(null)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis 
                  dataKey="index"
                  type="number"
                  stroke="#64748b" 
                  fontSize={10}
                  domain={[getXAxisConfig.bottomMin, getXAxisConfig.bottomMax]}
                  ticks={getXAxisConfig.ticks}
                  allowDataOverflow={true}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  domain={bottomYDomain}
                  allowDataOverflow={true}
                  tickFormatter={(v: number) => {
                    const abs = Math.abs(v);
                    if (abs >= 1000) return v.toFixed(0);
                    if (abs >= 10) return v.toFixed(1);
                    return v.toFixed(2);
                  }}
                  width={60}
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
                {bottomExtrema.filter(e => e.type === 1).map((ext, i) => {
                  const isRemoveTarget = bottomRemoveCandidate === ext.index;
                  const isHighlighted = bottomHighlightIndex === ext.index;
                  return (
                    <ReferenceDot
                      key={`bmax-${ext.index}-${i}`}
                      x={ext.index}
                      y={ext.value}
                      r={isRemoveTarget ? 10 : isHighlighted ? 6 : 4}
                      fill={isRemoveTarget ? '#ef4444' : '#3b82f6'}
                      stroke={isRemoveTarget ? '#fff' : '#fff'}
                      strokeWidth={isRemoveTarget ? 3 : 1}
                    />
                  );
                })}
                {bottomExtrema.filter(e => e.type === 0).map((ext, i) => {
                  const isRemoveTarget = bottomRemoveCandidate === ext.index;
                  const isHighlighted = bottomHighlightIndex === ext.index;
                  return (
                    <ReferenceDot
                      key={`bmin-${ext.index}-${i}`}
                      x={ext.index}
                      y={ext.value}
                      r={isRemoveTarget ? 10 : isHighlighted ? 6 : 4}
                      fill={isRemoveTarget ? '#ef4444' : '#10b981'}
                      stroke={isRemoveTarget ? '#fff' : '#fff'}
                      strokeWidth={isRemoveTarget ? 3 : 1}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 p-3 bg-neutral-900/50 rounded-xl">
            <div className="flex flex-wrap items-center gap-4 mb-3">

              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">Pattern:</span>
                <button
                  onClick={() => { setSelectedPattern('low-high-low'); onPatternChange([0, 1, 0]); }}
                  className={`px-3 py-1 text-xs rounded ${selectedPattern === 'low-high-low' ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  Low → High → Low
                </button>
                <button
                  onClick={() => { setSelectedPattern('high-low-high'); onPatternChange([1, 0, 1]); }}
                  className={`px-3 py-1 text-xs rounded ${selectedPattern === 'high-low-high' ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  High → Low → High
                </button>
              </div>
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
                <span className="text-sm text-neutral-400">Min Distance:</span>
                <input
                  type="number"
                  defaultValue={bottomMinDistance}
                  key={bottomMinDistance}
                  onBlur={(e) => {
                    const v = Math.max(1, Number(e.target.value));
                    if (v === bottomMinDistance || !Number.isFinite(v)) return;
                    if (confirm('Changing Min Distance will reset all extrema (including custom points). Continue?')) {
                      setBottomMinDistance(v);
                    } else {
                      e.target.value = String(bottomMinDistance);
                    }
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-20 px-2 py-1 bg-neutral-800 border border-white/10 rounded text-white text-xs"
                  min={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400">{bottomMaxima.length} Max</span>
                <span className="text-xs text-emerald-400">{bottomMinima.length} Min</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-400">Maxima ({bottomMaxima.length})</span>
                  {bottomMaxima.length > 0 && (
                    <button onClick={() => setBottomExtrema(prev => prev.filter(e => e.type !== 1))} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                  )}
                </div>
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
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-400">Minima ({bottomMinima.length})</span>
                  {bottomMinima.length > 0 && (
                    <button onClick={() => setBottomExtrema(prev => prev.filter(e => e.type !== 0))} className="text-xs text-red-400 hover:text-red-300">Clear</button>
                  )}
                </div>
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
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs whitespace-nowrap">
                  <thead className="sticky top-0 bg-neutral-900">
                    <tr className="text-neutral-400 border-b border-white/10">
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Type</th>
                      <th className="px-2 py-1 text-left">Start Val</th>
                      <th className="px-2 py-1 text-left">Start Time</th>
                      <th className="px-2 py-1 text-left">Infl. Val</th>
                      <th className="px-2 py-1 text-left">Infl. Time</th>
                      <th className="px-2 py-1 text-left">End Val</th>
                      <th className="px-2 py-1 text-left">End Time</th>
                      <th className="px-2 py-1 text-left">Shift S-I</th>
                      <th className="px-2 py-1 text-left">Shift I-E</th>
                      <th className="px-2 py-1 text-left">Time S-I</th>
                      <th className="px-2 py-1 text-left">Time I-E</th>
                      <th className="px-2 py-1 text-left">Cycle Time</th>
                      <th className="px-2 py-1 text-left">Intercycle</th>
                      <th className="px-2 py-1 text-left">Main Cycle</th>
                      <th className="px-2 py-1 text-left">Delay</th>
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
                        <td className="px-2 py-1">{evt.patternType}</td>
                        <td className="px-2 py-1">{evt.startValue.toFixed(2)}</td>
                        <td className="px-2 py-1">{evt.startTime.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.inflectionValue.toFixed(2)}</td>
                        <td className="px-2 py-1">{evt.inflectionTime.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.endValue.toFixed(2)}</td>
                        <td className="px-2 py-1">{evt.endTime.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.shiftStartToInflexion.toFixed(4)}</td>
                        <td className="px-2 py-1">{evt.shiftInflexionToEnd.toFixed(4)}</td>
                        <td className="px-2 py-1">{evt.timeStartToInflexion.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.timeInflexionToEnd.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.cycleTime.toFixed(4)}s</td>
                        <td className="px-2 py-1">{evt.intercycleTime !== null ? `${evt.intercycleTime.toFixed(4)}s` : '\u2014'}</td>
                        <td className="px-2 py-1">{evt.mainCycleIndex >= 0 ? `#${evt.mainCycleIndex + 1}` : 'N/A'}</td>
                        <td className="px-2 py-1 text-orange-400">{evt.delayTime.toFixed(4)}s</td>
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
