'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Download, Settings } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  label: string;
}

interface Frame {
  points: Point[];
}

interface StickFigureData {
  frames: Frame[];
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

interface StickFigurePlayerProps {
  data: StickFigureData | null;
  onClose: () => void;
}

export default function StickFigurePlayer({ data, onClose }: StickFigurePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const drawFrame = useCallback((frameIndex: number) => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { bounds } = data;
    const frame = data.frames[frameIndex];
    if (!frame) return;

    const padding = 40;
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;

    const xRange = bounds.x_max - bounds.x_min || 1;
    const yRange = bounds.y_max - bounds.y_min || 1;
    const scaleX = width / xRange;
    const scaleY = height / yRange;

    const toCanvasX = (x: number) => padding + (x - bounds.x_min) * scaleX;
    const toCanvasY = (y: number) => canvas.height - padding - (y - bounds.y_min) * scaleY;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const y = padding + (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }

    // Draw the signal trace (all points connected)
    if (frame.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(frame.points[0].x), toCanvasY(frame.points[0].y));
      
      for (let i = 1; i < frame.points.length; i++) {
        const point = frame.points[i];
        const alpha = i / frame.points.length;
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.3 + alpha * 0.7})`;
        ctx.lineWidth = 1 + alpha * 2;
        ctx.lineTo(toCanvasX(point.x), toCanvasY(point.y));
      }
      ctx.stroke();
    }

    // Draw current point (last point in trail) with highlight
    if (frame.points.length > 0) {
      const currentPoint = frame.points[frame.points.length - 1];
      const cx = toCanvasX(currentPoint.x);
      const cy = toCanvasY(currentPoint.y);

      // Glow effect
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      // Main dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      if (showLabels && currentPoint.label) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(currentPoint.label, cx + 12, cy + 4);
      }
    }

    // Frame info
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Frame: ${frameIndex + 1} / ${data.num_frames}`, 10, 20);
  }, [data, showLabels]);

  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  useEffect(() => {
    if (!isPlaying || !data) return;

    const frameInterval = 1000 / data.frame_rate;

    const animate = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= frameInterval) {
        setCurrentFrame((prev) => {
          const next = prev + 1;
          if (next >= data.num_frames) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
        lastTimeRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, data]);

  const handlePlayPause = () => {
    if (currentFrame >= (data?.num_frames || 1) - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentFrame(0);
  };

  const handleDownload = async () => {
    if (!data || !canvasRef.current) return;

    const frames: string[] = [];
    for (let i = 0; i < data.num_frames; i++) {
      drawFrame(i);
      frames.push(canvasRef.current.toDataURL('image/png'));
    }

    const link = document.createElement('a');
    link.download = `stick_figure_frame_${currentFrame + 1}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (!data) {
    return (
      <div className="card p-6 text-center text-neutral-400">
        No stick figure data available. Upload motion capture data with X,Y coordinate pairs.
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-white">Stick Figure Animation</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="rounded-xl overflow-hidden mb-6 border border-white/10">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="w-full"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={data.num_frames - 1}
            value={currentFrame}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentFrame(Number(e.target.value));
            }}
            className="flex-1 accent-primary-500"
          />
          <span className="text-sm text-neutral-400 w-24 text-right font-mono">
            {currentFrame + 1} / {data.num_frames}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handlePlayPause}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-emerald-600 text-white font-medium rounded-xl hover:from-blue-500 hover:to-emerald-500 transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-700 border border-neutral-600 text-white font-medium rounded-xl hover:bg-neutral-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium bg-emerald-500/90 text-white hover:bg-emerald-500 transition-colors"
            >
              <Download className="w-4 h-4" />
              Save Frame
            </button>
          </div>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              showLabels 
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' 
                : 'bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10'
            }`}
          >
            <Settings className="w-4 h-4" />
            Labels
          </button>
        </div>

        <div className="text-xs text-neutral-500">
          {data.num_points} points • {data.connections.length} connections • {data.frame_rate} FPS
        </div>
      </div>
    </div>
  );
}
