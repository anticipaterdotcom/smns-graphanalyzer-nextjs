import axios from 'axios';
import * as Sentry from '@sentry/nextjs';

const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (isProduction ? '' : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_BASE,
});

export interface FailureTicket {
  id: string;
  timestamp: string;
  url?: string;
  status?: number;
  message: string;
  detail?: unknown;
}

const FAILURE_LOG_KEY = 'graph-analyzer-failures';
const MAX_FAILURES = 50;

export function logFailureTicket(ticket: Omit<FailureTicket, 'id' | 'timestamp'>): FailureTicket {
  const full: FailureTicket = {
    ...ticket,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(FAILURE_LOG_KEY);
      const list: FailureTicket[] = raw ? JSON.parse(raw) : [];
      list.unshift(full);
      localStorage.setItem(FAILURE_LOG_KEY, JSON.stringify(list.slice(0, MAX_FAILURES)));
    } catch { /* ignore */ }
  }
  // eslint-disable-next-line no-console
  console.warn('[failure-ticket]', full);
  return full;
}

export function getFailureTickets(): FailureTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAILURE_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

type SessionRecovery = () => Promise<string | null>;
let sessionRecovery: SessionRecovery | null = null;
let recoveryInFlight: Promise<string | null> | null = null;
export function registerSessionRecovery(fn: SessionRecovery | null) {
  sessionRecovery = fn;
  recoveryInFlight = null;
}

async function runRecoveryOnce(): Promise<string | null> {
  if (!sessionRecovery) return null;
  if (!recoveryInFlight) {
    recoveryInFlight = (async () => {
      try { return await sessionRecovery!(); }
      finally {
        setTimeout(() => { recoveryInFlight = null; }, 2000);
      }
    })();
  }
  return recoveryInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;
    const detail = error?.response?.data?.detail ?? error?.response?.data;

    const isSessionMissing = status === 404 && typeof detail === 'string' && /session not found/i.test(detail);
    const cfg = error?.config;
    if (isSessionMissing && sessionRecovery && cfg && !cfg.__sessionRetried) {
      try {
        const newSid = await runRecoveryOnce();
        if (newSid) {
          cfg.__sessionRetried = true;
          if (cfg.data) {
            try {
              const body = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
              if (body && typeof body === 'object' && 'session_id' in body) {
                body.session_id = newSid;
                cfg.data = JSON.stringify(body);
              }
            } catch { /* ignore */ }
          }
          if (cfg.url) {
            cfg.url = cfg.url.replace(/\/api\/session\/[0-9a-f-]+/i, `/api/session/${newSid}`);
          }
          return api.request(cfg);
        }
      } catch { /* fall through to normal error handling */ }
    }

    const ticket = logFailureTicket({
      url,
      status,
      message: error?.message ?? 'Request failed',
      detail,
    });
    try {
      Sentry.captureException(error, {
        tags: { url: ticket.url ?? 'unknown', status: String(ticket.status ?? 'unknown') },
        extra: { ticket },
      });
    } catch { /* ignore */ }
    return Promise.reject(error);
  }
);

export interface Extremum {
  value: number;
  index: number;
  type: number;
}

export interface UploadResponse {
  session_id: string;
  rows: number;
  columns: number;
  padded_rows: number;
}

export interface AnalyzeResponse {
  extrema: Extremum[];
  count: number;
  column_data: number[];
}

export interface PatternEvent {
  start_value: number;
  start_time: number;
  start_index: number;
  inflexion_value: number;
  inflexion_time: number;
  inflexion_index: number;
  end_value: number;
  end_time: number;
  end_index: number;
  shift_start_to_inflexion: number;
  shift_inflexion_to_end: number;
  time_start_to_inflexion: number;
  time_inflexion_to_end: number;
  cycle_time: number;
  intercycle_time: number | null;
  pattern_type: string;
}

export async function loadDefaultData(delimiter: string = ';', trimZeros: boolean = false): Promise<UploadResponse> {
  const params = new URLSearchParams({ delimiter, trim_zeros: String(trimZeros) });
  const response = await api.get(`/api/load-default?${params}`);
  return response.data;
}

export interface PreviewResponse {
  total_rows: number;
  total_columns: number;
  rows_after_trim: number;
  zero_rows_start: number;
  zero_rows_end: number;
  preview: number[][];
}

export async function previewFile(file: File, delimiter: string = ';', trimZeros: boolean = false): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams({ delimiter, trim_zeros: String(trimZeros) });
  const response = await api.post(`/api/preview?${params}`, formData);
  return response.data;
}

export async function uploadFile(file: File, delimiter: string = ';', trimZeros: boolean = false): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const params = new URLSearchParams({ delimiter, trim_zeros: String(trimZeros) });
  const response = await api.post(`/api/upload?${params}`, formData);
  return response.data;
}

export async function analyzeData(
  sessionId: string,
  column: number,
  minDistance: number,
  frequency: number
): Promise<AnalyzeResponse> {
  const response = await api.post('/api/analyze', {
    session_id: sessionId,
    column,
    min_distance: minDistance,
    frequency,
  });
  return response.data;
}

export async function addExtremum(
  sessionId: string,
  index: number,
  extremumType: string = 'max',
  epsilon: number = 20
): Promise<Extremum> {
  const response = await api.post('/api/extremum/add', {
    session_id: sessionId,
    index,
    extremum_type: extremumType,
    epsilon,
  });
  return response.data;
}

