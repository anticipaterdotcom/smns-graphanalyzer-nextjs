// In-browser implementation of the api.ts surface. Backed by LocalAnalyzer
// instances kept in a Map keyed by session id. This is what makes the PWA
// usable when there is no network and the Python backend is unreachable.
//
// The signatures mirror api.ts exactly so the switching layer (apiClient.ts)
// can dispatch to either backend without callers caring which is active.

import {
  LocalAnalyzer,
  parseCsv,
  computePatternEvents,
  Extremum as LocalExtremum,
  PatternEvent as LocalPatternEvent,
  MeanTrendExtendedResult,
} from './localAnalyzer';
import type {
  Extremum,
  PatternEvent,
  UploadResponse,
  PreviewResponse,
  AnalyzeResponse,
  AllColumnsExportResult,
  MeanTrendResponse,
  MeanTrendExtendedResponse,
  StickFigureData,
} from './api';

// ---------- in-memory session registry ----------

const sessions = new Map<string, LocalAnalyzer>();
const MAX_SESSIONS = 50;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createSession(analyzer: LocalAnalyzer): string {
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }
  const id = uuid();
  sessions.set(id, analyzer);
  return id;
}

function getSession(sessionId: string): LocalAnalyzer {
  const a = sessions.get(sessionId);
  if (!a) throw new HttpError(404, `Session ${sessionId} not found (local). Re-upload the CSV.`);
  return a;
}

// Mirrors the axios error shape just enough that the existing UI error paths
// (which read `err.response.status`, `err.response.data.detail`, etc.) keep
// rendering useful messages.
export class HttpError extends Error {
  response: { status: number; data: { detail: string } };
  config: { url: string };
  constructor(status: number, detail: string, url = '(local)') {
    super(detail);
    this.name = 'HttpError';
    this.response = { status, data: { detail } };
    this.config = { url };
  }
}

// ---------- helpers ----------

function toExtremum(e: LocalExtremum): Extremum {
  return { value: e.value, index: e.index, type: e.type };
}

function toLocalExtremum(e: Extremum): LocalExtremum {
  return { value: e.value, index: e.index, type: e.type };
}

function toPatternEvent(e: LocalPatternEvent): PatternEvent {
  return { ...e } as unknown as PatternEvent;
}

// ---------- file upload / preview / default ----------

export async function localPreviewFile(
  file: File,
  delimiter = ';',
  trimZeros = false,
): Promise<PreviewResponse> {
  const text = await file.text();
  const parsed = parseCsv(text, delimiter, trimZeros);
  return {
    total_rows: parsed.totalRows,
    total_columns: parsed.totalColumns,
    rows_after_trim: parsed.rowsAfterTrim,
    zero_rows_start: parsed.zeroRowsStart,
    zero_rows_end: parsed.zeroRowsEnd,
    preview: parsed.data.slice(0, 20),
  };
}

export async function localUploadFile(
  file: File,
  delimiter = ';',
  trimZeros = false,
): Promise<UploadResponse> {
  const text = await file.text();
  const parsed = parseCsv(text, delimiter, trimZeros);
  if (parsed.data.length === 0) throw new HttpError(400, 'CSV had no rows');
  const analyzer = new LocalAnalyzer(100.0);
  analyzer.loadCsv(parsed.data, false);
  const id = createSession(analyzer);
  return {
    session_id: id,
    rows: parsed.data.length,
    columns: parsed.totalColumns,
    padded_rows: analyzer.numRows,
  };
}

// Loading default data: in offline mode there is no canonical default file,
// but we keep the API for parity. Callers should prefer uploading.
export async function localLoadDefaultData(): Promise<UploadResponse> {
  throw new HttpError(404, 'Default CSV is not bundled with the offline build. Upload a file instead.');
}

// ---------- analysis ----------

export async function localAnalyzeData(
  sessionId: string,
  column: number,
  minDistance: number,
  frequency: number,
): Promise<AnalyzeResponse> {
  const a = getSession(sessionId);
  a.frequency = frequency;
  a.timePerFrame = 1.0 / frequency;
  const extrema = a.findExtrema(column, minDistance);
  return {
    extrema: extrema.map(toExtremum),
    count: extrema.length,
    column_data: a.columnSlice(column),
  };
}

