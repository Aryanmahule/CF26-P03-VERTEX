import React from 'react';
import {
  AlertTriangle,
  Check,
  Sparkles,
  HelpCircle,
  ArrowRight,
  UserCheck,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { AmbiguityFinding, AmbiguityOption, WorkflowGraph } from '../types';

interface AmbiguityDrawerProps {
  ambiguities: AmbiguityFinding[];
  graph: WorkflowGraph | null;
  onResolve: (findingId: string, optionId: string) => void;
  isProcessing: boolean;
  onSelectNodeById?: (nodeId: string) => void;
  onHighlightSpan?: (span: [number, number]) => void;
}

export const AmbiguityDrawer: React.FC<AmbiguityDrawerProps> = ({
  ambiguities,
  graph,
  onResolve,
  isProcessing,
  onSelectNodeById,
  onHighlightSpan
}) => {
  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Ambiguity Detector & Resolution Engine
            </h2>
            <p className="text-[11px] text-slate-400">
              Flags underspecified actors, vague predicates, and execution order ambiguities.
            </p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          {ambiguities.length} Flagged Item{ambiguities.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {ambiguities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500">
            <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-400" />
            <p className="text-sm font-medium text-slate-300">No Ambiguities Detected</p>
            <p className="text-xs text-slate-500 mt-1">
              All tasks, actors, guards, and execution orders are explicitly defined and disambiguated.
            </p>
          </div>
        ) : (
          ambiguities.map((amb) => (
            <div
              key={amb.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30 hover:border-amber-500/50 transition-all shadow-lg"
            >
              {/* Title & Severity */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-100">{amb.title}</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30">
                  {amb.category.replace('_', ' ')}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {amb.description}
              </p>

              {/* Source Span Quote */}
              {amb.source_text && (
                <div
                  onClick={() => {
                    if (amb.source_span && onHighlightSpan) {
                      onHighlightSpan(amb.source_span);
                    }
                    if (amb.node_id && onSelectNodeById) {
                      onSelectNodeById(amb.node_id);
                    }
                  }}
                  className="mb-3 text-[11px] text-indigo-300 font-mono bg-indigo-950/40 hover:bg-indigo-900/60 p-2 rounded-lg border border-indigo-500/30 cursor-pointer flex items-center justify-between transition-all"
                >
                  <span>Derived from: "{amb.source_text}"</span>
                  <span className="text-[10px] text-indigo-400 underline">Locate</span>
                </div>
              )}

              {/* Candidate Resolution Options */}
              {amb.candidate_options && amb.candidate_options.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t border-white/5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Select Resolution:</span>
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    {amb.candidate_options.map((opt) => (
                      <button
                        key={opt.id}
                        disabled={isProcessing}
                        onClick={() => onResolve(amb.id, opt.id)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-900/40 border border-white/5 hover:border-indigo-500/40 text-left transition-all group disabled:opacity-50"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-200">
                            {opt.label}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {opt.description}
                          </div>
                        </div>

                        <div className="px-2 py-1 rounded bg-indigo-600/30 group-hover:bg-indigo-600 text-indigo-300 group-hover:text-white text-[11px] font-semibold transition-all flex items-center gap-1 shrink-0 ml-2">
                          <span>Apply</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
