import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  ArrowUpRight,
  Calculator,
  Lock,
  Network,
  AlertOctagon,
  ChevronRight,
  Filter
} from 'lucide-react';
import { VerificationReport, VerificationCheckResult, WorkflowGraph } from '../types';

interface VerificationPanelProps {
  report: VerificationReport | null;
  graph: WorkflowGraph | null;
  onSelectNodeById?: (nodeId: string) => void;
  onHighlightSpan?: (span: [number, number]) => void;
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  report,
  graph,
  onSelectNodeById,
  onHighlightSpan
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'blocking' | 'warnings' | 'passed'>('all');

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-500 glass-panel rounded-2xl border border-white/10">
        <ShieldCheck className="w-12 h-12 mb-3 text-slate-600 animate-pulse" />
        <p className="text-sm font-medium text-slate-400">No Verification Run Yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Parse a policy or modify nodes to trigger live formal rule verification.
        </p>
      </div>
    );
  }

  const blockingChecks = report.checks.filter(
    (c) => (c.severity === 'error' || c.severity === 'critical') && !c.passed
  );
  const warningChecks = report.checks.filter(
    (c) => c.severity === 'warning' && !c.passed
  );
  const passedChecks = report.checks.filter((c) => c.passed);

  const filteredChecks = report.checks.filter((c) => {
    if (activeFilter === 'blocking') return (c.severity === 'error' || c.severity === 'critical') && !c.passed;
    if (activeFilter === 'warnings') return c.severity === 'warning' && !c.passed;
    if (activeFilter === 'passed') return c.passed;
    return true;
  });

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Formal Proofs & Rules Verification
            </h2>
            <p className="text-[11px] text-slate-400">
              Graph Soundness, RBAC/SoD, and Z3 SMT Mathematical Constraints
            </p>
          </div>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
            report.is_valid && blockingChecks.length === 0
              ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
          }`}
        >
          {report.is_valid && blockingChecks.length === 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PASSED (READY TO DEPLOY)</span>
            </>
          ) : (
            <>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>{blockingChecks.length} BLOCKING ISSUES</span>
            </>
          )}
        </div>
      </div>

      {/* 3 Core Verifier Score Cards */}
      <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/50 border-b border-white/5">
        {/* 1. Graph Soundness */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Network className="w-3.5 h-3.5 text-indigo-400" />
              <span>Graph Soundness</span>
            </div>
            {report.soundness_passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Reachability, Acyclic / Bounded Loops, Terminal End, Dual Branching
          </p>
        </div>

        {/* 2. Policy Authorization & SoD */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>IAM & SoD Rules</span>
            </div>
            {report.authorization_passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Segregation of Duties, Spending Threshold Tiers, Role Permissions
          </p>
        </div>

        {/* 3. Z3 SMT Constraints */}
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              <span>Z3 SMT Solver</span>
            </div>
            {report.smt_passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Path Satisfiability, Dead Branch Pruning, Exhaustiveness Proof
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-2 px-4 bg-slate-900/40 border-b border-white/5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Checks ({report.checks.length})
        </button>
        <button
          onClick={() => setActiveFilter('blocking')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            activeFilter === 'blocking'
              ? 'bg-rose-600 text-white'
              : 'text-rose-400 hover:text-rose-200'
          }`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>Blocking ({blockingChecks.length})</span>
        </button>
        <button
          onClick={() => setActiveFilter('warnings')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            activeFilter === 'warnings'
              ? 'bg-amber-600 text-slate-950 font-bold'
              : 'text-amber-400 hover:text-amber-200'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>Warnings ({warningChecks.length})</span>
        </button>
        <button
          onClick={() => setActiveFilter('passed')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
            activeFilter === 'passed'
              ? 'bg-emerald-600 text-white'
              : 'text-emerald-400 hover:text-emerald-200'
          }`}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>Passed ({passedChecks.length})</span>
        </button>
      </div>

      {/* Checks Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
        {filteredChecks.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
            <p className="font-semibold text-slate-400">No issues matching filter criteria.</p>
          </div>
        ) : (
          filteredChecks.map((check, idx) => {
            const isError = !check.passed && (check.severity === 'error' || check.severity === 'critical');
            const isWarning = !check.passed && check.severity === 'warning';
            const isPassed = check.passed;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (check.node_id && onSelectNodeById) onSelectNodeById(check.node_id);
                  if (check.source_span && onHighlightSpan) onHighlightSpan(check.source_span);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isError
                    ? 'bg-rose-950/30 border-rose-500/40 hover:bg-rose-950/50'
                    : isWarning
                    ? 'bg-amber-950/30 border-amber-500/40 hover:bg-amber-950/50'
                    : 'bg-slate-900/50 border-white/5 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    {isError ? (
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className="font-bold text-slate-200 text-xs">
                      {check.title}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      isError
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : isWarning
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {check.checker_name}
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed pl-6">
                  {check.details}
                </p>

                {check.suggestion && (
                  <div className="mt-2 pl-6 text-[10px] text-cyan-300 bg-cyan-950/30 p-2 rounded-lg border border-cyan-800/30 flex items-center gap-1.5">
                    <span className="font-bold uppercase text-[9px] text-cyan-400">Rule Guidance:</span>
                    <span>{check.suggestion}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