export async function localAddExtremum(
  sessionId: string,
  index: number,
  extremumType: string = 'max',
  epsilon: number = 20,
): Promise<Extremum> {
  const a = getSession(sessionId);
  const e = a.addExtremum(index, epsilon, extremumType === 'min' ? 'min' : 'max');
  return toExtremum(e);
}

export async function localRemoveExtremum(
  sessionId: string,
  index: number,
  tolerance: number = 15,
): Promise<{ success: boolean }> {
  const a = getSession(sessionId);
  return { success: a.removeExtremum(index, tolerance) };
}

export async function localGetPatternEvents(
  sessionId: string,
  pattern: number[],
): Promise<{ events: PatternEvent[]; count: number }> {
  const a = getSession(sessionId);
  const p: [number, number, number] = [pattern[0], pattern[1], pattern[2]];
  const events = a.findPatternEvents(p);
  return { events: events.map(toPatternEvent), count: events.length };
}

export async function localGetPatternEventsFromExtrema(
  extrema: Extremum[],
  pattern: number[],
  frequency: number,
): Promise<{ events: PatternEvent[]; count: number }> {
  const tpf = frequency > 0 ? 1.0 / frequency : 0.01;
  const p: [number, number, number] = [pattern[0], pattern[1], pattern[2]];
  const events = computePatternEvents(extrema.map(toLocalExtremum), p, tpf);
  return { events: events.map(toPatternEvent), count: events.length };
}

export async function localGetColumnData(
  sessionId: string,
  column: number,
): Promise<{ data: number[]; length: number }> {
  const a = getSession(sessionId);
  const data = a.columnSlice(column);
  return { data, length: data.length };
}

export async function localGetExtrema(sessionId: string): Promise<{ extrema: Extremum[] }> {
  const a = getSession(sessionId);
  return { extrema: a.extrema.map(toExtremum) };
}

export async function localExportEvents(
  sessionId: string,
  pattern: number[],
): Promise<{ parameters: PatternEvent[] }> {
  const { events } = await localGetPatternEvents(sessionId, pattern);
  return { parameters: events };
}

// ---------- mean trend ----------

export async function localGetMeanTrend(
  sessionId: string,
  pattern: number[],
  column: number,
  targetLength?: number,
): Promise<MeanTrendResponse> {
  const a = getSession(sessionId);
  const p: [number, number, number] = [pattern[0], pattern[1], pattern[2]];
  const events = a.findPatternEvents(p);
  if (events.length === 0) throw new HttpError(400, `No events for pattern ${pattern} on column ${column} (local)`);
  const r = a.calculateMeanTrendExtended(events, column, targetLength, 'average', 'linear');
  return { mean: r.mean, std: r.std, length: r.target_length, event_count: r.event_count };
}

export async function localGetMeanTrendExtended(
  sessionId: string,
  pattern: number[],
  column: number,
  targetLength?: number,
  lengthMode: 'average' | 'percentage' = 'average',
  interpolationMethod: 'linear' | 'spline' = 'linear',
  cycleExtrema?: Extremum[],
  frequency?: number,
): Promise<MeanTrendExtendedResponse> {
  const a = getSession(sessionId);
  const p: [number, number, number] = [pattern[0], pattern[1], pattern[2]];

  let events: LocalPatternEvent[];
  if (cycleExtrema && cycleExtrema.length >= 3) {
    const freq = frequency ?? a.frequency;
    const tpf = freq > 0 ? 1.0 / freq : a.timePerFrame;
    events = computePatternEvents(cycleExtrema.map(toLocalExtremum), p, tpf);
  } else {
    events = a.findPatternEvents(p);
  }
  if (events.length === 0) {
    throw new HttpError(
      400,
      `No events for pattern ${pattern} on column ${column} (local, source=${cycleExtrema ? 'reference extrema' : 'main extrema'})`,
    );
  }
  const r: MeanTrendExtendedResult = a.calculateMeanTrendExtended(
    events, column, targetLength, lengthMode, interpolationMethod,
  );
  return {
    mean: r.mean,
    std: r.std,
    normalized_segments: r.normalized_segments,
    raw_segments: r.raw_segments,
    target_length: r.target_length,
    average_length: r.average_length,
    event_count: r.event_count,
    lengths: r.lengths,
  };
}

// ---------- multi-column export ----------

