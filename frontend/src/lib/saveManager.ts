import { Extremum, PatternEvent } from './api';

export interface SaveState {
  version: string;
  timestamp: string;
  name: string;
  sessionId: string | null;
  currentColumn: number;
  selectedPattern: number[];
  extrema: Extremum[];
  events: PatternEvent[];
  data: number[];
  columns: number;
  frequency?: number;
  minDistance?: number;
}

export interface VersionHistoryEntry {
  id: string;
  name: string;
  timestamp: string;
  state: SaveState;
}

const STORAGE_KEY = 'graph-analyzer-history';
const MAX_HISTORY_ENTRIES = 20;
const CURRENT_VERSION = '1.0.0';

export function createSaveState(
  sessionId: string | null,
  currentColumn: number,
  selectedPattern: number[],
  extrema: Extremum[],
  events: PatternEvent[],
  data: number[],
  columns: number,
  name?: string
): SaveState {
  return {
    version: CURRENT_VERSION,
    timestamp: new Date().toISOString(),
    name: name || `Save ${new Date().toLocaleString()}`,
    sessionId,
    currentColumn,
    selectedPattern,
    extrema,
    events,
    data,
    columns,
  };
}

export function downloadSaveFile(state: SaveState): void {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `graph-analyzer-${state.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadSaveFile(file: File): Promise<SaveState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target?.result as string) as SaveState;
        if (!state.version || !state.extrema || !state.data) {
          throw new Error('Invalid save file format');
        }
        resolve(state);
      } catch (err) {
        reject(new Error('Failed to parse save file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function getVersionHistory(): VersionHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToVersionHistory(state: SaveState): VersionHistoryEntry {
  const history = getVersionHistory();
  const entry: VersionHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: state.name,
    timestamp: state.timestamp,
    state,
  };

  history.unshift(entry);
  if (history.length > MAX_HISTORY_ENTRIES) {
    history.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return entry;
}

export function removeFromVersionHistory(id: string): void {
  const history = getVersionHistory().filter((entry) => entry.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearVersionHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getHistoryEntry(id: string): VersionHistoryEntry | undefined {
  return getVersionHistory().find((entry) => entry.id === id);
}
