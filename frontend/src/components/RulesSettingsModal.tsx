import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Shield,
  UserCheck,
  Zap,
  AlertTriangle,
  FileCode,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  DollarSign
} from 'lucide-react';
import { RulesConfig } from '../types';

interface RulesSettingsModalProps {
  isOpen: boolean;
  rules: RulesConfig | null;
  onClose: () => void;
  onSave: (updatedRules: RulesConfig) => void;
}

export const RulesSettingsModal: React.FC<RulesSettingsModalProps> = ({
  isOpen,
  rules,
  onClose,
  onSave
}) => {
  if (!isOpen || !rules) return null;

  const [activeTab, setActiveTab] = useState<'visual' | 'json'>('visual');
  const [localRules, setLocalRules] = useState<RulesConfig>(JSON.parse(JSON.stringify(rules)));
  const [jsonText, setJsonText] = useState(JSON.stringify(rules, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  // New item draft inputs
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleVal, setNewRoleVal] = useState('');
  const [newVagueTerm, setNewVagueTerm] = useState('');

  useEffect(() => {
    setLocalRules(JSON.parse(JSON.stringify(rules)));
    setJsonText(JSON.stringify(rules, null, 2));
  }, [rules]);

  const handleSave = () => {
    if (activeTab === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        setLocalRules(parsed);
        onSave(parsed);
        onClose();
      } catch (err: any) {
        setJsonError('Invalid JSON format: ' + err.message);
      }
    } else {
      onSave(localRules);
      onClose();
    }
  };

  const handleAddRoleMapping = () => {
    if (!newRoleKey.trim() || !newRoleVal.trim()) return;
    setLocalRules((prev) => ({
      ...prev,
      role_resolution: {
        ...prev.role_resolution,
        role_dictionary: {
          ...prev.role_resolution.role_dictionary,
          [newRoleKey.trim().toLowerCase()]: newRoleVal.trim().toLowerCase().replace(/\s+/g, '_')
        }
      }
    }));
    setNewRoleKey('');
    setNewRoleVal('');
  };

  const handleRemoveRoleMapping = (key: string) => {
    setLocalRules((prev) => {
      const copy = { ...prev.role_resolution.role_dictionary };
      delete copy[key];
      return {
        ...prev,
        role_resolution: { ...prev.role_resolution, role_dictionary: copy }
      };
    });
  };

  const handleAddVagueTerm = () => {
    if (!newVagueTerm.trim()) return;
    setLocalRules((prev) => ({
      ...prev,
      ambiguity_and_confidence: {
        ...prev.ambiguity_and_confidence,
        vague_terms: [...prev.ambiguity_and_confidence.vague_terms, newVagueTerm.trim().toLowerCase()]
      }
    }));
    setNewVagueTerm('');
  };

  const handleRemoveVagueTerm = (index: number) => {
    setLocalRules((prev) => ({
      ...prev,
      ambiguity_and_confidence: {
        ...prev.ambiguity_and_confidence,
        vague_terms: prev.ambiguity_and_confidence.vague_terms.filter((_, i) => i !== index)
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Compiler Rules & Governance Parameters
              </h2>
              <p className="text-xs text-slate-400">
                Configure policy-as-code rules, thresholds, and role resolution dictionary stored in{' '}
                <code className="text-indigo-300 font-mono">rules_config.json</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => {
                  setActiveTab('visual');
                  setJsonError(null);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'visual'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Visual Config
              </button>
              <button
                onClick={() => {
                  setActiveTab('json');
                  setJsonText(JSON.stringify(localRules, null, 2));
                  setJsonError(null);
                }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  activeTab === 'json'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Raw JSON
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs text-slate-300">
          {activeTab === 'json' ? (
            <div className="space-y-2">
              {jsonError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>{jsonError}</span>
                </div>
              )}
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={18}
                className="w-full bg-slate-950 font-mono text-xs text-cyan-300 p-4 rounded-xl border border-white/10 focus:border-indigo-500 outline-none resize-none leading-relaxed"
              />
            </div>
          ) : (
            <>
              {/* 1. Confidence & Ambiguity Thresholds */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-300">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span>Ambiguity & NLP Confidence Thresholds</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">
                        Hard Blocking Threshold (Deploy Prevented)
                      </span>
                      <span className="font-mono font-bold text-rose-400">
                        &lt;{Math.round(localRules.ambiguity_and_confidence.blocking_confidence_threshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="0.8"
                      step="0.05"
                      value={localRules.ambiguity_and_confidence.blocking_confidence_threshold}
                      onChange={(e) =>
                        setLocalRules((prev) => ({
                          ...prev,
                          ambiguity_and_confidence: {
                            ...prev.ambiguity_and_confidence,
                            blocking_confidence_threshold: parseFloat(e.target.value)
                          }
                        }))
                      }
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">
                        Warning Flag Threshold (Requires Review)
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        &lt;{Math.round(localRules.ambiguity_and_confidence.warning_confidence_threshold * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="0.95"
                      step="0.05"
                      value={localRules.ambiguity_and_confidence.warning_confidence_threshold}
                      onChange={(e) =>
                        setLocalRules((prev) => ({
                          ...prev,
                          ambiguity_and_confidence: {
                            ...prev.ambiguity_and_confidence,
                            warning_confidence_threshold: parseFloat(e.target.value)
                          }
                        }))
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Vague Terms List */}
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">
                    Vague / Qualitative Terms Glossary (Triggering Flagged Remediation)
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {localRules.ambiguity_and_confidence.vague_terms.map((term, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-200 flex items-center gap-1.5"
                      >
                        <span>{term}</span>
                        <button
                          onClick={() => handleRemoveVagueTerm(i)}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      value={newVagueTerm}
                      onChange={(e) => setNewVagueTerm(e.target.value)}
                      placeholder="Add vague term (e.g. soon)..."
                      className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={handleAddVagueTerm}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Segregation of Duties (SoD) & Spend Tiers */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-4">
                <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Segregation of Duties (SoD) & Spend Threshold Tiers</span>
                </div>

                <div>
                  <h4 className="text-slate-400 font-semibold mb-2">Incompatible Action Pairs (SoD)</h4>
                  <div className="space-y-2">
                    {localRules.authorization.segregation_of_duties.map((sod) => (
                      <div
                        key={sod.id}
                        className="p-3 rounded-lg bg-slate-900 border border-amber-500/20 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-100">{sod.name}</div>
                          <div className="text-[11px] text-slate-400">{sod.description}</div>
                          <div className="text-[10px] font-mono text-amber-300 mt-1">
                            Action A: <span className="underline">{sod.action_a}</span> ⚡ Action B:{' '}
                            <span className="underline">{sod.action_b}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spend Tiers */}
                <div>
                  <h4 className="text-slate-400 font-semibold mb-2">Spend Approval Threshold Tiers</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {localRules.authorization.spend_threshold_tiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-900 border border-white/10 space-y-1"
                      >
                        <div className="font-bold text-indigo-300">{tier.tier}</div>
                        <div className="text-slate-200 font-mono">
                          ${tier.min_amount.toLocaleString()} – ${tier.max_amount.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Role: <span className="text-slate-200 font-medium">{tier.required_role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Role Resolution Dictionary */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-cyan-300">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <span>Enterprise Role Dictionary</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Map natural-language aliases to canonical IAM role identifiers.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {Object.entries(localRules.role_resolution.role_dictionary).map(([k, v]) => (
                    <div
                      key={k}
                      className="p-2 rounded-lg bg-slate-900 border border-white/5 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-slate-200 font-semibold">"{k}"</span>
                        <span className="text-slate-500 mx-1.5">→</span>
                        <span className="font-mono text-cyan-400">{v}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveRoleMapping(k)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={newRoleKey}
                    onChange={(e) => setNewRoleKey(e.target.value)}
                    placeholder="Alias (e.g. buyer)..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    value={newRoleVal}
                    onChange={(e) => setNewRoleVal(e.target.value)}
                    placeholder="Role ID (e.g. procurement_officer)..."
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-slate-200 outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={handleAddRoleMapping}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* 4. Graph Completeness Rules Toggles */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Graph Soundness & Completeness Guards</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localRules.branch_completeness.require_dual_branch_on_decision}
                      onChange={(e) =>
                        setLocalRules((prev) => ({
                          ...prev,
                          branch_completeness: {
                            ...prev.branch_completeness,
                            require_dual_branch_on_decision: e.target.checked
                          }
                        }))
                      }
                      className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">
                        Require Dual-Branch on Decision Gates
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Every condition must fork into at least 2 branches.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localRules.graph_validity.disallow_unbounded_cycles}
                      onChange={(e) =>
                        setLocalRules((prev) => ({
                          ...prev,
                          graph_validity: {
                            ...prev.graph_validity,
                            disallow_unbounded_cycles: e.target.checked
                          }
                        }))
                      }
                      className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <div>
                      <div className="font-semibold text-slate-200">
                        Block Unbounded Cycles
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Loops require bounded retry guards.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 border-t border-white/10 flex items-center justify-between bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Save className="w-4 h-4" /> Save Rules & Re-Verify
          </button>
        </div>
      </div>
    </div>
  );
};
