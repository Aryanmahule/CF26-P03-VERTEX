import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  UserCheck,
  Zap,
  Sliders,
  Plus,
  Trash2,
  Copy,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Tag,
  Lock,
  Sparkles
} from 'lucide-react';
import { WorkflowNode, WorkflowEdge, NodeType, Actor, Guard, RulesConfig } from '../types';

interface NodeDetailDrawerProps {
  node: WorkflowNode | null;
  edge: WorkflowEdge | null;
  isOpen: boolean;
  rulesConfig: RulesConfig | null;
  onClose: () => void;
  onUpdateNode: (updatedNode: WorkflowNode) => void;
  onUpdateEdge: (updatedEdge: WorkflowEdge) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onAddBranch?: (nodeId: string) => void;
}

export const NodeDetailDrawer: React.FC<NodeDetailDrawerProps> = ({
  node,
  edge,
  isOpen,
  rulesConfig,
  onClose,
  onUpdateNode,
  onUpdateEdge,
  onDeleteNode,
  onDeleteEdge,
  onDuplicateNode,
  onAddBranch
}) => {
  if (!isOpen || (!node && !edge)) return null;

  // Local state for editing node
  const [label, setLabel] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('task');
  const [actorRole, setActorRole] = useState('');
  const [actorDept, setActorDept] = useState('');
  const [requiredAuth, setRequiredAuth] = useState('');
  const [hasAuth, setHasAuth] = useState(false);
  const [confidence, setConfidence] = useState(1.0);
  const [preconditions, setPreconditions] = useState<Guard[]>([]);
  const [postconditions, setPostconditions] = useState<string[]>([]);
  const [newPrecond, setNewPrecond] = useState('');
  const [newPostcond, setNewPostcond] = useState('');

  // Local state for editing edge
  const [edgeLabel, setEdgeLabel] = useState('');
  const [edgeGuardExpr, setEdgeGuardExpr] = useState('');

  useEffect(() => {
    if (node) {
      setLabel(node.label || '');
      setNodeType(node.type || 'task');
      setActorRole(node.actor?.role || '');
      setActorDept(node.actor?.department || '');
      setRequiredAuth(node.required_authorization || '');
      setHasAuth(!!node.required_authorization);
      setConfidence(node.confidence ?? 1.0);
      setPreconditions(node.preconditions || []);
      setPostconditions(node.metadata?.postconditions || []);
    }
    if (edge) {
      setEdgeLabel(edge.label || '');
      setEdgeGuardExpr(edge.guard?.expression || '');
    }
  }, [node, edge]);

  const handleSaveNode = () => {
    if (!node) return;
    const updated: WorkflowNode = {
      ...node,
      label,
      type: nodeType,
      actor: actorRole.trim()
        ? {
            role: actorRole.trim(),
            department: actorDept.trim() || undefined,
            confidence: confidence
          }
        : undefined,
      required_authorization: hasAuth && requiredAuth.trim() ? requiredAuth.trim() : undefined,
      confidence,
      preconditions,
      metadata: {
        ...(node.metadata || {}),
        postconditions
      }
    };
    onUpdateNode(updated);
  };

  const handleSaveEdge = () => {
    if (!edge) return;
    const updated: WorkflowEdge = {
      ...edge,
      label: edgeLabel.trim() || undefined,
      guard: edgeGuardExpr.trim()
        ? {
            expression: edgeGuardExpr.trim(),
            operator: edgeGuardExpr.includes('<=')
              ? '<='
              : edgeGuardExpr.includes('>=')
              ? '>='
              : edgeGuardExpr.includes('>')
              ? '>'
              : edgeGuardExpr.includes('<')
              ? '<'
              : '==',
            source_text: edgeGuardExpr.trim()
          }
        : undefined
    };
    onUpdateEdge(updated);
  };

  const addPrecondition = () => {
    if (!newPrecond.trim()) return;
    const guard: Guard = {
      expression: newPrecond.trim(),
      source_text: newPrecond.trim()
    };
    const updated = [...preconditions, guard];
    setPreconditions(updated);
    setNewPrecond('');
    if (node) {
      onUpdateNode({ ...node, preconditions: updated });
    }
  };

  const removePrecondition = (index: number) => {
    const updated = preconditions.filter((_, i) => i !== index);
    setPreconditions(updated);
    if (node) {
      onUpdateNode({ ...node, preconditions: updated });
    }
  };

  const addPostcondition = () => {
    if (!newPostcond.trim()) return;
    const updated = [...postconditions, newPostcond.trim()];
    setPostconditions(updated);
    setNewPostcond('');
    if (node) {
      onUpdateNode({
        ...node,
        metadata: { ...(node.metadata || {}), postconditions: updated }
      });
    }
  };

  const removePostcondition = (index: number) => {
    const updated = postconditions.filter((_, i) => i !== index);
    setPostconditions(updated);
    if (node) {
      onUpdateNode({
        ...node,
        metadata: { ...(node.metadata || {}), postconditions: updated }
      });
    }
  };

  // Get distinct roles from dictionary
  const availableRoles = rulesConfig
    ? Array.from(new Set(Object.values(rulesConfig.role_resolution.role_dictionary))).map(
        (id) =>
          id
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
      )
    : ['Finance Manager', 'Procurement Officer', 'Team Lead', 'Department Manager', 'CFO', 'Compliance Officer', 'Security Lead', 'System Administrator', 'Employee'];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[380px] bg-slate-900/95 border-l border-white/10 shadow-2xl backdrop-blur-2xl z-40 flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              {node ? 'Node Inspector & Editor' : 'Edge Inspector'}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              ID: {node?.id || edge?.id}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs text-slate-300">
        {node ? (
          <>
            {/* Action Title / Label */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Action Name / Label
              </label>
              <textarea
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={handleSaveNode}
                rows={2}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-slate-100 font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none"
                placeholder="Describe the action or check..."
              />
            </div>

            {/* Node Type Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Node Type
              </label>
              <select
                value={nodeType}
                onChange={(e) => {
                  setNodeType(e.target.value as NodeType);
                  if (node) onUpdateNode({ ...node, type: e.target.value as NodeType });
                }}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-slate-100 font-medium focus:border-indigo-500 outline-none transition-all"
              >
                <option value="start">START (Initiation point)</option>
                <option value="task">TASK (Operational step)</option>
                <option value="decision">DECISION GATE (Conditional fork)</option>
                <option value="approval">HUMAN APPROVAL (Sign-off gate)</option>
                <option value="external_call">SERVICE INTEGRATION (API/ERP ticket)</option>
                <option value="parallel_split">PARALLEL FORK (Split gateway)</option>
                <option value="parallel_join">PARALLEL JOIN (Converge gateway)</option>
                <option value="end">END (Completion point)</option>
              </select>
            </div>

            {/* Actor Assignment */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-indigo-400 uppercase tracking-wider text-[11px]">
                <UserCheck className="w-4 h-4" />
                <span>Organizational Actor & IAM Role</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Assigned IAM Role (Dictionary)
                </label>
                <input
                  type="text"
                  list="role-options"
                  value={actorRole}
                  onChange={(e) => setActorRole(e.target.value)}
                  onBlur={handleSaveNode}
                  placeholder="Select or enter role..."
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-indigo-500"
                />
                <datalist id="role-options">
                  {availableRoles.map((r, i) => (
                    <option key={i} value={r} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Department / Unit (Optional)
                </label>
                <input
                  type="text"
                  value={actorDept}
                  onChange={(e) => setActorDept(e.target.value)}
                  onBlur={handleSaveNode}
                  placeholder="e.g. Finance, IT, Operations"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Authorization & Permissions */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Required Permission</span>
                </div>
                <input
                  type="checkbox"
                  checked={hasAuth}
                  onChange={(e) => {
                    setHasAuth(e.target.checked);
                    if (!e.target.checked && node) {
                      onUpdateNode({ ...node, required_authorization: undefined });
                    }
                  }}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {hasAuth && (
                <input
                  type="text"
                  value={requiredAuth}
                  onChange={(e) => setRequiredAuth(e.target.value)}
                  onBlur={handleSaveNode}
                  placeholder="e.g. approve_procurement, verify_vendor"
                  className="w-full bg-slate-900 border border-amber-500/30 rounded-lg p-2 text-amber-300 font-mono outline-none focus:border-amber-500"
                />
              )}
            </div>

            {/* NLP Confidence Override Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  NLP Confidence Override
                </label>
                <span className="font-mono font-bold text-indigo-400">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={confidence}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setConfidence(val);
                  if (node) onUpdateNode({ ...node, confidence: val });
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span className="text-rose-400">0% (Blocking &lt;60%)</span>
                <span className="text-amber-400">75% (Warning)</span>
                <span className="text-emerald-400">100% (Verified)</span>
              </div>
            </div>

            {/* Preconditions / Guards */}
            <div>
              <label className="block text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Preconditions & Guards
              </label>
              <div className="space-y-1.5 mb-2">
                {preconditions.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/40"
                  >
                    <span className="font-mono text-[11px] text-cyan-300">
                      {g.expression}
                    </span>
                    <button
                      onClick={() => removePrecondition(idx)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPrecond}
                  onChange={(e) => setNewPrecond(e.target.value)}
                  placeholder="e.g. amount > 10000"
                  className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono outline-none focus:border-cyan-500"
                />
                <button
                  onClick={addPrecondition}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Postconditions / State outputs */}
            <div>
              <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Output State / Postconditions
              </label>
              <div className="space-y-1.5 mb-2">
                {postconditions.map((post, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40"
                  >
                    <span className="font-mono text-[11px] text-emerald-300">
                      {post}
                    </span>
                    <button
                      onClick={() => removePostcondition(idx)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPostcond}
                  onChange={(e) => setNewPostcond(e.target.value)}
                  placeholder="e.g. vendor_verified"
                  className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono outline-none focus:border-emerald-500"
                />
                <button
                  onClick={addPostcondition}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Raw NL Clause Traceability */}
            {node.source_text && (
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  Derived Natural-Language Clause
                </span>
                <p className="text-slate-300 italic">"{node.source_text}"</p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Offset span: [{node.source_span[0]}, {node.source_span[1]}]
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
              {onAddBranch && node.type === 'decision' && (
                <button
                  onClick={() => onAddBranch(node.id)}
                  className="flex-1 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/50 text-cyan-300 font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <GitBranch className="w-3.5 h-3.5" /> Add Branch
                </button>
              )}
              {onDuplicateNode && (
                <button
                  onClick={() => onDuplicateNode(node.id)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Duplicate
                </button>
              )}
              {onDeleteNode && (
                <button
                  onClick={() => onDeleteNode(node.id)}
                  className="py-2 px-3 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </>
        ) : edge ? (
          <>
            {/* Edge Editing */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-3">
              <div className="flex items-center gap-1.5 font-bold text-indigo-400 uppercase tracking-wider text-[11px]">
                <GitBranch className="w-4 h-4" />
                <span>Transition Edge Configuration</span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Edge Display Label
                </label>
                <input
                  type="text"
                  value={edgeLabel}
                  onChange={(e) => setEdgeLabel(e.target.value)}
                  onBlur={handleSaveEdge}
                  placeholder="e.g. Yes, No, Otherwise"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-slate-100 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Guard Condition Formula
                </label>
                <input
                  type="text"
                  value={edgeGuardExpr}
                  onChange={(e) => setEdgeGuardExpr(e.target.value)}
                  onBlur={handleSaveEdge}
                  placeholder="e.g. amount > 10000"
                  className="w-full bg-slate-900 border border-cyan-500/30 font-mono text-cyan-300 rounded-lg p-2 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => onDeleteEdge && onDeleteEdge(edge.id)}
                  className="w-full py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/50 text-rose-300 font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Transition Edge
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
