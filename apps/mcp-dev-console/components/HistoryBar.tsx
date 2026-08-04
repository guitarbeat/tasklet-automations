import React from 'react';
import { Clock, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { HistoryEntry } from '../types';

interface Props {
  history: HistoryEntry[];
  onReplay: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export const HistoryBar: React.FC<Props> = ({ history, onReplay, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-base-300 bg-base-200 px-3 py-1.5 flex items-center gap-2 overflow-hidden">
      <div className="flex items-center gap-1 text-[10px] uppercase text-base-content/30 font-bold shrink-0">
        <Clock size={10} />
        History
      </div>
      <div className="flex-1 min-w-0 overflow-x-auto thin-scroll flex gap-1">
        {[...history].reverse().map((entry) => (
          <button
            key={entry.id}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-base-300 hover:bg-base-100 text-xs font-mono shrink-0 whitespace-nowrap transition-colors"
            onClick={() => onReplay(entry)}
            title={`Replay ${entry.toolName}`}
          >
            {entry.status === 'success' ? (
              <CheckCircle size={9} className="text-success" />
            ) : (
              <XCircle size={9} className="text-error" />
            )}
            <span className="text-base-content/70 max-w-24 truncate">{entry.toolName}</span>
            <span className="text-base-content/30">{entry.durationMs}ms</span>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost btn-xs shrink-0" onClick={onClear} title="Clear history">
        <RotateCcw size={10} />
      </button>
    </div>
  );
};
