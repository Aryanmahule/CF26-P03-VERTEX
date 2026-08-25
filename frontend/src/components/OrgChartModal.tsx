import React, { useState } from 'react';
import {
  Users,
  Shield,
  BookOpen,
  DollarSign,
  CheckCircle2,
  Lock,
  Building,
  Key
} from 'lucide-react';
import { OrgChart, GlossaryItem } from '../types';

interface OrgChartModalProps {
  orgChart: OrgChart | null;
  glossary: Record<string, GlossaryItem> | null;
}

export const OrgChartModal: React.FC<OrgChartModalProps> = ({ orgChart, glossary }) => {
  const [activeSubTab, setActiveSubTab] = useState<'roles' | 'glossary'>('roles');

  const roles = orgChart?.roles ? Object.values(orgChart.roles) : [];
  const glossaryList = glossary ? Object.values(glossary) : [];

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Enterprise Organizational Context & Domain Knowledge
            </h2>
            <p className="text-[11px] text-slate-400">
              IAM Roles, Authority Ceilings, RBAC Permissions, and Canonical Variable Glossary.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveSubTab('roles')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'roles'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>IAM Roles ({roles.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('glossary')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeSubTab === 'glossary'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Business Glossary ({glossaryList.length})</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSubTab === 'roles' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((role) => (
              <div
                key={role.id}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-100">{role.name}</h3>
                      <span className="text-[10px] text-indigo-400 font-medium">
                        Dept: {role.department}
                      </span>
                    </div>
                    {role.approval_limit !== undefined && role.approval_limit !== null ? (
                      <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        ${role.approval_limit.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        Unlimited
                      </span>
                    )}
                  </div>

                  {/* Permissions */}
                  <div className="mt-2 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      <span>Authorized Permissions:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((p, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-white/5"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {role.aliases && role.aliases.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-500">NLP Aliases: </span>
                    {role.aliases.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {glossaryList.map((item) => (
              <div
                key={item.term}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-white/5 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {item.term}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.2 rounded bg-slate-950 text-slate-400 border border-white/5">
                      {item.data_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {item.unit && (
                  <div className="mt-2 text-[10px] text-slate-400 font-mono">
                    Unit: {item.unit}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
