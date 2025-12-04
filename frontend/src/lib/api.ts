import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_BASE,
});

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
  inflexion_value: number;
  inflexion_time: number;
  end_value: number;
  end_time: number;
  shift_start_to_inflexion: number;
  shift_inflexion_to_end: number;
  time_start_to_inflexion: number;
  time_inflexion_to_end: number;
  cycle_time: number;
  pattern: string;
  start_index: number;
  end_index: number;
}

export async function loadDefaultData(delimiter: string = ';'): Promise<UploadResponse> {
  const response = await api.get(`/api/load-default?delimiter=${encodeURIComponent(delimiter)}`);
  return response.data;
}

export async function uploadFile(file: File, delimiter: string = ';'): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/upload?delimiter=${encodeURIComponent(delimiter)}`, formData);
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
