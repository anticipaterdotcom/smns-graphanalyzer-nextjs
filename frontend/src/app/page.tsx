'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { RefreshCw, Film, Upload, TrendingUp, Layers, Settings } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import AnalysisControls from '@/components/AnalysisControls';
import GraphChart from '@/components/GraphChart';
import PatternSelector from '@/components/PatternSelector';
import MeanTrendsAnalyzer from '@/components/MeanTrendsAnalyzer';
import ExtremaEditor from '@/components/ExtremaEditor';
import StickFigurePlayer from '@/components/StickFigurePlayer';
import ReferenceAnalysis from '@/components/ReferenceAnalysis';
import SaveManager from '@/components/SaveManager';
import { SaveState, createSaveState, addToVersionHistory } from '@/lib/saveManager';
import {
  loadDefaultData,
  uploadFile,
  analyzeData,
  getPatternEvents,
  addExtremum,
  removeExtremum,
  getStickFigureData,
  restoreState,
  Extremum,
  PatternEvent,
  StickFigureData,
} from '@/lib/api';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [columns, setColumns] = useState(0);
  const [data, setData] = useState<number[]>([]);
  const [extrema, setExtrema] = useState<Extremum[]>([]);
  const [events, setEvents] = useState<PatternEvent[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<number[]>([0, 1, 0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editAction, setEditAction] = useState<'add-max' | 'add-min' | 'remove' | null>(null);
  const [epsilon, setEpsilon] = useState(20);
  const [currentColumn, setCurrentColumn] = useState(0);
  const [stickFigureData, setStickFigureData] = useState<StickFigureData | null>(null);
  const [showStickFigure, setShowStickFigure] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
  const [highlightedEvent, setHighlightedEvent] = useState<PatternEvent | null>(null);
  const [highlightedExtremumIndex, setHighlightedExtremumIndex] = useState<number | null>(null);
    const [showReferenceAnalysis, setShowReferenceAnalysis] = useState(false);
  const [showMeanTrendsAnalyzer, setShowMeanTrendsAnalyzer] = useState(false);
  const [showAnalysisParams, setShowAnalysisParams] = useState(false);
  const stickFigureRef = useRef<HTMLDivElement>(null);
    const referenceAnalysisRef = useRef<HTMLDivElement>(null);
  const meanTrendsAnalyzerRef = useRef<HTMLDivElement>(null);
  const analysisControlsRef = useRef<HTMLDivElement>(null);

  const autoSave = useCallback((action: string) => {
    if (data.length === 0) return;
    const state = createSaveState(
      sessionId,
      currentColumn,
      selectedPattern,
      extrema,
      events,
      data,
      columns,
      `Auto: ${action}`
    );
    addToVersionHistory(state);
  }, [sessionId, currentColumn, selectedPattern, extrema, events, data, columns]);

  useEffect(() => {
    const loadDefaultAndAnalyze = async () => {
      setIsLoading(true);
      try {
        const result = await loadDefaultData();
        setSessionId(result.session_id);
        setColumns(result.columns);
        
        const defaultColumn = 4;
        const defaultMinDistance = 100;
        const defaultFrequency = 250;
        setCurrentColumn(defaultColumn);
        
        const analysisResult = await analyzeData(result.session_id, defaultColumn, defaultMinDistance, defaultFrequency);
        setExtrema(analysisResult.extrema);
        setData(analysisResult.column_data);
        
        // Auto-detect patterns with default pattern (Low → High → Low)
        const defaultPattern = [0, 1, 0];
        setSelectedPattern(defaultPattern);
        const patternResult = await getPatternEvents(result.session_id, defaultPattern);
        setEvents(patternResult.events);
      } catch (err) {
        setShowUploadForm(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadDefaultAndAnalyze();
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      setSessionId(result.session_id);
      setColumns(result.columns);
      setExtrema([]);
      setEvents([]);
      setData([]);
      setShowUploadForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(
    async (column: number, minDistance: number, frequency: number) => {
      if (!sessionId) return;
      setIsLoading(true);
      setError(null);
      setCurrentColumn(column);
      try {
        const analysisResult = await analyzeData(sessionId, column, minDistance, frequency);
        setExtrema(analysisResult.extrema);
        setData(analysisResult.column_data);
        
        // Auto-detect patterns with default pattern (Low → High → Low)
        const defaultPattern = [0, 1, 0];
        setSelectedPattern(defaultPattern);
        const patternResult = await getPatternEvents(sessionId, defaultPattern);
        setEvents(patternResult.events);
        
        autoSave(`Analysis col ${column}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, autoSave]
  );

  const handlePatternSelect = useCallback(
    async (pattern: number[]) => {
      if (!sessionId) return;
      setSelectedPattern(pattern);
      setIsLoading(true);
      try {
        const result = await getPatternEvents(sessionId, pattern);
        setEvents(result.events);
        
        autoSave(`Pattern ${pattern.join('-')}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Pattern detection failed');
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, autoSave]
  );

  const handleAddExtremum = useCallback(
    async (index: number, type: string, epsilon: number = 20) => {
      if (!sessionId) return;
      try {
        const newExt = await addExtremum(sessionId, index, type, epsilon);
        setExtrema((prev) => [...prev, newExt].sort((a, b) => a.index - b.index));
        
        // Re-run pattern detection
        if (selectedPattern.length > 0) {
          const patternResult = await getPatternEvents(sessionId, selectedPattern);
          setEvents(patternResult.events);
        }
        autoSave(`Add ${type}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add extremum');
      }
    },
    [sessionId, selectedPattern, autoSave]
  );

  const handleRemoveExtremum = useCallback(
    async (index: number) => {
      if (!sessionId) return;
      try {
        const result = await removeExtremum(sessionId, index);
        if (result.success) {
          setExtrema((prev) => prev.filter((e) => Math.abs(e.index - index) >= 15));
          
          // Re-run pattern detection
          if (selectedPattern.length > 0) {
            const patternResult = await getPatternEvents(sessionId, selectedPattern);
            setEvents(patternResult.events);
          }
          autoSave('Remove extremum');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove extremum');
      }
    },
    [sessionId, selectedPattern, autoSave]
  );

  const handleChartClick = useCallback(
    (index: number) => {
      if (!editMode || !editAction) return;
      if (editAction === 'remove') {
        handleRemoveExtremum(index);
      } else {
        handleAddExtremum(index, editAction === 'add-max' ? 'max' : 'min', epsilon);
      }
    },
    [editMode, editAction, handleAddExtremum, handleRemoveExtremum, epsilon]
  );

  const handleReset = useCallback(() => {
    setSessionId(null);
    setColumns(0);
    setData([]);
    setExtrema([]);
    setEvents([]);
    setError(null);
    setStickFigureData(null);
    setShowStickFigure(false);
    setShowUploadForm(true);
  }, []);

  const handleOpenStickFigure = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      // Use single column mode - animate the currently selected column as a signal trace
      const result = await getStickFigureData(sessionId, [], undefined, 24, currentColumn);
      setStickFigureData(result);
      setShowStickFigure(true);
      
      // Scroll to stick figure player after it renders
      setTimeout(() => {
        stickFigureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stick figure data');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentColumn]);

  const handleLoadState = useCallback(async (state: SaveState) => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      setCurrentColumn(state.currentColumn);
      setSelectedPattern(state.selectedPattern);
      setExtrema(state.extrema);
      setData(state.data);
      setColumns(state.columns);
      setShowUploadForm(false);
      setShowStickFigure(false);
      setShowMeanTrendsAnalyzer(false);
      
      await restoreState(sessionId, state.extrema);
      
      const patternResult = await getPatternEvents(sessionId, state.selectedPattern);
      setEvents(patternResult.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore state');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const patternRanges = events.map((e) => ({ start: e.start_index, end: e.end_index }));

  return (
    <div className="min-h-screen bg-black relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute inset-[-20%] opacity-60"
          style={{
            background: 'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 80% 25%, rgba(16,185,129,0.2), transparent 60%), radial-gradient(circle at 50% 80%, rgba(236,72,153,0.12), transparent 60%)',
            filter: 'blur(20px)',
            animation: 'gradient-shift 16s ease-in-out infinite',
            backgroundSize: '120% 120%',
          }}
        />
      </div>

      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-black/40">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <svg width="34" height="34" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg" className="h-[34px] w-[34px]">
                <g transform="scale(1.000000,-1.000000) translate(0,-50)">
                  <path d="M 1.000000 36.856517 L 36.857325 36.857325 L 36.857325 1.000000 L 1.000000 1.000000 Z" transform="scale(1.000000,1.000000) translate(6.000000,6.376821)" fill="#ffffff" opacity="1.000000"></path>
                  <path d="M 19.803874 11.467102 L 1.000000 3.915355 L 1.000000 1.000000 L 23.269594 10.483682 L 23.269594 12.766791 L 1.000000 22.250474 L 1.000000 19.335122 Z" transform="scale(1.000000,1.000000) translate(10.613154,11.276790)" fill="#000000" opacity="1.000000"></path>
                </g>
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" width="160" height="20" viewBox="0 0 334 38" fill="none" className="h-5 w-auto">
                <path d="M26.363 28.321l3.503 8.587h4.689L19.301 1.092h-3.672L.376 36.908h4.689l3.503-8.587zm-1.299-3.22H9.81l7.627-18.699zM72.279 1.092h-4.406v28.755L46.179 1.092h-4.406v35.816h4.406V8.04l21.694 28.868h4.406zm35.578 3.446V1.092H79.61v3.446h11.977v32.37h4.35V4.538zm6.653-3.446v35.816h4.407V1.092zm12.303 22.54c0 4.745 1.356 8.248 4.011 10.451s6.214 3.277 10.734 3.277c4.35 0 7.739-.96 10.282-2.938 2.599-1.977 3.842-4.632 3.842-8.022v-.226h-4.293v.226c0 2.316-.904 4.18-2.599 5.48-1.752 1.356-4.124 1.977-7.175 1.977-6.892 0-10.395-3.333-10.395-9.999v-9.321c0-3.728.904-6.384 2.656-8.022s4.293-2.429 7.683-2.429c3.051 0 5.423.678 7.174 2.034s2.656 3.164 2.656 5.48v.169h4.406V11.6c0-2.147-.565-4.067-1.751-5.762-1.186-1.638-2.825-2.938-4.971-3.841-2.203-.904-4.689-1.356-7.514-1.356-4.519 0-8.079 1.13-10.734 3.333s-4.011 5.649-4.011 10.395zm36.312-22.54v35.816h4.407V1.092zm40.493 10.677c0-3.39-1.13-6.045-3.503-7.909-2.316-1.864-5.536-2.768-9.66-2.768h-15.027v35.816h4.407V22.107h10.62c4.068 0 7.288-.904 9.604-2.712 2.373-1.864 3.559-4.406 3.559-7.626zm-4.407 0c0 2.316-.791 4.067-2.372 5.197-1.582 1.186-3.842 1.751-6.723 1.751h-10.282V4.538h10.282c2.881 0 5.141.565 6.723 1.751 1.581 1.243 2.372 3.051 2.372 5.48zm31.737 16.552l3.502 8.587h4.689L223.886 1.092h-3.672L204.96 36.908h4.689l3.503-8.587zm-1.3-3.22h-15.253l7.627-18.699zm34.73-20.563V1.092h-28.247v3.446h11.976v32.37h4.35V4.538zm11.738 0h21.015V1.092h-25.422v35.816h25.422v-3.39h-21.015V20.412h17.964v-3.446h-17.964zm42.865 16.665l9.435 15.705h5.084l-9.886-16.1c2.825-.508 5.028-1.638 6.609-3.277 1.582-1.695 2.373-3.785 2.373-6.384 0-3.22-1.13-5.706-3.333-7.4-2.26-1.751-5.367-2.655-9.265-2.655h-15.536v35.816h4.407V21.203zm-10.112-3.277V4.538h10.734c2.768 0 4.915.565 6.383 1.695s2.203 2.768 2.203 4.971c0 2.147-.735 3.841-2.26 4.971-1.469 1.186-3.616 1.751-6.327 1.751z" fill="white"/>
              </svg>
            </div>
            <div className="border-l border-white/20 pl-4">
              <h1 className="text-lg font-semibold text-white tracking-tight">Staatliches Museum für Naturkunde Stuttgart</h1>
              <p className="text-xs text-neutral-400">Graph Analyzer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveManager
              sessionId={sessionId}
              currentColumn={currentColumn}
              selectedPattern={selectedPattern}
              extrema={extrema}
              events={events}
              data={data}
              columns={columns}
              onLoadState={handleLoadState}
              disabled={isLoading}
            />
            {sessionId && (
              <button
                onClick={() => setShowAnalysisParams(!showAnalysisParams)}
                className={`p-2 bg-neutral-800 border border-white/10 rounded-lg hover:bg-neutral-700 transition-colors ${showAnalysisParams ? 'text-primary-400' : 'text-neutral-300'}`}
                title="Analysis Parameters"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            {sessionId && (
              <>
                <div className="w-px h-6 bg-white/10" />
                <button
                  onClick={() => {
                    setShowMeanTrendsAnalyzer(true);
                    setTimeout(() => meanTrendsAnalyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  }}
                  disabled={isLoading || events.length < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Trend
                </button>
                <button
                  onClick={() => {
                    setShowReferenceAnalysis(true);
                    setTimeout(() => referenceAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  }}
                  disabled={isLoading || events.length < 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-sm font-medium rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Ref
                </button>
                <button
                  onClick={handleOpenStickFigure}
                  disabled={isLoading || columns < 2}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-sm font-medium rounded-lg hover:from-blue-500 hover:to-emerald-500 transition-all disabled:opacity-50"
                >
                  <Film className="w-3.5 h-3.5" />
                  Stick
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-700 border border-neutral-600 text-white text-sm font-medium rounded-lg hover:bg-neutral-600 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  New
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {showUploadForm ? (
          <div className="max-w-xl mx-auto">
            <FileUpload onFileSelect={handleFileUpload} isLoading={isLoading} />
          </div>
        ) : !sessionId ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500/30 border-t-primary-500"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {showAnalysisParams && (
              <div ref={analysisControlsRef}>
                <AnalysisControls columns={columns} onAnalyze={handleAnalyze} isLoading={isLoading} hasExtrema={extrema.length > 0} />
              </div>
            )}

            <GraphChart
              data={data}
              extrema={extrema}
              selectedPattern={selectedPattern}
              patternRanges={patternRanges}
              highlightRange={highlightedEvent ? { start: highlightedEvent.start_index, end: highlightedEvent.end_index } : null}
              highlightIndex={highlightedExtremumIndex}
            />

            {sessionId && data.length > 0 && (
              <div ref={referenceAnalysisRef}>
                <ReferenceAnalysis
                  sessionId={sessionId}
                  analyzedColumn={currentColumn}
                  analyzedData={data}
                  events={events}
                  totalColumns={columns}
                  onClose={() => setShowReferenceAnalysis(false)}
                  mainExtrema={extrema}
                  editMode={editMode}
                  editAction={editAction}
                  onChartClick={handleChartClick}
                  highlightedExtremumIndex={highlightedExtremumIndex}
                  onToggleEditMode={() => setEditMode(!editMode)}
                  onEditActionChange={setEditAction}
                  onAddExtremum={handleAddExtremum}
                  onRemoveExtremum={handleRemoveExtremum}
                  epsilon={epsilon}
                  onEpsilonChange={setEpsilon}
                  onPatternChange={handlePatternSelect}
                  currentPattern={selectedPattern}
                />
              </div>
            )}

            
            {showStickFigure && (
              <div ref={stickFigureRef}>
                <StickFigurePlayer
                  data={stickFigureData}
                  onClose={() => setShowStickFigure(false)}
                />
              </div>
            )}

            {sessionId && data.length > 0 && events.length >= 2 && (
              <div ref={meanTrendsAnalyzerRef}>
                <MeanTrendsAnalyzer
                  sessionId={sessionId}
                  pattern={selectedPattern}
                  column={currentColumn}
                  events={events}
                />
              </div>
            )}

            </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 mt-16 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-5 text-center text-sm text-neutral-500">
          Graph Analyzer - Converted from MATLAB
        </div>
      </footer>
    </div>
  );
}
