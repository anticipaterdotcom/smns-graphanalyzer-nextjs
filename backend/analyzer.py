"""
Graph Analyzer - Core analysis module
Converted from MATLAB Graph_Analyzer_v2025_03_08.m
"""
import numpy as np
from scipy.signal import find_peaks
from typing import List, Tuple, Optional
import json
from dataclasses import dataclass


@dataclass
class Extremum:
    value: float
    index: int
    extremum_type: int  # 1 = max, 0 = min


@dataclass
class AnalysisResult:
    extrema: List[Extremum]
    raw_data: np.ndarray
    column: int
    frequency: float
    time_per_frame: float


class GraphAnalyzer:
    def __init__(self, frequency: float = 100.0):
        self.frequency = frequency
        self.time_per_frame = 1.0 / frequency
        self.raw_data: Optional[np.ndarray] = None
        self.extrema: List[Extremum] = []
        self.current_column: int = 0
    
    def load_csv(self, data: np.ndarray, add_padding: bool = True) -> None:
        if add_padding:
            rows, cols = data.shape
            padded = np.zeros((rows + 200, cols))
            padded[100:100+rows, :] = data
            self.raw_data = padded
        else:
            self.raw_data = data
    
    def find_extrema(self, column: int, min_distance: int = 10) -> List[Extremum]:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        
        self.current_column = column
        signal = self.raw_data[:, column]
        
        maxima_indices, _ = find_peaks(signal, distance=min_distance)
        maxima = [Extremum(value=signal[i], index=int(i), extremum_type=1) for i in maxima_indices]
        
        minima_indices, _ = find_peaks(-signal, distance=min_distance)
        minima = [Extremum(value=signal[i], index=int(i), extremum_type=0) for i in minima_indices]
        
        self.extrema = sorted(maxima + minima, key=lambda x: x.index)
        return self.extrema
    
    def add_extremum(self, index: int, epsilon: int = 20, extremum_type: str = 'max') -> Extremum:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        
        col = self.current_column
        start = max(0, index - epsilon)
        end = min(len(self.raw_data), index + epsilon)
        window = self.raw_data[start:end, col]
        
        if extremum_type == 'max':
            local_idx = np.argmax(window)
        else:
            local_idx = np.argmin(window)
        
        actual_idx = start + local_idx
        new_extremum = Extremum(
            value=float(self.raw_data[actual_idx, col]),
            index=int(actual_idx),
            extremum_type=1 if extremum_type == 'max' else 0
        )
        
        self.extrema.append(new_extremum)
        self.extrema = sorted(self.extrema, key=lambda x: x.index)
        self._remove_duplicates()
        return new_extremum
    
    def remove_extremum(self, index: int, tolerance: int = 15) -> bool:
        for i, ext in enumerate(self.extrema):
            if abs(ext.index - index) < tolerance:
                self.extrema.pop(i)
                return True
        return False
    
    def _remove_duplicates(self) -> None:
        if len(self.extrema) < 2:
            return
        unique = [self.extrema[0]]
        for ext in self.extrema[1:]:
            if ext.index != unique[-1].index:
                unique.append(ext)
        self.extrema = unique
    
    def find_pattern_events(self, pattern: Tuple[int, int, int]) -> List[dict]:
        events = []
        for i in range(len(self.extrema) - 2):
            if (self.extrema[i].extremum_type == pattern[0] and
                self.extrema[i+1].extremum_type == pattern[1] and
                self.extrema[i+2].extremum_type == pattern[2]):
                
                event = {
                    'start_value': self.extrema[i].value,
                    'start_time': self.extrema[i].index * self.time_per_frame,
                    'inflexion_value': self.extrema[i+1].value,
                    'inflexion_time': self.extrema[i+1].index * self.time_per_frame,
                    'end_value': self.extrema[i+2].value,
                    'end_time': self.extrema[i+2].index * self.time_per_frame,
                    'shift_start_to_inflexion': abs(self.extrema[i].value - self.extrema[i+1].value),
                    'shift_inflexion_to_end': abs(self.extrema[i+2].value - self.extrema[i+1].value),
                    'time_start_to_inflexion': (self.extrema[i+1].index - self.extrema[i].index) * self.time_per_frame,
                    'time_inflexion_to_end': (self.extrema[i+2].index - self.extrema[i+1].index) * self.time_per_frame,
                    'cycle_time': (self.extrema[i+2].index - self.extrema[i].index) * self.time_per_frame,
                    'pattern': 'lowHighLow' if pattern[0] == 0 else 'HighLowHigh',
                    'start_index': self.extrema[i].index,
                    'end_index': self.extrema[i+2].index
                }
                events.append(event)
        return events
    
    def get_event_data(self, start_idx: int, end_idx: int, column: int) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        return self.raw_data[start_idx:end_idx+1, column]
    
    def calculate_distance(self, p1_cols: List[int], p2_cols: List[int]) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        
        p1 = self.raw_data[:, p1_cols]
        p2 = self.raw_data[:, p2_cols]
        return np.linalg.norm(p2 - p1, axis=1)
    
    def calculate_angle_3points(self, p1_cols: List[int], p2_cols: List[int], p3_cols: List[int]) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        
        p1 = self.raw_data[:, p1_cols]
        p2 = self.raw_data[:, p2_cols]
        p3 = self.raw_data[:, p3_cols]
        
        u = p1 - p2
        v = p3 - p2
        
        angles = np.zeros(len(self.raw_data))
        for i in range(len(self.raw_data)):
            u_vec = u[i].flatten()
            v_vec = v[i].flatten()
            if len(u_vec) < 2 or len(v_vec) < 2:
                dot = np.dot(u_vec, v_vec)
                norm_u = np.linalg.norm(u_vec)
                norm_v = np.linalg.norm(v_vec)
                if norm_u > 0 and norm_v > 0:
                    cos_angle = dot / (norm_u * norm_v)
                    cos_angle = np.clip(cos_angle, -1, 1)
                    angles[i] = np.degrees(np.arccos(cos_angle))
            elif len(u_vec) == 2:
                cross = u_vec[0] * v_vec[1] - u_vec[1] * v_vec[0]
                dot = np.dot(u_vec, v_vec)
                angles[i] = np.degrees(np.arctan2(abs(cross), dot))
            else:
                cross = np.cross(u_vec, v_vec)
                dot = np.dot(u_vec, v_vec)
                angles[i] = np.degrees(np.arctan2(np.linalg.norm(cross), dot))
        
        return angles
    
    def calculate_angle_4points(self, p1_cols: List[int], p2_cols: List[int], 
                                 p3_cols: List[int], p4_cols: List[int]) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        
        p1 = self.raw_data[:, p1_cols]
        p2 = self.raw_data[:, p2_cols]
        p3 = self.raw_data[:, p3_cols]
        p4 = self.raw_data[:, p4_cols]
        
        u = p1 - p2
        v = p4 - p3
        
        angles = np.zeros(len(self.raw_data))
        for i in range(len(self.raw_data)):
            u_vec = u[i].flatten()
            v_vec = v[i].flatten()
            if len(u_vec) < 2 or len(v_vec) < 2:
                dot = np.dot(u_vec, v_vec)
                norm_u = np.linalg.norm(u_vec)
                norm_v = np.linalg.norm(v_vec)
                if norm_u > 0 and norm_v > 0:
                    cos_angle = dot / (norm_u * norm_v)
                    cos_angle = np.clip(cos_angle, -1, 1)
                    angles[i] = np.degrees(np.arccos(cos_angle))
            elif len(u_vec) == 2:
                cross = u_vec[0] * v_vec[1] - u_vec[1] * v_vec[0]
                dot = np.dot(u_vec, v_vec)
                angles[i] = np.degrees(np.arctan2(abs(cross), dot))
            else:
                cross = np.cross(u_vec, v_vec)
                dot = np.dot(u_vec, v_vec)
                angles[i] = np.degrees(np.arctan2(np.linalg.norm(cross), dot))
        
        return angles
    
    def normalize_data(self, column: int) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        non_zero_indices = np.where(self.raw_data[:, column] != 0)[0]
        if len(non_zero_indices) > 0:
            first_value = self.raw_data[non_zero_indices[0], column]
        else:
            first_value = 0
        return self.raw_data[:, column] - first_value
    
    def calculate_mean_trend(self, events: List[dict], column: int, 
                              target_length: Optional[int] = None) -> Tuple[np.ndarray, np.ndarray]:
        if self.raw_data is None or not events:
            raise ValueError("No data or events")
        
        segments = []
        for event in events:
            segment = self.raw_data[event['start_index']:event['end_index']+1, column]
            segments.append(segment)
        
        if target_length is None:
            target_length = int(np.mean([len(s) for s in segments]))
        
        interpolated = []
        for segment in segments:
            x_old = np.linspace(0, 1, len(segment))
            x_new = np.linspace(0, 1, target_length)
            interpolated.append(np.interp(x_new, x_old, segment))
        
        interpolated = np.array(interpolated)
        mean_trend = np.mean(interpolated, axis=0)
        std_trend = np.std(interpolated, axis=0)
        
        return mean_trend, std_trend
    
    def get_reference_column_data(self, column: int) -> np.ndarray:
        if self.raw_data is None:
            raise ValueError("No data loaded")
        return self.raw_data[:, column]
    
    def to_dict(self) -> dict:
        return {
            'extrema': [
                {'value': e.value, 'index': e.index, 'type': e.extremum_type}
                for e in self.extrema
            ],
            'frequency': self.frequency,
            'time_per_frame': self.time_per_frame,
            'data_shape': list(self.raw_data.shape) if self.raw_data is not None else None
        }
