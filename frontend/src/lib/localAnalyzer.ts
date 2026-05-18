// Browser-side port of backend/analyzer.py. Keeps the app working without
// the Python backend so the PWA stays usable offline. The signatures intentionally
// mirror analyzer.py so swapping between local/remote modes is a one-line change
// in the api layer.

export interface Extremum {
  value: number;
  index: number;
  type: number; // 1 = max, 0 = min
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
  pattern_type: 'LHL' | 'HLH';
}

export interface MeanTrendExtendedResult {
  mean: number[];
  std: number[];
  normalized_segments: number[][];
  raw_segments: number[][];
  target_length: number;
  average_length: number;
  event_count: number;
  lengths: number[];
}

// ---------- numerical helpers ----------

function mean(arr: ArrayLike<number>): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function std(arr: ArrayLike<number>): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  let v = 0;
  for (let i = 0; i < arr.length; i++) v += (arr[i] - m) * (arr[i] - m);
  return Math.sqrt(v / arr.length);
}

function linspace(start: number, stop: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [start];
  const step = (stop - start) / (n - 1);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = start + step * i;
  return out;
}

// scipy.signal.find_peaks-equivalent: returns indices of local maxima where
// each peak is separated by at least `distance` samples. We mirror scipy's
// behaviour: a peak is strictly higher than its immediate neighbours, with
// plateau handling that picks the centre of a flat top.
function findPeaks(signal: ArrayLike<number>, distance: number): number[] {
  const n = signal.length;
  if (n < 3) return [];
  const candidates: number[] = [];
  let i = 1;
  while (i < n - 1) {
    if (signal[i] > signal[i - 1]) {
      // Walk forward across a plateau of equal values.
      let j = i;
      while (j + 1 < n && signal[j + 1] === signal[i]) j++;
      if (j < n - 1 && signal[j + 1] < signal[j]) {
        // Strict peak (possibly flat-topped). Record the centre.
        candidates.push(Math.floor((i + j) / 2));
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  if (candidates.length === 0 || distance <= 1) return candidates;

  // Greedy filter: sort by height descending, keep peaks that aren't within
  // `distance` of an already-kept one. scipy uses the same idea.
  const sorted = [...candidates].sort((a, b) => signal[b] - signal[a]);
  const keep = new Set<number>();
  const taken: number[] = [];
  for (const idx of sorted) {
    let tooClose = false;
    for (const t of taken) {
      if (Math.abs(idx - t) < distance) { tooClose = true; break; }
    }
    if (!tooClose) {
      keep.add(idx);
      taken.push(idx);
    }
  }
  return candidates.filter(i => keep.has(i));
}

// np.interp equivalent for monotonically increasing x_old.
function linearInterp(x_new: number[], x_old: number[], y_old: number[]): number[] {
  const out = new Array<number>(x_new.length);
  let j = 0;
  for (let i = 0; i < x_new.length; i++) {
    const x = x_new[i];
    while (j < x_old.length - 1 && x_old[j + 1] < x) j++;
    if (x <= x_old[0]) { out[i] = y_old[0]; continue; }
    if (x >= x_old[x_old.length - 1]) { out[i] = y_old[y_old.length - 1]; continue; }
    const x0 = x_old[j];
    const x1 = x_old[j + 1];
    const t = (x - x0) / (x1 - x0);
    out[i] = y_old[j] + t * (y_old[j + 1] - y_old[j]);
  }
  return out;
}

// Natural cubic spline interpolation. Mirrors scipy.interpolate.interp1d
// (kind='cubic') closely enough for our smoothing use-case: we extrapolate
// by clamping to the boundary slopes rather than letting the spline run wild.
function cubicSplineInterp(x_new: number[], x_old: number[], y_old: number[]): number[] {
  const n = x_old.length;
  if (n < 4) return linearInterp(x_new, x_old, y_old);

  // Build the tridiagonal system for the second derivatives M.
  const h = new Array<number>(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = x_old[i + 1] - x_old[i];

  const alpha = new Array<number>(n);
  alpha[0] = 0;
  alpha[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (y_old[i + 1] - y_old[i]) - (3 / h[i - 1]) * (y_old[i] - y_old[i - 1]);
  }

  const l = new Array<number>(n);
  const mu = new Array<number>(n);
  const z = new Array<number>(n);
  l[0] = 1; mu[0] = 0; z[0] = 0;
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (x_old[i + 1] - x_old[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  l[n - 1] = 1; z[n - 1] = 0;

  const M = new Array<number>(n);
  M[n - 1] = 0;
  for (let j = n - 2; j >= 0; j--) M[j] = z[j] - mu[j] * M[j + 1];

  // Evaluate.
  const out = new Array<number>(x_new.length);
  let j = 0;
  for (let i = 0; i < x_new.length; i++) {
    const x = x_new[i];
    while (j < n - 2 && x_old[j + 1] < x) j++;
    if (j > n - 2) j = n - 2;
    const dx = x - x_old[j];
    const hj = h[j];
    const a = y_old[j];
    const b = (y_old[j + 1] - y_old[j]) / hj - (hj / 3) * (2 * M[j] + M[j + 1]);
    const c = M[j];
    const d = (M[j + 1] - M[j]) / (3 * hj);
    out[i] = a + b * dx + c * dx * dx + d * dx * dx * dx;
  }
  return out;
}

// Savitzky-Golay filter, fixed polyorder=3. Same role as scipy.signal.savgol_filter
// in analyzer._smooth_for_spline: smooth the cubic-spline output so spline mode
// visibly differs from linear. Implemented via Gram polynomial weights to avoid
// the full matrix inversion (closed-form for polyorder=3 at the centre point).
export function savgolFilter(values: number[], windowOverride?: number): number[] {
  const n = values.length;
  if (n < 7) return values.slice();
  let window = windowOverride ?? Math.max(5, (Math.round(n * 0.15) | 1));
  if (window >= n) window = n - 1 - ((n - 1) % 2 === 0 ? 1 : 0);
  if (window < 5 || window % 2 === 0) return values.slice();
  const half = (window - 1) / 2;
  const polyorder = 3;
  // Compute Gram polynomial weights at offset 0 (the centre tap).
  // Reference: P. A. Gorry, "General Least-Squares Smoothing and
  // Differentiation by the Convolution (Savitzky-Golay) Method".
  const weights = computeSavgolWeights(half, polyorder);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (i < half || i >= n - half) {
      out[i] = values[i]; // leave edges untouched
      continue;
    }
    let s = 0;
    for (let k = -half; k <= half; k++) s += weights[k + half] * values[i + k];
    out[i] = s;
  }
  return out;
}

function computeSavgolWeights(half: number, polyorder: number): number[] {
  // Build the Vandermonde-like design matrix A[i][j] = i^j for i in [-half..half].
  const m = 2 * half + 1;
  const A: number[][] = [];
  for (let i = -half; i <= half; i++) {
    const row: number[] = [];
    for (let j = 0; j <= polyorder; j++) row.push(Math.pow(i, j));
    A.push(row);
  }
  // We want c = (A^T A)^{-1} A^T e0, then weights = A c is at i (we want centre).
  // For centre weights only: w = A_centre^T (A^T A)^{-1} A^T.
  // Simpler: solve normal equations for the smoothed centre value as a linear
  // combination of inputs by solving (A^T A) p = A^T e_centre.
  const At = transpose(A);
  const AtA = matmul(At, A);
  const e = new Array<number>(m).fill(0);
  e[half] = 1;
  const AtE = matvec(At, e);
  const p = solveLinearSystem(AtA, AtE);
  // weights[k] = sum_j A[k][j] * p[j] gives the centre-point smoothing weights.
  const weights = new Array<number>(m);
  for (let k = 0; k < m; k++) {
    let s = 0;
    for (let j = 0; j <= polyorder; j++) s += A[k][j] * p[j];
    weights[k] = s;
  }
  return weights;
}

function transpose(M: number[][]): number[][] {
  const r = M.length, c = M[0].length;
  const T: number[][] = [];
  for (let j = 0; j < c; j++) {
    const row = new Array<number>(r);
    for (let i = 0; i < r; i++) row[i] = M[i][j];
    T.push(row);
  }
  return T;
}

function matmul(A: number[][], B: number[][]): number[][] {
  const r = A.length, c = B[0].length, k = B.length;
  const out: number[][] = [];
  for (let i = 0; i < r; i++) {
    const row = new Array<number>(c).fill(0);
    for (let j = 0; j < c; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += A[i][p] * B[p][j];
      row[j] = s;
    }
    out.push(row);
  }
  return out;
}

function matvec(A: number[][], v: number[]): number[] {
  const r = A.length;
  const out = new Array<number>(r);
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += A[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

// Gaussian elimination with partial pivoting. Small systems only (polyorder+1).
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[pivot][i])) pivot = k;
    }
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];
    const div = M[i][i];
    if (Math.abs(div) < 1e-12) throw new Error('Singular matrix in savgol weights');
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / div;
      for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j];
    }
  }
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