export async function localExportAllColumns(
  sessionId: string,
  pattern: number[],
  minDistance: number = 10,
  _frequency: number = 100,
): Promise<AllColumnsExportResult> {
  const a = getSession(sessionId);
  const results: AllColumnsExportResult['results'] = {};
  const p: [number, number, number] = [pattern[0], pattern[1], pattern[2]];
  for (let col = 0; col < a.numCols; col++) {
    const saved = [...a.extrema];
    const savedCol = a.currentColumn;
    try {
      a.findExtrema(col, minDistance);
      const events = a.findPatternEvents(p);
      results[String(col)] = {
        column: col,
        extrema_count: a.extrema.length,
        events: events.map(toPatternEvent),
      };
    } finally {
      a.extrema = saved;
      a.currentColumn = savedCol;
    }
  }
  return { columns: a.numCols, results };
}

// ---------- state / savepoints ----------

export async function localRestoreState(
  sessionId: string,
  extrema: Extremum[],
): Promise<{ success: boolean; count: number }> {
  const a = getSession(sessionId);
  a.extrema = extrema.map(toLocalExtremum).sort((x, y) => x.index - y.index);
  return { success: true, count: a.extrema.length };
}

export async function localLoadSavepoint(
  rawData: number[][],
  extrema: Extremum[],
  frequency: number = 100.0,
): Promise<{ session_id: string }> {
  const a = new LocalAnalyzer(frequency);
  a.loadCsv(rawData, false);
  a.extrema = extrema.map(toLocalExtremum).sort((x, y) => x.index - y.index);
  const id = createSession(a);
  return { session_id: id };
}

export async function localCheckSession(sessionId: string): Promise<boolean> {
  return sessions.has(sessionId);
}

export async function localGetSavepoint(
  sessionId: string,
): Promise<{ raw_data: number[][]; extrema: { value: number; index: number; type: number }[]; frequency: number }> {
  const a = getSession(sessionId);
  return {
    raw_data: a.rawData ?? [],
    extrema: a.extrema.map(e => ({ value: e.value, index: e.index, type: e.type })),
    frequency: a.frequency,
  };
}

// ---------- stick figure (column trace mode only) ----------

// We deliberately only implement the "trail of one column" mode here. The
// X/Y-pairs skeletal mode in the Python backend is rarely used and would
// nearly double the size of this file -- if someone needs it offline we can
// add it later.
export async function localGetStickFigureData(
  sessionId: string,
  _connections: number[][],
  _pointLabels?: string[],
  frameRate: number = 24,
  column?: number,
): Promise<StickFigureData> {
  const a = getSession(sessionId);
  if (column === undefined || column === null) {
    throw new HttpError(
      400,
      'Offline stick-figure mode currently supports only the single-column trace. Pass a column number.',
    );
  }
  if (!a.rawData) throw new HttpError(400, 'No data loaded');
  if (column < 0 || column >= a.numCols) {
    throw new HttpError(400, `Column ${column} out of range`);
  }

  // Detect actual signal bounds (skip leading/trailing all-zero frames).
  let actualStart = 0;
  while (actualStart < a.numRows && a.rawData[actualStart].every(v => v === 0)) actualStart++;
  let actualEnd = a.numRows;
  while (actualEnd > actualStart && a.rawData[actualEnd - 1].every(v => v === 0)) actualEnd--;

  const colData: number[] = [];
  for (let i = actualStart; i < actualEnd; i++) colData.push(a.rawData[i][column]);
  const numFrames = colData.length;
  if (numFrames === 0) throw new HttpError(400, 'Column has no non-zero data');
  let yMin = Infinity, yMax = -Infinity;
  for (const v of colData) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }

  const trailLength = 50;
  const frames: StickFigureData['frames'] = [];
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const start = Math.max(0, frameIdx - trailLength + 1);
    const points: StickFigureData['frames'][number]['points'] = [];
    for (let i = start; i <= frameIdx; i++) {
      points.push({
        x: i,
        y: colData[i],
        label: i === frameIdx ? `t=${i}` : '',
      });
    }
    frames.push({ points });
  }

  const connections: number[][] = [];
  for (let i = 0; i < trailLength - 1; i++) connections.push([i, i + 1]);

  return {
    frames,
    num_frames: numFrames,
    num_points: trailLength,
    bounds: { x_min: 0, x_max: numFrames, y_min: yMin, y_max: yMax },
    connections,
    frame_rate: frameRate,
  };
}
