import React, { useState } from 'react';
import {
  Play,
  SkipForward,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Shield,
  Layers,
  Activity
} from 'lucide-react';
import { WorkflowGraph, SimulationResult, SimulationStep } from '../types';

interface SimulatorPanelProps {
  graph: WorkflowGraph | null;
  payload: Record<string, any>;
  onChangePayload: (payload: Record<string, any>) => void;
  onRunSimulation: () => void;
  simulationResult: SimulationResult | null;
  currentStepIndex: number;
  onNextStep: () => void;
  onResetSimulation: () => void;
  isSimulating: boolean;
}

export const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
  graph,
  payload,
  onChangePayload,
  onRunSimulation,
  simulationResult,
  currentStepIndex,
  onNextStep,
  onResetSimulation,
  isSimulating
}) => {
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarVal, setNewVarVal] = useState('');

  const handleAddVar = () => {
    if (newVarKey.trim()) {
      let parsedVal: any = newVarVal.trim();
      if (!isNaN(Number(parsedVal))) {
        parsedVal = Number(parsedVal);
      } else if (parsedVal.toLowerCase() === 'true') {
        parsedVal = true;
      } else if (parsedVal.toLowerCase() === 'false') {
        parsedVal = false;
      }
      onChangePayload({
        ...payload,
        [newVarKey.trim()]: parsedVal
      });
      setNewVarKey('');
      setNewVarVal('');
    }
  };

  const handleUpdateVal = (key: string, val: any) => {
    onChangePayload({
      ...payload,
      [key]: val
    });
  };

  const handleRemoveVal = (key: string) => {
    const updated = { ...payload };
    delete updated[key];
    onChangePayload(updated);
  };

  const traceSteps = simulationResult?.trace || [];
  const currentStep: SimulationStep | undefined = traceSteps[currentStepIndex];

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Interactive Workflow Execution Engine & Simulator
            </h2>
            <p className="text-[11px] text-slate-400">
              Inject test payloads, evaluate guard boundaries, and trace state transitions.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onResetSimulation}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-white/5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={onNextStep}
            disabled={!simulationResult || currentStepIndex >= traceSteps.length - 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-40"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Step Next</span>
          </button>

          <button
            onClick={onRunSimulation}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-emerald text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Left Side: Payload Variable Editor (4 Cols) */}
        <div className="col-span-5 border-r border-white/10 p-4 bg-slate-950/60 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Mock Input Context / Payload
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {Object.keys(payload).length} active variables
            </span>
          </div>

          {/* Variables Table */}
          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
            {Object.entries(payload).map(([k, v]) => (
              <div
                key={k}
                className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between gap-2"
              >
                <div className="overflow-hidden">
                  <div className="text-xs font-mono font-semibold text-cyan-300 truncate" title={k}>
                    {k}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    type: {typeof v}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {typeof v === 'boolean' ? (
                    <button
                      onClick={() => handleUpdateVal(k, !v)}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                        v
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {v ? 'true' : 'false'}
                    </button>
                  ) : (
                    <input
                      type={typeof v === 'number' ? 'number' : 'text'}
                      value={v}
                      onChange={(e) =>
                        handleUpdateVal(
                          k,
                          typeof v === 'number' ? Number(e.target.value) : e.target.value
                        )
                      }
                      className="w-28 px-2 py-1 bg-slate-950 text-right font-mono text-xs text-white rounded border border-white/10 focus:outline-none focus:border-indigo-500"
                    />
                  )}

                  <button
                    onClick={() => handleRemoveVal(k)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 transition-all text-xs"
                    title="Remove variable"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {/* Add Custom Variable */}
            <div className="pt-2 border-t border-white/5 flex gap-2">
              <input
                type="text"
                placeholder="variable.name"
                value={newVarKey}
                onChange={(e) => setNewVarKey(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-slate-900 text-xs font-mono text-white rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="value"
                value={newVarVal}
                onChange={(e) => setNewVarVal(e.target.value)}
                className="w-24 px-2.5 py-1.5 bg-slate-900 text-xs font-mono text-white rounded-lg border border-white/10 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleAddVar}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Step Trace Log (7 Cols) */}
        <div className="col-span-7 p-4 bg-slate-950/40 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Execution Timeline & State Trace
            </span>
            {simulationResult && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  simulationResult.success
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                    : 'bg-rose-950/70 text-rose-300 border-rose-500/40'
                }`}
              >
                {simulationResult.status.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {traceSteps.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <Play className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
                <p className="text-xs">Click 'Run Simulation' to execute graph with payload.</p>
              </div>
            ) : (
              traceSteps.map((step, idx) => {
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-indigo-950/50 border-indigo-500/60 ring-2 ring-indigo-500/30'
                        : 'bg-slate-900/60 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 flex items-center justify-center border border-white/10 font-mono">
                          {step.step_number}
                        </span>
                        <span className="text-xs font-bold text-slate-100">
                          {step.node_label}
                        </span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-white/5">
                          {step.node_type}
                        </span>
                      </div>

                      {step.actor && (
                        <span className="text-[11px] font-medium text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
                          {step.actor}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 font-sans leading-relaxed">
                      {step.action_taken}
                    </p>

                    {/* Evaluated Guards */}
                    {step.evaluated_guards && step.evaluated_guards.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.evaluated_guards.map((g, gIdx) => (
                          <div
                            key={gIdx}
                            className={`text-[11px] font-mono px-2 py-1 rounded border flex items-center justify-between ${
                              g.passed
                                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            <span>Guard: {g.guard}</span>
                            <span className="font-bold">{g.passed ? '✓ SATISFIED' : '✗ FALSE'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
