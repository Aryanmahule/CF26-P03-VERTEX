import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Play,
  SquareCheck,
  GitFork,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Flag,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Layers,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { WorkflowNode, NodeType } from '../types';

interface CustomNodeData {
  node: WorkflowNode;
  isActiveSimulationStep?: boolean;
  hasErrors?: boolean;
  hasWarnings?: boolean;
  layoutMode?: 'tree' | 'radial';
  onSelectNode?: (node: WorkflowNode) => void;
}

export const WorkflowNodeComponent: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const node: WorkflowNode = data.node;
  const isActive = data.isActiveSimulationStep;
  const hasErrors = data.hasErrors;
  const hasWarnings = data.hasWarnings;
  const layoutMode = data.layoutMode || 'tree';

  const getNodeTheme = () => {
    switch (node.type) {
      case 'start':
        return {
          gradient: 'from-emerald-950/90 via-slate-900/90 to-emerald-950/40',
          border: 'border-emerald-500/50',
          accentStrip: 'bg-gradient-to-b from-emerald-400 to-teal-500',
          glow: 'shadow-[0_0_25px_rgba(16,185,129,0.35)]',
          icon: <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />,
          badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          typeLabel: 'START'
        };
      case 'end':
        return {
          gradient: 'from-rose-950/90 via-slate-900/90 to-rose-950/40',
          border: 'border-rose-500/50',
          accentStrip: 'bg-gradient-to-b from-rose-400 to-red-500',
          glow: 'shadow-[0_0_25px_rgba(244,63,94,0.35)]',
          icon: <Flag className="w-4 h-4 text-rose-400 fill-rose-400" />,
          badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
          typeLabel: 'END'
        };
      case 'decision':
        return {
          gradient: 'from-cyan-950/90 via-slate-900/90 to-cyan-950/40',
          border: 'border-cyan-500/50',
          accentStrip: 'bg-gradient-to-b from-cyan-400 to-blue-500',
          glow: 'shadow-[0_0_25px_rgba(6,182,212,0.35)]',
          icon: <GitFork className="w-4 h-4 text-cyan-400" />,
          badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          typeLabel: 'DECISION GATE'
        };
      case 'approval':
        return {
          gradient: 'from-amber-950/90 via-slate-900/90 to-amber-950/40',
          border: 'border-amber-500/50',
          accentStrip: 'bg-gradient-to-b from-amber-400 to-orange-500',
          glow: 'shadow-[0_0_25px_rgba(245,158,11,0.35)]',
          icon: <UserCheck className="w-4 h-4 text-amber-400" />,
          badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          typeLabel: 'HUMAN APPROVAL'
        };
      case 'external_call':
        return {
          gradient: 'from-violet-950/90 via-slate-900/90 to-violet-950/40',
          border: 'border-violet-500/50',
          accentStrip: 'bg-gradient-to-b from-violet-400 to-purple-500',
          glow: 'shadow-[0_0_25px_rgba(139,92,246,0.35)]',
          icon: <ExternalLink className="w-4 h-4 text-violet-400" />,
          badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
          typeLabel: 'SERVICE INTEGRATION'
        };
      case 'parallel_split':
      case 'parallel_join':
        return {
          gradient: 'from-fuchsia-950/90 via-slate-900/90 to-fuchsia-950/40',
          border: 'border-fuchsia-500/50',
          accentStrip: 'bg-gradient-to-b from-fuchsia-400 to-pink-500',
          glow: 'shadow-[0_0_25px_rgba(217,70,239,0.35)]',
          icon: <Layers className="w-4 h-4 text-fuchsia-400" />,
          badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
          typeLabel: node.type === 'parallel_split' ? 'PARALLEL FORK' : 'PARALLEL JOIN'
        };
      default:
        return {
          gradient: 'from-indigo-950/90 via-slate-900/90 to-slate-950/40',
          border: 'border-indigo-500/40',
          accentStrip: 'bg-gradient-to-b from-indigo-400 to-blue-500',
          glow: 'shadow-[0_0_25px_rgba(99,102,241,0.35)]',
          icon: <SquareCheck className="w-4 h-4 text-indigo-400" />,
          badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
          typeLabel: 'TASK'
        };
    }
  };

  const theme = getNodeTheme();
  const confidence = node.confidence ?? 1.0;
  const confPercent = Math.round(confidence * 100);

  // Confidence ring styling
  const confColor =
    confPercent >= 85 ? '#10b981' : confPercent >= 60 ? '#f59e0b' : '#ef4444';
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confPercent / 100) * circumference;

  return (
    <div
      onClick={() => data.onSelectNode && data.onSelectNode(node)}
      style={{ minWidth: 260, maxWidth: 320 }}
      className={`group relative rounded-2xl p-4 bg-gradient-to-br ${theme.gradient} backdrop-blur-xl border ${
        theme.border
      } transition-all duration-300 shadow-xl cursor-pointer select-none ${
        selected
          ? 'ring-2 ring-indigo-400 border-indigo-400 ' + theme.glow
          : 'hover:border-white/30 hover:shadow-2xl'
      } ${isActive ? 'ring-2 ring-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse' : ''} ${
        hasErrors ? '!border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]' : ''
      }`}
    >
      {/* Left colored decorative strip */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full ${theme.accentStrip}`}
      />

      {/* Connection Handles */}
      {node.type !== 'start' && (
        <>
          <Handle
            type="target"
            position={Position.Top}
            id="target-top"
            className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950 !-top-1.5 transition-transform hover:scale-125"
          />
          <Handle
            type="target"
            position={Position.Left}
            id="target-left"
            className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950 !-left-1.5 transition-transform hover:scale-125"
          />
        </>
      )}

      {node.type !== 'end' && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="source-bottom"
            className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950 !-bottom-1.5 transition-transform hover:scale-125"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="source-right"
            className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-slate-950 !-right-1.5 transition-transform hover:scale-125"
          />
        </>
      )}

      {/* Active Simulation Step Badge */}
      {isActive && (
        <div className="absolute -top-3.5 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-lg shadow-emerald-500/40 animate-bounce">
          <Sparkles className="w-3.5 h-3.5 fill-slate-950" /> Step Active
        </div>
      )}

      {/* Error / Warning Badges */}
      {hasErrors && !isActive && (
        <div className="absolute -top-3 right-3 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-md shadow-rose-500/30">
          <AlertOctagon className="w-3 h-3" /> Error
        </div>
      )}
      {hasWarnings && !hasErrors && !isActive && (
        <div className="absolute -top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500/90 text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow-md shadow-amber-500/30">
          <AlertTriangle className="w-3 h-3" /> Flagged
        </div>
      )}

      {/* Card Header: Type Badge & Confidence Meter */}
      <div className="flex items-center justify-between gap-2 mb-2.5 pl-1.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900/80 border border-white/10 shadow-inner">
            {theme.icon}
          </div>
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${theme.badge}`}
          >
            {theme.typeLabel}
          </span>
        </div>

        {/* NLP Confidence SVG Progress Ring */}
        <div
          className="flex items-center gap-1 bg-slate-900/70 px-1.5 py-0.5 rounded-lg border border-white/5"
          title={`NLP Confidence: ${confPercent}%`}
        >
          <svg className="w-5 h-5 -rotate-90">
            <circle
              cx="10"
              cy="10"
              r={radius}
              stroke="#334155"
              strokeWidth="2.5"
              fill="none"
            />
            <circle
              cx="10"
              cy="10"
              r={radius}
              stroke={confColor}
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              className="transition-all duration-500"
            />
          </svg>
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: confColor }}
          >
            {confPercent}%
          </span>
        </div>
      </div>

      {/* Node Action Title / Label */}
      <div className="pl-1.5 text-sm font-semibold text-slate-100 leading-snug mb-2 line-clamp-2">
        {node.label}
      </div>

      {/* Chips: Role & Authorization */}
      <div className="pl-1.5 flex flex-wrap items-center gap-1.5 mb-1.5">
        {node.actor && (
          <div
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
              node.actor.role.toUpperCase() === 'UNRESOLVED'
                ? 'bg-rose-950/60 text-rose-300 border-rose-700/50'
                : 'bg-slate-800/90 text-indigo-300 border-indigo-500/30'
            }`}
          >
            <UserCheck className="w-3 h-3 text-indigo-400" />
            <span className="truncate max-w-[140px]" title={node.actor.role}>
              {node.actor.role}
            </span>
          </div>
        )}

        {node.required_authorization && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-700/40">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span className="truncate max-w-[120px]" title={node.required_authorization}>
              {node.required_authorization}
            </span>
          </div>
        )}
      </div>

      {/* Preconditions / Guards list */}
      {node.preconditions && node.preconditions.length > 0 && (
        <div className="pl-1.5 mt-2 pt-2 border-t border-white/10 flex flex-wrap gap-1">
          {node.preconditions.map((g, idx) => (
            <span
              key={idx}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 flex items-center gap-1 truncate max-w-full"
              title={g.expression}
            >
              <span className="text-cyan-400">⚡</span> {g.expression}
            </span>
          ))}
        </div>
      )}

      {/* Postconditions indicator if present */}
      {node.metadata?.postconditions && node.metadata.postconditions.length > 0 && (
        <div className="pl-1.5 mt-1.5 flex flex-wrap gap-1">
          {node.metadata.postconditions.map((post: string, idx: number) => (
            <span
              key={idx}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 flex items-center gap-1"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> {post}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
