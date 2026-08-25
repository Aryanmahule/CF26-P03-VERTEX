import React from 'react';
import { FileText, ArrowRight, Wand2, RefreshCw } from 'lucide-react';

interface PolicyEditorProps {
  policyText: string;
  onChangePolicyText: (text: string) => void;
  onParse: () => void;
  isProcessing: boolean;
  highlightSpan?: [number, number] | null;
}

export const PolicyEditor: React.FC<PolicyEditorProps> = ({
  policyText,
  onChangePolicyText,
  onParse,
  isProcessing,
  highlightSpan
}) => {
  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-3.5 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Natural Language Ingestion
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            {policyText.length} chars
          </span>
          <button
            onClick={onParse}
            disabled={isProcessing || !policyText.trim()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40"
          >
            {isProcessing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Wand2 className="w-3 h-3" />
            )}
            <span>Parse to IR</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex flex-col p-4 bg-slate-950/70 relative">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Enterprise Policy Text (Natural Language)</span>
          <span className="text-[10px] text-indigo-300 font-normal">
            Supports conditional guards, roles, parallel forks
          </span>
        </label>

        <div className="relative flex-1">
          <textarea
            value={policyText}
            onChange={(e) => onChangePolicyText(e.target.value)}
            placeholder="Type or paste natural language policy here (e.g. 'For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.')..."
            className="w-full h-full p-3.5 bg-slate-900/90 text-slate-100 text-sm font-sans rounded-xl border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Source Span Highlighting Bar */}
        {highlightSpan && highlightSpan[1] > highlightSpan[0] && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-xs">
            <span className="text-indigo-300 font-semibold">Active Focus Span: </span>
            <span className="text-white font-mono bg-indigo-900/60 px-1.5 py-0.5 rounded text-[11px]">
              "{policyText.slice(highlightSpan[0], highlightSpan[1])}"
            </span>
          </div>
        )}

        {/* Quick Insert Snippets */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-bold text-slate-500">Insert:</span>
          {[
            'For any purchase over $10,000,',
            'in parallel,',
            'obtain finance approval,',
            'create the procurement ticket.'
          ].map((snippet, idx) => (
            <button
              key={idx}
              onClick={() => onChangePolicyText(policyText ? `${policyText} ${snippet}` : snippet)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-white/5 transition-all"
            >
              + {snippet}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
