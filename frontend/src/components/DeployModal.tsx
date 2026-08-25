import React, { useState } from 'react';
import {
  X,
  Rocket,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Download,
  Terminal,
  FileCode,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { WorkflowGraph, VerificationReport, TargetFormat, CompiledArtifact } from '../types';
import { api } from '../services/api';

interface DeployModalProps {
  isOpen: boolean;
  graph: WorkflowGraph | null;
  report: VerificationReport | null;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  graph,
  report,
  onClose
}) => {
  if (!isOpen || !graph) return null;

  const [targetFormat, setTargetFormat] = useState<TargetFormat>('bpmn');
  const [compiledCode, setCompiledCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [deployResult, setDeployResult] = useState<any | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const blockingIssues =
    report?.checks.filter((c) => c.severity === 'error' || c.severity === 'critical') || [];
  const warnings = report?.checks.filter((c) => c.severity === 'warning') || [];
  const canDeploy = report?.is_valid && blockingIssues.length === 0;

  const handleFetchCode = async (fmt: TargetFormat) => {
    setTargetFormat(fmt);
    setIsLoading(true);
    try {
      const res = await api.compileWorkflow(graph, fmt);
      if (res.artifacts && res.artifacts[fmt]) {
        setCompiledCode(res.artifacts[fmt].content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && graph) {
      handleFetchCode(targetFormat);
    }
  }, [isOpen, graph]);

  const handleDeploy = async () => {
    setIsLoading(true);
    try {
      const res = await api.deployWorkflow({
        graph,
        target_format: targetFormat,
        environment: 'production'
      });
      setDeployResult(res);
    } catch (err: any) {
      alert(err.message || 'Deployment error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const extensions: Record<TargetFormat, string> = {
      bpmn: 'bpmn',
      temporal_ts: 'ts',
      temporal_py: 'py',
      xstate: 'json',
      mermaid: 'mmd'
    };
    const blob = new Blob([compiledCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name.toLowerCase().replace(/\s+/g, '_')}.${extensions[targetFormat]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Deploy Workflow Engine</span>
                {canDeploy ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                    Ready for Production
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                    Deployment Blocked ({blockingIssues.length} issues)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Formal proof verification, runtime deployment & multi-target compilation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs text-slate-300">
          {deployResult ? (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-emerald-300">Workflow Successfully Deployed!</h3>
              <p className="text-slate-300 max-w-md mx-auto">{deployResult.message}</p>
              <div className="p-3 rounded-xl bg-slate-900 font-mono text-xs text-indigo-300 inline-block">
                Deployment ID: <span className="font-bold text-white">{deployResult.deployment_id}</span>
              </div>
              <div className="pt-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-all"
                >
                  Close & Return to Studio
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Pre-Flight Checklist */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Pre-Flight Verification Checklist</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      report?.soundness_passed
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {report?.soundness_passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">Graph Soundness</div>
                      <div className="text-[10px] opacity-80">
                        {report?.soundness_passed ? 'Acyclic & Reachable' : 'Issues detected'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      report?.authorization_passed
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {report?.authorization_passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">IAM & SoD Rules</div>
                      <div className="text-[10px] opacity-80">
                        {report?.authorization_passed ? 'Zero SoD Conflicts' : 'Role/limit violations'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      report?.smt_passed
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {report?.smt_passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-[11px]">Z3 SMT Constraints</div>
                      <div className="text-[10px] opacity-80">
                        {report?.smt_passed ? 'Satisfiable & Exhaustive' : 'Dead paths detected'}
                      </div>
                    </div>
                  </div>
                </div>

                {!canDeploy && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/30 text-rose-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-rose-400" />
                      <span>Deployment Blocked by Errors:</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5">
                      {blockingIssues.map((b, i) => (
                        <li key={i}>{b.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Target Artifact Code Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(['bpmn', 'temporal_ts', 'temporal_py', 'xstate', 'mermaid'] as TargetFormat[]).map(
                      (fmt) => (
                        <button
                          key={fmt}
                          onClick={() => handleFetchCode(fmt)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                            targetFormat === fmt
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-white/5'
                          }`}
                        >
                          {fmt.replace('_', ' ')}
                        </button>
                      )
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                <div className="relative rounded-xl overflow-hidden border border-white/10 bg-slate-950">
                  <pre className="p-4 font-mono text-xs text-cyan-300 overflow-x-auto max-h-72 leading-relaxed custom-scrollbar">
                    {isLoading ? 'Compiling artifact...' : compiledCode}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!deployResult && (
          <div className="p-4 px-6 border-t border-white/10 flex items-center justify-between bg-slate-950/80">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              disabled={!canDeploy || isLoading}
              onClick={handleDeploy}
              className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${
                canDeploy && !isLoading
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-emerald-500/25 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title={canDeploy ? 'Deploy to runtime' : 'Resolve blocking errors first'}
            >
              <Rocket className="w-4 h-4" />
              <span>{isLoading ? 'Deploying...' : 'Deploy to Production Environment'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
