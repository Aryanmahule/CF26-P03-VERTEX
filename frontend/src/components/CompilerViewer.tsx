import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Download,
  Check,
  FileCode,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { TargetFormat, CompiledArtifact } from '../types';

interface CompilerViewerProps {
  artifacts: Record<string, CompiledArtifact>;
  activeFormat: TargetFormat;
  onChangeFormat: (format: TargetFormat) => void;
}

export const CompilerViewer: React.FC<CompilerViewerProps> = ({
  artifacts,
  activeFormat,
  onChangeFormat
}) => {
  const [copied, setCopied] = useState(false);

  const currentArtifact = artifacts[activeFormat];

  const handleCopy = () => {
    if (currentArtifact) {
      navigator.clipboard.writeText(currentArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (currentArtifact) {
      const blob = new Blob([currentArtifact.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = currentArtifact.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header with Target Tabs */}
      <div className="p-3 border-b border-white/10 bg-slate-900/80 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => onChangeFormat('bpmn')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'bpmn'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            BPMN 2.0 XML
          </button>
          <button
            onClick={() => onChangeFormat('temporal_ts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'temporal_ts'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Temporal (TypeScript)
          </button>
          <button
            onClick={() => onChangeFormat('temporal_py')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'temporal_py'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Temporal (Python)
          </button>
          <button
            onClick={() => onChangeFormat('xstate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'xstate'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            XState v5 JSON
          </button>
          <button
            onClick={() => onChangeFormat('mermaid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFormat === 'mermaid'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Mermaid Diagram
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-white/5 shadow-md"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
        </div>
      </div>

      {/* Target Description Bar */}
      {currentArtifact && (
        <div className="px-4 py-2 bg-slate-950/90 border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="font-mono font-semibold text-slate-200">
              {currentArtifact.filename}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">{currentArtifact.description}</span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-white/5 font-mono">
            {currentArtifact.language}
          </span>
        </div>
      )}

      {/* Code Editor Viewport */}
      <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs leading-relaxed text-slate-200 select-text">
        {currentArtifact ? (
          <pre className="overflow-x-auto whitespace-pre">
            <code>{currentArtifact.content}</code>
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Click 'Compile & Verify' to generate executable artifacts.
          </div>
        )}
      </div>
    </div>
  );
};