export async function removeExtremum(
  sessionId: string,
  index: number,
  tolerance: number = 15
): Promise<{ success: boolean }> {
  const response = await api.post('/api/extremum/remove', {
    session_id: sessionId,
    index,
    tolerance,
  });
  return response.data;
}

export async function getPatternEvents(
  sessionId: string,
  pattern: number[]
): Promise<{ events: PatternEvent[]; count: number }> {
  const response = await api.post('/api/pattern/events', {
    session_id: sessionId,
    pattern,
  });
  return response.data;
}

export async function getPatternEventsFromExtrema(
  extrema: Extremum[],
  pattern: number[],
  frequency: number
): Promise<{ events: PatternEvent[]; count: number }> {
  const response = await api.post('/api/pattern/events-from-extrema', {
    extrema,
    pattern,
    frequency,
  });
  return response.data;
}

export async function getColumnData(
  sessionId: string,
  column: number
): Promise<{ data: number[]; length: number }> {
  const response = await api.post('/api/data/column', {
    session_id: sessionId,
    column,
  });
  return response.data;
}

export async function getExtrema(sessionId: string): Promise<{ extrema: Extremum[] }> {
  const response = await api.get(`/api/session/${sessionId}/extrema`);
  return response.data;
}

export async function exportEvents(
  sessionId: string,
  pattern: number[]
): Promise<{ parameters: PatternEvent[] }> {
  const response = await api.post('/api/export/events', {
    session_id: sessionId,
    pattern,
  });
  return response.data;
}

export interface StickFigurePoint {
  x: number;
  y: number;
  label: string;
}

export interface StickFigureFrame {
  points: StickFigurePoint[];
}

export interface StickFigureData {
  frames: StickFigureFrame[];
  num_frames: number;
  num_points: number;
  bounds: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  connections: number[][];
  frame_rate: number;
}

export async function getStickFigureData(
  sessionId: string,
  connections: number[][],
  pointLabels?: string[],
  frameRate: number = 24,
  column?: number
): Promise<StickFigureData> {
  const response = await api.post('/api/stick-figure/data', {
    session_id: sessionId,
    connections,
    point_labels: pointLabels,
    frame_rate: frameRate,
    column,
  });
  return response.data;
}

export interface MeanTrendResponse {
  mean: number[];
  std: number[];
  length: number;
  event_count: number;
}

export interface MeanTrendExtendedResponse {
  mean: number[];
  std: number[];
  normalized_segments: number[][];
  raw_segments: number[][];
  target_length: number;
  average_length: number;
  event_count: number;
  lengths: number[];
}

export async function getMeanTrend(
  sessionId: string,
  pattern: number[],
  column: number,
  targetLength?: number
): Promise<MeanTrendResponse> {
  const response = await api.post('/api/mean-trend', {
    session_id: sessionId,
    pattern,
    column,
    target_length: targetLength,
  });
  return response.data;
}

export async function getMeanTrendExtended(
  sessionId: string,
  pattern: number[],
  column: number,
  targetLength?: number,
  lengthMode: 'average' | 'percentage' = 'average',
  interpolationMethod: 'linear' | 'spline' = 'linear'
): Promise<MeanTrendExtendedResponse> {
  const response = await api.post('/api/mean-trend-extended', {
    session_id: sessionId,
    pattern,
    column,
    target_length: targetLength,
    length_mode: lengthMode,
    interpolation_method: interpolationMethod,
  });
  return response.data;
}

export interface AllColumnsExportResult {
  columns: number;
  results: Record<string, {
    column: number;
    extrema_count: number;
    events: PatternEvent[];
  }>;
}

export async function exportAllColumns(
  sessionId: string,
  pattern: number[],
  minDistance: number = 10,
  frequency: number = 100
): Promise<AllColumnsExportResult> {
  const response = await api.post('/api/export/all-columns', {
    session_id: sessionId,
    pattern,
    min_distance: minDistance,
    frequency,
  });
  return response.data;
}

export async function restoreState(
  sessionId: string,
  extrema: Extremum[]
): Promise<{ success: boolean; count: number }> {
  const response = await api.post('/api/state/restore', {
    session_id: sessionId,
    extrema: extrema.map(e => ({
      value: e.value,
      index: e.index,
      extremum_type: e.type,
    })),
  });
  return response.data;
}

export async function loadSavepoint(
  rawData: number[][],
  extrema: Extremum[],
  frequency: number = 100.0
): Promise<{ session_id: string }> {
  const response = await api.post('/api/savepoint/load', {
    raw_data: rawData,
    extrema: extrema.map(e => ({
      value: e.value,
      index: e.index,
      type: e.type,
    })),
    frequency,
  });
  return response.data;
}

export async function checkSession(sessionId: string): Promise<boolean> {
  try {
    await api.get(`/api/session/${sessionId}`);
    return true;
  } catch {
    return false;
  }
}

export async function getSavepoint(
  sessionId: string
): Promise<{ raw_data: number[][]; extrema: { value: number; index: number; type: number }[]; frequency: number }> {
  const response = await api.post('/api/savepoint/save', {
    session_id: sessionId,
  });
  return response.data;
}
