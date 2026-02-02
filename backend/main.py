"""
Graph Analyzer API - FastAPI backend
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Tuple
from pathlib import Path
import numpy as np
import pandas as pd
import io

try:
    from backend.analyzer import GraphAnalyzer, Extremum
except ImportError:
    from analyzer import GraphAnalyzer, Extremum

DEFAULT_CSV_PATH = Path(__file__).parent / "test_data.csv"

app = FastAPI(title="Graph Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, GraphAnalyzer] = {}


class AnalyzeRequest(BaseModel):
    session_id: str
    column: int
    min_distance: int = 10
    frequency: float = 100.0


class ExtremumUpdate(BaseModel):
    session_id: str
    index: int
    extremum_type: str = "max"
    epsilon: int = 20


class ExtremumDelete(BaseModel):
    session_id: str
    index: int
    tolerance: int = 15


class PatternRequest(BaseModel):
    session_id: str
    pattern: List[int]


class ColumnDataRequest(BaseModel):
    session_id: str
    column: int


class RestoreStateRequest(BaseModel):
    session_id: str
    extrema: List[dict]


@app.get("/api/load-default")
async def load_default_data(delimiter: str = ";"):
    if not DEFAULT_CSV_PATH.exists():
        raise HTTPException(status_code=404, detail="Default CSV file not found")
    
    try:
        df = pd.read_csv(DEFAULT_CSV_PATH, delimiter=delimiter, header=None)
        data = df.values.astype(float)
        
        session_id = f"session_{len(sessions)}"
        analyzer = GraphAnalyzer()
        analyzer.load_csv(data)
        sessions[session_id] = analyzer
        
        return {
            "session_id": session_id,
            "rows": data.shape[0],
            "columns": data.shape[1],
            "padded_rows": analyzer.raw_data.shape[0]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), delimiter: str = ";"):
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content), delimiter=delimiter, header=None)
        data = df.values.astype(float)
        
        session_id = f"session_{len(sessions)}"
        analyzer = GraphAnalyzer()
        analyzer.load_csv(data)
        sessions[session_id] = analyzer
        
        return {
            "session_id": session_id,
            "rows": data.shape[0],
            "columns": data.shape[1],
            "padded_rows": analyzer.raw_data.shape[0]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    analyzer.frequency = request.frequency
    analyzer.time_per_frame = 1.0 / request.frequency
    
    try:
        extrema = analyzer.find_extrema(request.column, request.min_distance)
        column_data = analyzer.raw_data[:, request.column].tolist()
        return {
            "extrema": [{"value": e.value, "index": e.index, "type": e.extremum_type} for e in extrema],
            "count": len(extrema),
            "column_data": column_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/extremum/add")
async def add_extremum(request: ExtremumUpdate):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    try:
        new_ext = analyzer.add_extremum(request.index, request.epsilon, request.extremum_type)
        return {"value": new_ext.value, "index": new_ext.index, "type": new_ext.extremum_type}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/extremum/remove")
async def remove_extremum(request: ExtremumDelete):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    success = analyzer.remove_extremum(request.index, request.tolerance)
    return {"success": success}


@app.post("/api/pattern/events")
async def get_pattern_events(request: PatternRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if len(request.pattern) != 3:
        raise HTTPException(status_code=400, detail="Pattern must have exactly 3 elements")
    
    analyzer = sessions[request.session_id]
    events = analyzer.find_pattern_events(tuple(request.pattern))
    return {"events": events, "count": len(events)}


@app.post("/api/data/column")
async def get_column_data(request: ColumnDataRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    if analyzer.raw_data is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    
    if request.column >= analyzer.raw_data.shape[1]:
        raise HTTPException(status_code=400, detail="Column index out of range")
    
    data = analyzer.raw_data[:, request.column].tolist()
    return {"data": data, "length": len(data)}


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return sessions[session_id].to_dict()


@app.get("/api/session/{session_id}/extrema")
async def get_extrema(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[session_id]
    return {
        "extrema": [{"value": e.value, "index": e.index, "type": e.extremum_type} for e in analyzer.extrema]
    }


@app.post("/api/state/restore")
async def restore_state(request: RestoreStateRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    analyzer.extrema = [
        Extremum(
            value=e["value"],
            index=e["index"],
            extremum_type=e["extremum_type"]
        )
        for e in request.extrema
    ]
    return {"success": True, "count": len(analyzer.extrema)}


@app.post("/api/export/events")
async def export_events(request: PatternRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    events = analyzer.find_pattern_events(tuple(request.pattern))
    
    if not events:
        return {"csv": "", "parameters": []}
    
    parameters = []
    for event in events:
        parameters.append({
            "start_value": event["start_value"],
            "start_time": event["start_time"],
            "inflexion_value": event["inflexion_value"],
            "inflexion_time": event["inflexion_time"],
            "end_value": event["end_value"],
            "end_time": event["end_time"],
            "shift_start_to_inflexion": event["shift_start_to_inflexion"],
            "shift_inflexion_to_end": event["shift_inflexion_to_end"],
            "time_start_to_inflexion": event["time_start_to_inflexion"],
            "time_inflexion_to_end": event["time_inflexion_to_end"],
            "cycle_time": event["cycle_time"],
            "pattern": event["pattern"]
        })
    
    return {"parameters": parameters}


class StickFigureRequest(BaseModel):
    session_id: str
    connections: List[List[int]]  # pairs of point indices to connect
    point_labels: Optional[List[str]] = None
    frame_rate: int = 24
    column: Optional[int] = None  # if set, animate single column as signal trace


class MeanTrendRequest(BaseModel):
    session_id: str
    pattern: List[int]
    column: int
    target_length: Optional[int] = None


class MeanTrendExtendedRequest(BaseModel):
    session_id: str
    pattern: List[int]
    column: int
    target_length: Optional[int] = None
    length_mode: str = 'average'  # 'average' or 'percentage'
    interpolation_method: str = 'linear'  # 'linear' or 'spline'


class NormalizeRequest(BaseModel):
    session_id: str
    column: int


class SavepointRequest(BaseModel):
    session_id: str


@app.post("/api/mean-trend")
async def get_mean_trend(request: MeanTrendRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    events = analyzer.find_pattern_events(tuple(request.pattern))
    
    if not events:
        raise HTTPException(status_code=400, detail="No events found for pattern")
    
    try:
        mean_trend, std_trend = analyzer.calculate_mean_trend(
            events, request.column, request.target_length
        )
        return {
            "mean": mean_trend.tolist(),
            "std": std_trend.tolist(),
            "length": len(mean_trend),
            "event_count": len(events)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/mean-trend-extended")
async def get_mean_trend_extended(request: MeanTrendExtendedRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    events = analyzer.find_pattern_events(tuple(request.pattern))
    
    if not events:
        raise HTTPException(status_code=400, detail="No events found for pattern")
    
    try:
        result = analyzer.calculate_mean_trend_extended(
            events, 
            request.column, 
            request.target_length,
            request.length_mode,
            request.interpolation_method
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/normalize")
async def normalize_column(request: NormalizeRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    try:
        normalized = analyzer.normalize_data(request.column)
        return {"data": normalized.tolist(), "length": len(normalized)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/savepoint/save")
async def save_savepoint(request: SavepointRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    savepoint = {
        "extrema": [{"value": e.value, "index": e.index, "type": e.extremum_type} 
                    for e in analyzer.extrema],
        "frequency": analyzer.frequency,
        "time_per_frame": analyzer.time_per_frame,
        "raw_data": analyzer.raw_data.tolist() if analyzer.raw_data is not None else None
    }
    return savepoint


@app.post("/api/savepoint/load")
async def load_savepoint(savepoint: dict):
    session_id = f"session_{len(sessions)}"
    analyzer = GraphAnalyzer(frequency=savepoint.get("frequency", 100.0))
    
    if savepoint.get("raw_data"):
        analyzer.raw_data = np.array(savepoint["raw_data"])
    
    for ext in savepoint.get("extrema", []):
        from analyzer import Extremum
        analyzer.extrema.append(Extremum(
            value=ext["value"],
            index=ext["index"],
            extremum_type=ext["type"]
        ))
    
    sessions[session_id] = analyzer
    return {"session_id": session_id}


@app.post("/api/reference-column")
async def get_reference_column(request: ColumnDataRequest):
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    try:
        data = analyzer.get_reference_column_data(request.column)
        return {"data": data.tolist(), "length": len(data)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/stick-figure/data")
async def get_stick_figure_data(request: StickFigureRequest):
    """
    Returns frame-by-frame data for stick figure animation.
    If column is specified: animates single column as a moving point with trail
    Otherwise: pairs of X,Y coordinates (col 0,1 = point1 X,Y; col 2,3 = point2 X,Y; etc.)
    """
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    analyzer = sessions[request.session_id]
    if analyzer.raw_data is None:
        raise HTTPException(status_code=400, detail="No data loaded")
    
    data = analyzer.raw_data
    num_frames = data.shape[0]
    num_cols = data.shape[1]
    
    # Single column signal trace mode
    if request.column is not None:
        if request.column < 0 or request.column >= num_cols:
            raise HTTPException(status_code=400, detail=f"Column {request.column} out of range")
        
        # Skip padding (100 at start, 100 at end)
        padding_start = 100
        padding_end = 100
        actual_start = padding_start
        actual_end = num_frames - padding_end
        
        col_data = data[actual_start:actual_end, request.column]
        num_frames = len(col_data)
        y_min, y_max = float(np.min(col_data)), float(np.max(col_data))
        
        # Create frames with trailing points (show history)
        trail_length = 50  # number of previous points to show
        frames = []
        for frame_idx in range(num_frames):
            points = []
            # Add trail points (older points)
            start_idx = max(0, frame_idx - trail_length + 1)
            for i in range(start_idx, frame_idx + 1):
                alpha = (i - start_idx + 1) / (frame_idx - start_idx + 1)  # fade effect
                points.append({
                    "x": float(i),
                    "y": float(col_data[i]),
                    "label": f"t={i}" if i == frame_idx else ""
                })
            frames.append({"points": points})
        
        # Connections: connect consecutive trail points
        connections = [[i, i+1] for i in range(trail_length - 1)]
        
        return {
            "frames": frames,
            "num_frames": num_frames,
            "num_points": trail_length,
            "bounds": {
                "x_min": 0,
                "x_max": float(num_frames),
                "y_min": y_min,
                "y_max": y_max
            },
            "connections": connections,
            "frame_rate": request.frame_rate
        }
    
    # Original X,Y pairs mode
    num_points = num_cols // 2
    if num_points < 1:
        raise HTTPException(status_code=400, detail="Need at least 2 columns for X,Y pairs")
    
    x_cols = list(range(0, num_points * 2, 2))
    y_cols = list(range(1, num_points * 2, 2))
    
    x_data = data[:, x_cols]
    y_data = data[:, y_cols]
    
    x_min, x_max = float(np.min(x_data)), float(np.max(x_data))
    y_min, y_max = float(np.min(y_data)), float(np.max(y_data))
    
    frames = []
    for frame_idx in range(num_frames):
        points = []
        for i in range(num_points):
            points.append({
                "x": float(data[frame_idx, x_cols[i]]),
                "y": float(data[frame_idx, y_cols[i]]),
                "label": request.point_labels[i] if request.point_labels and i < len(request.point_labels) else f"P{i+1}"
            })
        frames.append({"points": points})
    
    return {
        "frames": frames,
        "num_frames": num_frames,
        "num_points": num_points,
        "bounds": {
            "x_min": x_min,
            "x_max": x_max,
            "y_min": y_min,
            "y_max": y_max
        },
        "connections": request.connections,
        "frame_rate": request.frame_rate
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
