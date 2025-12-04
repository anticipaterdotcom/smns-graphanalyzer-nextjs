'use client';

import { useState } from 'react';
import { Filter } from 'lucide-react';
import { PatternEvent } from '@/lib/api';

interface PatternSelectorProps {
  onPatternSelect: (pattern: number[]) => void;
  events: PatternEvent[];
  onEventHover?: (event: PatternEvent | null) => void;
}

export default function PatternSelector({
  onPatternSelect,
  events,
  onEventHover,
}: PatternSelectorProps) {
  const [pattern, setPattern] = useState<number[]>([0, 1, 0]);

  const patterns = [
    { value: [0, 1, 0], label: 'Low → High → Low' },
    { value: [1, 0, 1], label: 'High → Low → High' },
  ];

  const handlePatternChange = (newPattern: number[]) => {
    setPattern(newPattern);
    onPatternSelect(newPattern);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary-500/20 border border-white/10">
          <Filter className="w-5 h-5 text-primary-400" />
        </div>
        <h3 className="font-semibold text-white">Pattern Detection</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          {patterns.map((p) => (
            <button
              key={p.label}
              onClick={() => handlePatternChange(p.value)}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200 ${
                JSON.stringify(pattern) === JSON.stringify(p.value)
                  ? 'bg-gradient-to-r from-primary-500/90 to-emerald-500/90 text-white shadow-lg shadow-primary-500/20'
                  : 'bg-white/5 text-neutral-300 border border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {events.length > 0 && (
          <>
            <div className="text-sm text-neutral-400">
              Found <span className="font-semibold text-primary-400">{events.length}</span> events
              matching pattern
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/50">
              <table className="w-full text-sm">
                <thead className="bg-neutral-800/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-neutral-400 font-medium">#</th>
                    <th className="px-3 py-2.5 text-left text-neutral-400 font-medium">Start</th>
                    <th className="px-3 py-2.5 text-left text-neutral-400 font-medium">Inflexion</th>
                    <th className="px-3 py-2.5 text-left text-neutral-400 font-medium">End</th>
                    <th className="px-3 py-2.5 text-left text-neutral-400 font-medium">Cycle Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, i) => (
                    <tr 
                      key={i} 
                      className="border-t border-white/5 hover:bg-primary-500/20 text-neutral-300 cursor-pointer transition-colors"
                      onMouseEnter={() => onEventHover?.(event)}
                      onMouseLeave={() => onEventHover?.(null)}
                    >
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{event.start_value.toFixed(2)}</td>
                      <td className="px-3 py-2">{event.inflexion_value.toFixed(2)}</td>
                      <td className="px-3 py-2">{event.end_value.toFixed(2)}</td>
                      <td className="px-3 py-2">{event.cycle_time.toFixed(3)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
