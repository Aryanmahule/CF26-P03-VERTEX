import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PolicyEditor } from './components/PolicyEditor';
import { GraphCanvas } from './components/GraphCanvas';
import { VerificationPanel } from './components/VerificationPanel';
import { AmbiguityDrawer } from './components/AmbiguityDrawer';
import { CompilerViewer } from './components/CompilerViewer';
import { SimulatorPanel } from './components/SimulatorPanel';
import { OrgChartModal } from './components/OrgChartModal';
import { NodeDetailDrawer } from './components/NodeDetailDrawer';
import { RulesSettingsModal } from './components/RulesSettingsModal';
import { DeployModal } from './components/DeployModal';
import { api } from './services/api';
import {
  PolicyPreset,
  WorkflowGraph,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  VerificationReport,
  TargetFormat,
  CompiledArtifact,
  SimulationResult,
  OrgChart,
  GlossaryItem,
  RulesConfig,
  LayoutMode
} from './types';

export function App() {
  const [presets, setPresets] = useState<PolicyPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('procurement_benchmark');
  const [policyText, setPolicyText] = useState<string>('');
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [compiledArtifacts, setCompiledArtifacts] = useState<Record<string, CompiledArtifact>>({});
  const [activeFormat, setActiveFormat] = useState<TargetFormat>('bpmn');
  const [activeTab, setActiveTab] = useState<'studio' | 'verification' | 'ambiguity' | 'compiler' | 'simulator' | 'org'>('studio');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('tree');

  // Rules Config state
  const [rulesConfig, setRulesConfig] = useState<RulesConfig | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);

  // Undo / Redo stacks
  const [historyStack, setHistoryStack] = useState<WorkflowGraph[]>([]);
  const [futureStack, setFutureStack] = useState<WorkflowGraph[]>([]);

  // Selected elements for detail drawer
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<WorkflowEdge | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const [orgChart, setOrgChart] = useState<OrgChart | null>(null);
  const [glossary, setGlossary] = useState<Record<string, GlossaryItem> | null>(null);

  const [payload, setPayload] = useState<Record<string, any>>({});
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const [highlightSpan, setHighlightSpan] = useState<[number, number] | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // 1. Initial Load: Fetch presets, rules, and org model
  useEffect(() => {
    async function init() {
      try {
        setIsProcessing(true);
        const [loadedPresets, orgData, loadedRules] = await Promise.all([
          api.fetchPresets(),
          api.fetchOrgModel(),
          api.fetchRules()
        ]);
        setPresets(loadedPresets);
        setOrgChart(orgData.org_chart);
        setGlossary(orgData.glossary);
        setRulesConfig(loadedRules);

        if (loadedPresets.length > 0) {
          const firstPreset = loadedPresets[0];
          setSelectedPresetId(firstPreset.id);
          setPolicyText(firstPreset.policy_text);
          setPayload(firstPreset.default_payload);

          // Parse initial preset
          const parseRes = await api.parsePolicy(firstPreset.policy_text);
          setGraph(parseRes.graph);
          setVerificationReport(parseRes.report);

          // Compile initial artifacts
          const compRes = await api.compileWorkflow(parseRes.graph);
          setCompiledArtifacts(compRes.artifacts);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsProcessing(false);
      }
    }
    init();
  }, []);

  // Helper to push state to history before edits
  const pushHistory = (currentGraph: WorkflowGraph) => {
    setHistoryStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(currentGraph))]);
    setFutureStack([]);
  };

  // Undo / Redo Handlers
  const handleUndo = useCallback(() => {
    if (historyStack.length === 0 || !graph) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setFutureStack((prev) => [JSON.parse(JSON.stringify(graph)), ...prev]);
    setGraph(previous);

    // Re-verify previous graph
    api.verifyWorkflow(previous).then((res) => {
      setVerificationReport(res.report);
      api.compileWorkflow(previous).then((c) => setCompiledArtifacts(c.artifacts));
    });
  }, [historyStack, graph]);

  const handleRedo = useCallback(() => {
    if (futureStack.length === 0 || !graph) return;
    const next = futureStack[0];
    setFutureStack((prev) => prev.slice(1));
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(graph))]);
    setGraph(next);

    // Re-verify next graph
    api.verifyWorkflow(next).then((res) => {
      setVerificationReport(res.report);
      api.compileWorkflow(next).then((c) => setCompiledArtifacts(c.artifacts));
    });
  }, [futureStack, graph]);

  // Keyboard shortcut listener for Undo (Ctrl+Z) / Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Preset switch handler
  const handleSelectPreset = async (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setPolicyText(found.policy_text);
      setPayload(found.default_payload);
      setSimulationResult(null);
      setCurrentStepIndex(0);
      setSelectedNode(null);
      setSelectedEdge(null);
      setIsDrawerOpen(false);
      setHighlightSpan(null);
      setHistoryStack([]);
      setFutureStack([]);

      try {
        setIsProcessing(true);
        const parseRes = await api.parsePolicy(found.policy_text);
        setGraph(parseRes.graph);
        setVerificationReport(parseRes.report);

        const compRes = await api.compileWorkflow(parseRes.graph);
        setCompiledArtifacts(compRes.artifacts);
      } catch (err) {
        console.error('Failed to parse selected preset:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Re-parse Policy Handler
  const handleParse = async () => {
    if (!policyText.trim()) return;
    try {
      setIsProcessing(true);
      setSimulationResult(null);
      setCurrentStepIndex(0);
      setSelectedNode(null);
      setSelectedEdge(null);
      setIsDrawerOpen(false);
      setHistoryStack([]);
      setFutureStack([]);

      const parseRes = await api.parsePolicy(policyText);
      setGraph(parseRes.graph);
      setVerificationReport(parseRes.report);

      const compRes = await api.compileWorkflow(parseRes.graph);
      setCompiledArtifacts(compRes.artifacts);
    } catch (err: any) {
      alert(`Parse Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Run full Compile & Verify
  const handleRunCompile = async () => {
    if (!graph) {
      await handleParse();
      return;
    }
    try {
      setIsProcessing(true);
      const verifyRes = await api.verifyWorkflow(graph);
      setVerificationReport(verifyRes.report);

      const compRes = await api.compileWorkflow(graph);
      setCompiledArtifacts(compRes.artifacts);
      setActiveTab('verification');
    } catch (err: any) {
      alert(`Compile Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Live Auto Re-verification helper
  const reVerifyGraph = async (updatedGraph: WorkflowGraph) => {
    try {
      const verifyRes = await api.verifyWorkflow(updatedGraph);
      setVerificationReport(verifyRes.report);
      const compRes = await api.compileWorkflow(updatedGraph);
      setCompiledArtifacts(compRes.artifacts);
    } catch (err) {
      console.error('Live re-verification error:', err);
    }
  };

  // Graph Node / Edge Mutations
  const handleUpdateNode = (updatedNode: WorkflowNode) => {
    if (!graph) return;
    pushHistory(graph);
    const updatedNodes = graph.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));
    const newGraph = { ...graph, nodes: updatedNodes };
    setGraph(newGraph);
    setSelectedNode(updatedNode);
    reVerifyGraph(newGraph);
  };

  const handleUpdateEdge = (updatedEdge: WorkflowEdge) => {
    if (!graph) return;
    pushHistory(graph);
    const updatedEdges = graph.edges.map((e) => (e.id === updatedEdge.id ? updatedEdge : e));
    const newGraph = { ...graph, edges: updatedEdges };
    setGraph(newGraph);
    setSelectedEdge(updatedEdge);
    reVerifyGraph(newGraph);
  };

  const handleAddNode = (type: NodeType, afterNodeId?: string) => {
    if (!graph) return;
    pushHistory(graph);

    const newNodeId = `node_${type}_${Date.now().toString().slice(-4)}`;
    const newNode: WorkflowNode = {
      id: newNodeId,
      type: type,
      label:
        type === 'task'
          ? 'New Task Action'
          : type === 'decision'
          ? 'Evaluate Condition'
          : type === 'approval'
          ? 'Manager Approval'
          : 'New Step',
      actor:
        type === 'approval'
          ? { role: 'Finance Manager', department: 'Finance', confidence: 1.0 }
          : { role: 'Employee', department: 'General', confidence: 1.0 },
      required_authorization: type === 'approval' ? 'approve_procurement' : undefined,
      source_span: [0, 0],
      source_text: 'Manual addition',
      confidence: 1.0
    };

    let updatedNodes = [...graph.nodes, newNode];
    let updatedEdges = [...graph.edges];

    if (afterNodeId) {
      // Find downstream edge of afterNodeId and rewire through newNode
      const outgoing = graph.edges.filter((e) => e.source === afterNodeId);
      if (outgoing.length === 1) {
        const oldTarget = outgoing[0].target;
        updatedEdges = updatedEdges.filter((e) => e.id !== outgoing[0].id);
        updatedEdges.push({
          id: `edge_${afterNodeId}_${newNodeId}`,
          source: afterNodeId,
          target: newNodeId,
          confidence: 1.0
        });
        updatedEdges.push({
          id: `edge_${newNodeId}_${oldTarget}`,
          source: newNodeId,
          target: oldTarget,
          confidence: 1.0
        });
      } else {
        updatedEdges.push({
          id: `edge_${afterNodeId}_${newNodeId}`,
          source: afterNodeId,
          target: newNodeId,
          confidence: 1.0
        });
      }
    }

    const newGraph = { ...graph, nodes: updatedNodes, edges: updatedEdges };
    setGraph(newGraph);
    setSelectedNode(newNode);
    setIsDrawerOpen(true);
    reVerifyGraph(newGraph);
  };

  const handleAddBranch = (decisionNodeId: string) => {
    if (!graph) return;
    pushHistory(graph);

    const branchTask: WorkflowNode = {
      id: `node_branch_${Date.now().toString().slice(-4)}`,
      type: 'task',
      label: 'Alternative Branch Action',
      actor: { role: 'Employee', department: 'General', confidence: 1.0 },
      source_span: [0, 0],
      confidence: 1.0
    };

    const endNode = graph.nodes.find((n) => n.type === 'end') || graph.nodes[graph.nodes.length - 1];

    const updatedNodes = [...graph.nodes, branchTask];
    const updatedEdges = [
      ...graph.edges,
      {
        id: `edge_${decisionNodeId}_${branchTask.id}`,
        source: decisionNodeId,
        target: branchTask.id,
        label: 'Alternative path',
        confidence: 1.0
      },
      {
        id: `edge_${branchTask.id}_${endNode.id}`,
        source: branchTask.id,
        target: endNode.id,
        confidence: 1.0
      }
    ];

    const newGraph = { ...graph, nodes: updatedNodes, edges: updatedEdges };
    setGraph(newGraph);
    setSelectedNode(branchTask);
    setIsDrawerOpen(true);
    reVerifyGraph(newGraph);
  };

  const handleDuplicateNode = (nodeId: string) => {
    if (!graph) return;
    const target = graph.nodes.find((n) => n.id === nodeId);
    if (!target) return;
    pushHistory(graph);

    const dupId = `node_dup_${Date.now().toString().slice(-4)}`;
    const duplicated: WorkflowNode = {
      ...JSON.parse(JSON.stringify(target)),
      id: dupId,
      label: `${target.label} (Copy)`
    };

    const newGraph = {
      ...graph,
      nodes: [...graph.nodes, duplicated]
    };
    setGraph(newGraph);
    setSelectedNode(duplicated);
    setIsDrawerOpen(true);
    reVerifyGraph(newGraph);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!graph) return;
    const target = graph.nodes.find((n) => n.id === nodeId);
    if (target?.type === 'start' || target?.type === 'end') {
      alert('Cannot delete START or END nodes.');
      return;
    }
    pushHistory(graph);

    const incoming = graph.edges.filter((e) => e.target === nodeId);
    const outgoing = graph.edges.filter((e) => e.source === nodeId);

    let updatedEdges = graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

    // Bridge incoming to outgoing if simple linear chain
    if (incoming.length === 1 && outgoing.length === 1) {
      updatedEdges.push({
        id: `edge_bridge_${incoming[0].source}_${outgoing[0].target}`,
        source: incoming[0].source,
        target: outgoing[0].target,
        guard: incoming[0].guard || outgoing[0].guard,
        label: incoming[0].label || outgoing[0].label,
        confidence: 1.0
      });
    }

    const updatedNodes = graph.nodes.filter((n) => n.id !== nodeId);
    const newGraph = { ...graph, nodes: updatedNodes, edges: updatedEdges };
    setGraph(newGraph);
    setSelectedNode(null);
    setIsDrawerOpen(false);
    reVerifyGraph(newGraph);
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!graph) return;
    pushHistory(graph);
    const updatedEdges = graph.edges.filter((e) => e.id !== edgeId);
    const newGraph = { ...graph, edges: updatedEdges };
    setGraph(newGraph);
    setSelectedEdge(null);
    setIsDrawerOpen(false);
    reVerifyGraph(newGraph);
  };

  // Ambiguity Resolution Handler
  const handleResolveAmbiguity = async (findingId: string, optionId: string) => {
    if (!graph) return;
    try {
      setIsProcessing(true);
      pushHistory(graph);
      const res = await api.resolveAmbiguity(graph, findingId, optionId);
      setGraph(res.graph);
      setVerificationReport(res.report);

      const compRes = await api.compileWorkflow(res.graph);
      setCompiledArtifacts(compRes.artifacts);
    } catch (err: any) {
      alert(`Resolution Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Rules update handler
  const handleSaveRules = async (updatedRules: RulesConfig) => {
    try {
      setIsProcessing(true);
      const saved = await api.updateRules(updatedRules);
      setRulesConfig(saved);
      if (graph) {
        await reVerifyGraph(graph);
      }
    } catch (err: any) {
      alert(`Failed to save rules: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Simulation Handlers
  const handleRunSimulation = async () => {
    if (!graph) return;
    try {
      setIsSimulating(true);
      const simRes = await api.simulateWorkflow(graph, payload, true);
      setSimulationResult(simRes);
      setCurrentStepIndex(0);
    } catch (err: any) {
      alert(`Simulation Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleNextStep = () => {
    if (simulationResult && currentStepIndex < simulationResult.trace.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleResetSimulation = () => {
    setSimulationResult(null);
    setCurrentStepIndex(0);
  };

  const activeSimulationNodeId =
    simulationResult && simulationResult.trace[currentStepIndex]
      ? simulationResult.trace[currentStepIndex].current_node_id
      : null;

  const errorNodeIds = (verificationReport?.checks || [])
    .filter((c) => !c.passed && (c.severity === 'error' || c.severity === 'critical') && c.node_id)
    .map((c) => c.node_id!);

  const warningNodeIds = (verificationReport?.ambiguities || [])
    .filter((a) => a.node_id)
    .map((a) => a.node_id!);

  const handleSelectNodeById = (nodeId: string) => {
    if (graph) {
      const found = graph.nodes.find((n) => n.id === nodeId);
      if (found) {
        setSelectedNode(found);
        setSelectedEdge(null);
        setIsDrawerOpen(true);
        if (found.source_span) {
          setHighlightSpan(found.source_span);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070a10] text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        presets={presets}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        verificationReport={verificationReport}
        ambiguityCount={verificationReport?.ambiguities?.length || 0}
        onRunCompile={handleRunCompile}
        isProcessing={isProcessing}
        canUndo={historyStack.length > 0}
        canRedo={futureStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenRulesModal={() => setIsRulesModalOpen(true)}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
      />

      {/* Main Studio Body */}
      <main className="flex-1 overflow-hidden p-3.5 relative" style={{ height: 'calc(100vh - 65px)' }}>
        {/* MODE 1: STUDIO & GRAPH (Default) */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-12 gap-3.5 h-full" style={{ height: '100%' }}>
            {/* Left Panel: Policy Editor (4 Cols) */}
            <div className="col-span-4 h-full flex flex-col" style={{ height: '100%' }}>
              <PolicyEditor
                policyText={policyText}
                onChangePolicyText={setPolicyText}
                onParse={handleParse}
                isProcessing={isProcessing}
                highlightSpan={highlightSpan}
              />
            </div>

            {/* Center/Right Panel: Interactive Branching Graph Canvas (8 Cols) */}
            <div className="col-span-8 h-full flex flex-col relative" style={{ height: '100%' }}>
              <GraphCanvas
                graph={graph}
                activeSimulationNodeId={activeSimulationNodeId}
                selectedNodeId={selectedNode?.id}
                selectedEdgeId={selectedEdge?.id}
                layoutMode={layoutMode}
                onLayoutModeChange={setLayoutMode}
                onSelectNode={(node) => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                  setIsDrawerOpen(!!node);
                  if (node && node.source_span) {
                    setHighlightSpan(node.source_span);
                  }
                }}
                onSelectEdge={(edge) => {
                  setSelectedEdge(edge);
                  setSelectedNode(null);
                  setIsDrawerOpen(!!edge);
                }}
                onUpdateGraph={(newGraph) => {
                  pushHistory(graph || newGraph);
                  setGraph(newGraph);
                  reVerifyGraph(newGraph);
                }}
                onAddNode={handleAddNode}
                onDeleteNode={handleDeleteNode}
                onDuplicateNode={handleDuplicateNode}
                errorNodeIds={errorNodeIds}
                warningNodeIds={warningNodeIds}
              />

              {/* Collapsible Node & Edge Detail Drawer */}
              <NodeDetailDrawer
                node={selectedNode}
                edge={selectedEdge}
                isOpen={isDrawerOpen}
                rulesConfig={rulesConfig}
                onClose={() => {
                  setIsDrawerOpen(false);
                  setSelectedNode(null);
                  setSelectedEdge(null);
                }}
                onUpdateNode={handleUpdateNode}
                onUpdateEdge={handleUpdateEdge}
                onDeleteNode={handleDeleteNode}
                onDeleteEdge={handleDeleteEdge}
                onDuplicateNode={handleDuplicateNode}
                onAddBranch={handleAddBranch}
              />
            </div>
          </div>
        )}

        {/* MODE 2: VERIFICATION & SMT INSPECTOR */}
        {activeTab === 'verification' && (
          <VerificationPanel
            report={verificationReport}
            graph={graph}
            onSelectNodeById={(id) => {
              handleSelectNodeById(id);
              setActiveTab('studio');
            }}
            onHighlightSpan={(span) => {
              setHighlightSpan(span);
              setActiveTab('studio');
            }}
          />
        )}

        {/* MODE 3: AMBIGUITY RESOLVER */}
        {activeTab === 'ambiguity' && (
          <AmbiguityDrawer
            ambiguities={verificationReport?.ambiguities || []}
            graph={graph}
            onResolve={handleResolveAmbiguity}
            isProcessing={isProcessing}
            onSelectNodeById={(id) => {
              handleSelectNodeById(id);
              setActiveTab('studio');
            }}
            onHighlightSpan={(span) => {
              setHighlightSpan(span);
              setActiveTab('studio');
            }}
          />
        )}

        {/* MODE 4: MULTI-TARGET COMPILER */}
        {activeTab === 'compiler' && (
          <CompilerViewer
            artifacts={compiledArtifacts}
            activeFormat={activeFormat}
            onChangeFormat={setActiveFormat}
          />
        )}

        {/* MODE 5: LIVE SIMULATOR */}
        {activeTab === 'simulator' && (
          <SimulatorPanel
            graph={graph}
            payload={payload}
            onChangePayload={setPayload}
            onRunSimulation={handleRunSimulation}
            simulationResult={simulationResult}
            currentStepIndex={currentStepIndex}
            onNextStep={handleNextStep}
            onResetSimulation={handleResetSimulation}
            isSimulating={isSimulating}
          />
        )}

        {/* MODE 6: ORG CHART & GLOSSARY */}
        {activeTab === 'org' && (
          <OrgChartModal orgChart={orgChart} glossary={glossary} />
        )}
      </main>

      {/* Rules & Governance Configuration Modal */}
      <RulesSettingsModal
        isOpen={isRulesModalOpen}
        rules={rulesConfig}
        onClose={() => setIsRulesModalOpen(false)}
        onSave={handleSaveRules}
      />

      {/* Deploy Workflow Modal */}
      <DeployModal
        isOpen={isDeployModalOpen}
        graph={graph}
        report={verificationReport}
        onClose={() => setIsDeployModalOpen(false)}
      />
    </div>
  );
}

export default App;
