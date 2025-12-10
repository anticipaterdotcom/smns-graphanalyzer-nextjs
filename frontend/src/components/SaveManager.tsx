'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, Upload, History, Download, Trash2, X, Clock } from 'lucide-react';
import {
  SaveState,
  VersionHistoryEntry,
  downloadSaveFile,
  loadSaveFile,
  getVersionHistory,
  addToVersionHistory,
  removeFromVersionHistory,
  clearVersionHistory,
  createSaveState,
} from '@/lib/saveManager';
import { Extremum, PatternEvent } from '@/lib/api';

interface SaveManagerProps {
  sessionId: string | null;
  currentColumn: number;
  selectedPattern: number[];
  extrema: Extremum[];
  events: PatternEvent[];
  data: number[];
  columns: number;
  onLoadState: (state: SaveState) => void;
  disabled?: boolean;
}

export default function SaveManager({
  sessionId,
  currentColumn,
  selectedPattern,
  extrema,
  events,
  data,
  columns,
  onLoadState,
  disabled,
}: SaveManagerProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VersionHistoryEntry[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(getVersionHistory());
  }, [showHistory]);

  const handleSave = (download: boolean = false) => {
    const state = createSaveState(
      sessionId,
      currentColumn,
      selectedPattern,
      extrema,
      events,
      data,
      columns,
      saveName || undefined
    );

    if (download) {
      downloadSaveFile(state);
    }

    addToVersionHistory(state);
    setHistory(getVersionHistory());
    setShowSaveDialog(false);
    setSaveName('');
  };

  const handleQuickSave = () => {
    const state = createSaveState(
      sessionId,
      currentColumn,
      selectedPattern,
      extrema,
      events,
      data,
      columns,
      `Auto-save ${new Date().toLocaleTimeString()}`
    );
    addToVersionHistory(state);
    setHistory(getVersionHistory());
  };

  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const state = await loadSaveFile(file);
      onLoadState(state);
    } catch (err) {
      alert('Failed to load save file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadFromHistory = (entry: VersionHistoryEntry) => {
    onLoadState(entry.state);
    setShowHistory(false);
  };

  const handleDeleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromVersionHistory(id);
    setHistory(getVersionHistory());
  };

  const handleClearHistory = () => {
    if (confirm('Clear all version history?')) {
      clearVersionHistory();
      setHistory([]);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={handleQuickSave}
          disabled={disabled || data.length === 0}
          className="p-2 bg-neutral-800 border border-white/10 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
          title="Quick Save"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowSaveDialog(true)}
          disabled={disabled || data.length === 0}
          className="p-2 bg-neutral-800 border border-white/10 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
          title="Save & Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 bg-neutral-800 border border-white/10 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
          title="Load Save File"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-2 bg-neutral-800 border border-white/10 text-neutral-300 rounded-lg hover:bg-neutral-700 transition-colors relative"
          title="Version History"
        >
          <History className="w-4 h-4" />
          {history.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] rounded-full flex items-center justify-center">
              {history.length}
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadFile}
          className="hidden"
        />
      </div>

      {showSaveDialog && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Save Analysis</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter save name (optional)"
              className="w-full px-4 py-3 bg-neutral-800 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-700 text-white rounded-xl hover:bg-neutral-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save to History
              </button>
              <button
                onClick={() => handleSave(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-500 hover:to-pink-500 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download File
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showHistory && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Version History</h3>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-neutral-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">
                  No saved versions yet
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => handleLoadFromHistory(entry)}
                    className="flex items-center justify-between p-3 bg-neutral-800/50 border border-white/5 rounded-xl hover:bg-neutral-800 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-neutral-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{entry.name}</p>
                        <p className="text-xs text-neutral-500">{formatDate(entry.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">
                        {entry.state.extrema.length} extrema
                      </span>
                      <button
                        onClick={(e) => handleDeleteEntry(entry.id, e)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <p className="text-xs text-neutral-500 mt-4 text-center">
              Click on a version to restore it
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
