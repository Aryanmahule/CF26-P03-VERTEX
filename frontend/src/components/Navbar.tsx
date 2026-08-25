import React from 'react';
import {
  Cpu,
  ShieldCheck,
  Code2,
  PlayCircle,
  Users,
  AlertTriangle,
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
  Undo2,
  Redo2,
  Sliders,
  Rocket,
  Plus,
  GitBranch,
  Network
} from 'lucide-react';
import { PolicyPreset, VerificationReport, LayoutMode } from '../types';

interface NavbarProps {
  presets: PolicyPreset[];
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  activeTab: 'studio' | 'verification' | 'ambiguity' | 'compiler' | 'simulator' | 'org';
  onTabChange: (tab: 'studio' | 'verification' | 'ambiguity' | 'compiler' | 'simulator' | 'org') => void;
  verificationReport: VerificationReport | null;
  ambiguityCount: number;
  onRunCompile: () => void;
  isProcessing: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenRulesModal?: () => void;
  onOpenDeployModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  presets,
  selectedPresetId,
  onSelectPreset,
  activeTab,
  onTabChange,
  verificationReport,
  ambiguityCount,
  onRunCompile,
  isProcessing,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onOpenRulesModal,
  onOpenDeployModal
}) => {
  const blockingCount =
    verificationReport?.checks.filter((c) => (c.severity === 'error' || c.severity === 'critical') && !c.passed).length || 0;
  const isVerified = verificationReport?.is_valid && blockingCount === 0;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl gradient-indigo flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-base tracking-tight text-white">
              CodeForge <span className="text-gradient">Workflow Compiler</span>
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              NL → Verified Graph
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Deterministic Proofs, Branching Auto-Layout & Multi-Target Emitter
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Benchmark Policy:</span>
        <select
          value={selectedPresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          className="bg-transparent text-xs text-indigo-200 font-semibold focus:outline-none cursor-pointer max-w-[240px] truncate"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-900/70 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => onTabChange('studio')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'studio'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Studio & Graph
        </button>

        <button
          onClick={() => onTabChange('verification')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'verification'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verification & SMT</span>
          {verificationReport && (
            <span
              className={`w-2 h-2 rounded-full ${
                isVerified ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
              }`}
            />
          )}
        </button>

        <button
          onClick={() => onTabChange('ambiguity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'ambiguity'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Ambiguities</span>
          {ambiguityCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
              {ambiguityCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('compiler')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'compiler'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Multi-Target
        </button>

        <button
          onClick={() => onTabChange('simulator')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'simulator'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5 text-emerald-400" /> Simulator
        </button>

        <button
          onClick={() => onTabChange('org')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'org'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> IAM & Org
        </button>
      </nav>

      {/* Tool Actions: Undo/Redo, Rules, Deploy */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo buttons */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-white/10">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rules Config Button */}
        <button
          onClick={onOpenRulesModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-all shadow-md"
          title="Open Rules & Parameters Configuration"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Rules Config</span>
        </button>

        {/* Deploy Workflow Button */}
        <button
          onClick={onOpenDeployModal}
          disabled={!isVerified}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
            isVerified
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-emerald-500/20 cursor-pointer animate-pulse'
              : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed opacity-70'
          }`}
          title={isVerified ? 'Deploy verified workflow' : `Deployment disabled: ${blockingCount} blocking issues`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>{isVerified ? 'Deploy' : `Deploy (${blockingCount})`}</span>
        </button>

        {/* Re-compile */}
        <button
          onClick={onRunCompile}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl gradient-indigo text-white text-xs font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:opacity-95 transition-all disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>{isProcessing ? 'Compiling...' : 'Re-Compile'}</span>
        </button>
      </div>
    </header>
  );
};