// ---------- compute_pattern_events ----------

export function computePatternEvents(
  extrema: Extremum[],
  pattern: [number, number, number],
  timePerFrame: number,
): PatternEvent[] {
  const sorted = [...extrema].sort((a, b) => a.index - b.index);
  const events: PatternEvent[] = [];
  for (let i = 0; i < sorted.length - 2; i++) {
    if (
      sorted[i].type === pattern[0] &&
      sorted[i + 1].type === pattern[1] &&
      sorted[i + 2].type === pattern[2]
    ) {
      events.push({
        start_value: sorted[i].value,
        start_time: sorted[i].index * timePerFrame,
        start_index: sorted[i].index,
        inflexion_value: sorted[i + 1].value,
        inflexion_time: sorted[i + 1].index * timePerFrame,
        inflexion_index: sorted[i + 1].index,
        end_value: sorted[i + 2].value,
        end_time: sorted[i + 2].index * timePerFrame,
        end_index: sorted[i + 2].index,
        shift_start_to_inflexion: Math.abs(sorted[i].value - sorted[i + 1].value),
        shift_inflexion_to_end: Math.abs(sorted[i + 2].value - sorted[i + 1].value),
        time_start_to_inflexion: (sorted[i + 1].index - sorted[i].index) * timePerFrame,
        time_inflexion_to_end: (sorted[i + 2].index - sorted[i + 1].index) * timePerFrame,
        cycle_time: (sorted[i + 2].index - sorted[i].index) * timePerFrame,
        intercycle_time: null,
        pattern_type: pattern[0] === 0 ? 'LHL' : 'HLH',
      });
    }
  }
  // Fill intercycle_time -- gap between consecutive cycles.
  for (let i = 0; i < events.length - 1; i++) {
    events[i].intercycle_time = (events[i + 1].start_index - events[i].end_index) * timePerFrame;
  }
  return events;
}

// ---------- LocalAnalyzer ----------

export class LocalAnalyzer {
  rawData: number[][] | null = null; // shape: [rows][cols]
  extrema: Extremum[] = [];
  currentColumn = 0;
  frequency: number;
  timePerFrame: number;

  constructor(frequency = 100.0) {
    this.frequency = frequency;
    this.timePerFrame = 1.0 / frequency;
  }

  loadCsv(data: number[][], addPadding = false): void {
    if (!addPadding) {
      this.rawData = data;
      return;
    }
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    const padded: number[][] = [];
    for (let i = 0; i < rows + 200; i++) padded.push(new Array<number>(cols).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) padded[100 + i][j] = data[i][j];
    }
    this.rawData = padded;
  }

  get numRows(): number { return this.rawData?.length ?? 0; }
  get numCols(): number { return this.rawData?.[0]?.length ?? 0; }

  columnSlice(col: number): number[] {
    if (!this.rawData) return [];
    const out = new Array<number>(this.rawData.length);
    for (let i = 0; i < this.rawData.length; i++) out[i] = this.rawData[i][col];
    return out;
  }

  findExtrema(column: number, minDistance = 10): Extremum[] {
    if (!this.rawData) throw new Error('No data loaded');
    this.currentColumn = column;
    const signal = this.columnSlice(column);
    const neg = signal.map(v => -v);
    const maxIdx = findPeaks(signal, minDistance);
    const minIdx = findPeaks(neg, minDistance);
    const maxima: Extremum[] = maxIdx.map(i => ({ value: signal[i], index: i, type: 1 }));
    const minima: Extremum[] = minIdx.map(i => ({ value: signal[i], index: i, type: 0 }));
    this.extrema = [...maxima, ...minima].sort((a, b) => a.index - b.index);
    return this.extrema;
  }

  addExtremum(index: number, epsilon = 20, extremumType: 'max' | 'min' = 'max'): Extremum {
    if (!this.rawData) throw new Error('No data loaded');
    const col = this.currentColumn;
    let actualIdx: number;
    if (epsilon === 0) {
      actualIdx = Math.max(0, Math.min(index, this.rawData.length - 1));
    } else {
      const start = Math.max(0, index - epsilon);
      const end = Math.min(this.rawData.length, index + epsilon + 1);
      const window = [];
      for (let i = start; i < end; i++) window.push(this.rawData[i][col]);
      const cmp = extremumType === 'max'
        ? (best: number, v: number, i: number, arr: number[]) => v > arr[best] ? i : best
        : (best: number, v: number, i: number, arr: number[]) => v < arr[best] ? i : best;
      let bestLocal = 0;
      for (let i = 1; i < window.length; i++) bestLocal = cmp(bestLocal, window[i], i, window);
      actualIdx = start + bestLocal;
    }
    const newExt: Extremum = {
      value: this.rawData[actualIdx][col],
      index: actualIdx,
      type: extremumType === 'max' ? 1 : 0,
    };
    this.extrema = [...this.extrema, newExt].sort((a, b) => a.index - b.index);
    this.removeDuplicates();
    return newExt;
  }

  removeExtremum(index: number, tolerance = 15): boolean {
    for (let i = 0; i < this.extrema.length; i++) {
      if (Math.abs(this.extrema[i].index - index) < tolerance) {
        this.extrema.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  private removeDuplicates(): void {
    if (this.extrema.length < 2) return;
    const unique: Extremum[] = [this.extrema[0]];
    for (let i = 1; i < this.extrema.length; i++) {
      if (this.extrema[i].index !== unique[unique.length - 1].index) unique.push(this.extrema[i]);
    }
    this.extrema = unique;
  }

  findPatternEvents(pattern: [number, number, number]): PatternEvent[] {
    return computePatternEvents(this.extrema, pattern, this.timePerFrame);
  }

  calculateMeanTrendExtended(
    events: PatternEvent[],
    column: number,
    targetLength?: number,
    lengthMode: 'average' | 'percentage' = 'average',
    interpolationMethod: 'linear' | 'spline' = 'linear',
    smooth: boolean = false,
  ): MeanTrendExtendedResult {
    if (!this.rawData || events.length === 0) throw new Error('No data or events');

    const rawSegments: number[][] = events.map(e => {
      const seg: number[] = [];
      for (let i = e.start_index; i <= e.end_index; i++) seg.push(this.rawData![i][column]);
      return seg;
    });
    const lengths = rawSegments.map(s => s.length);
    const avgLength = Math.round(mean(lengths));
    const finalLength =
      lengthMode === 'percentage' ? 100 :
      targetLength ?? avgLength;

    const normalizedSegments: number[][] = rawSegments.map(segment => {
      const xOld = linspace(0, 1, segment.length);
      const xNew = linspace(0, 1, finalLength);
      if (interpolationMethod === 'spline' && segment.length >= 4) {
        try {
          let resampled = cubicSplineInterp(xNew, xOld, segment);
          if (smooth) resampled = savgolFilter(resampled);
          return resampled;
        } catch {
          return linearInterp(xNew, xOld, segment);
        }
      }
      return linearInterp(xNew, xOld, segment);
    });

    const meanArr = new Array<number>(finalLength);
    const stdArr = new Array<number>(finalLength);
    for (let i = 0; i < finalLength; i++) {
      const col: number[] = normalizedSegments.map(s => s[i]);
      meanArr[i] = mean(col);
      stdArr[i] = std(col);
    }

    return {
      mean: meanArr,
      std: stdArr,
      normalized_segments: normalizedSegments,
      raw_segments: rawSegments,
      target_length: finalLength,
      average_length: avgLength,
      event_count: events.length,
      lengths,
    };
  }

  toDict() {
    return {
      extrema: this.extrema.map(e => ({ value: e.value, index: e.index, type: e.type })),
      frequency: this.frequency,
      time_per_frame: this.timePerFrame,
      data_shape: this.rawData ? [this.rawData.length, this.numCols] : null,
    };
  }
}

// ---------- CSV parsing ----------

export interface ParsedCsv {
  data: number[][];           // rows × cols
  totalRows: number;
  totalColumns: number;
  rowsAfterTrim: number;
  zeroRowsStart: number;
  zeroRowsEnd: number;
}

export function parseCsv(text: string, delimiter = ';', trimZeros = false): ParsedCsv {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return { data: [], totalRows: 0, totalColumns: 0, rowsAfterTrim: 0, zeroRowsStart: 0, zeroRowsEnd: 0 };
  }
  const rows: number[][] = [];
  const cols = lines[0].split(delimiter).length;
  for (const line of lines) {
    const parts = line.split(delimiter);
    const row: number[] = new Array(cols).fill(0);
    for (let i = 0; i < Math.min(parts.length, cols); i++) {
      const v = parseFloat(parts[i].trim());
      row[i] = Number.isFinite(v) ? v : 0;
    }
    rows.push(row);
  }

  let zeroRowsStart = 0;
  let zeroRowsEnd = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].every(v => v === 0)) zeroRowsStart++;
    else break;
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].every(v => v === 0)) zeroRowsEnd++;
    else break;
  }

  let trimmed = rows;
  if (trimZeros) {
    let first = 0;
    while (first < rows.length && rows[first].every(v => v === 0)) first++;
    let last = rows.length - 1;
    while (last > first && rows[last].every(v => v === 0)) last--;
    trimmed = rows.slice(first, last + 1);
  }

  return {
    data: trimmed,
    totalRows: rows.length,
    totalColumns: cols,
    rowsAfterTrim: trimmed.length,
    zeroRowsStart,
    zeroRowsEnd,
  };
}
