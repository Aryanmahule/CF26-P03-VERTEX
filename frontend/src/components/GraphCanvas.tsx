import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Connection,
  addEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
  LayoutGrid,
  Network,
  Maximize2,
  Plus,
  GitBranch,
  Copy,
  Trash2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType, LayoutMode } from '../types';
import { WorkflowNodeComponent } from './CustomNodes';

interface GraphCanvasProps {
  graph: WorkflowGraph | null;
  activeSimulationNodeId?: string | null;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onSelectNode?: (node: WorkflowNode | null) => void;
  onSelectEdge?: (edge: WorkflowEdge | null) => void;
  onUpdateGraph?: (graph: WorkflowGraph) => void;
  onAddNode?: (type: NodeType, afterNodeId?: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  errorNodeIds?: string[];
  warningNodeIds?: string[];
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (mode: LayoutMode) => void;
}

const nodeTypes: any = {
  workflowNode: WorkflowNodeComponent
};

interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
  isOpen: boolean;
}

const GraphCanvasInternal: React.FC<GraphCanvasProps> = ({
  graph,
  activeSimulationNodeId,
  selectedNodeId,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onUpdateGraph,
  onAddNode,
  onDeleteNode,
  onDuplicateNode,
  errorNodeIds = [],
  warningNodeIds = [],
  layoutMode = 'tree',
  onLayoutModeChange
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, isOpen: false });
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  
  const { fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);

  // 1. Compute Tree Layout via Dagre
  const computeTreeLayout = useCallback(
    (currentGraph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } => {
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));

      dagreGraph.setGraph({
        rankdir: 'TB',
        nodesep: 60,
        ranksep: 85,
        align: 'DL'
      });

      // Register nodes
      currentGraph.nodes.forEach((node) => {
        const width = node.type === 'decision' ? 290 : 280;
        const height = 135;
        dagreGraph.setNode(node.id, { width, height });
      });

      // Register edges
      currentGraph.edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      dagre.layout(dagreGraph);

      const layoutedNodes: Node[] = currentGraph.nodes.map((node) => {
        const pos = manualPositions[node.id] || {
          x: (dagreGraph.node(node.id)?.x || 200) - 140,
          y: (dagreGraph.node(node.id)?.y || 200) - 67
        };

        const isSelected = selectedNodeId === node.id;
        const isActive = activeSimulationNodeId === node.id;
        const hasError = errorNodeIds.includes(node.id);
        const hasWarning = warningNodeIds.includes(node.id);

        return {
          id: node.id,
          type: 'workflowNode',
          position: pos,
          data: {
            node,
            isActiveSimulationStep: isActive,
            hasErrors: hasError,
            hasWarnings: hasWarning,
            layoutMode: 'tree',
            onSelectNode: (selected: WorkflowNode) => onSelectNode && onSelectNode(selected)
          },
          selected: isSelected
        };
      });

      const layoutedEdges = formatEdges(currentGraph, activeSimulationNodeId, selectedEdgeId);
      return { nodes: layoutedNodes, edges: layoutedEdges };
    },
    [manualPositions, selectedNodeId, selectedEdgeId, activeSimulationNodeId, errorNodeIds, warningNodeIds, onSelectNode]
  );

  // 2. Compute Radial / Depth Layout
  const computeRadialLayout = useCallback(
    (currentGraph: WorkflowGraph): { nodes: Node[]; edges: Edge[] } => {
      // Find start node
      const startNode = currentGraph.nodes.find((n) => n.type === 'start') || currentGraph.nodes[0];
      if (!startNode) return computeTreeLayout(currentGraph);

      // Compute BFS depth levels
      const depthMap: Record<string, number> = {};
      const childrenMap: Record<string, string[]> = {};
      
      currentGraph.nodes.forEach((n) => {
        childrenMap[n.id] = [];
      });
      currentGraph.edges.forEach((e) => {
        if (childrenMap[e.source]) childrenMap[e.source].push(e.target);
      });

      // BFS queue
      const queue: Array<{ id: string; depth: number }> = [{ id: startNode.id, depth: 0 }];
      const visited = new Set<string>([startNode.id]);
      depthMap[startNode.id] = 0;

      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        const children = childrenMap[id] || [];
        for (const childId of children) {
          if (!visited.has(childId)) {
            visited.add(childId);
            depthMap[childId] = depth + 1;
            queue.push({ id: childId, depth: depth + 1 });
          }
        }
      }

      // Group by depth
      const levelNodes: Record<number, WorkflowNode[]> = {};
      currentGraph.nodes.forEach((node) => {
        const d = depthMap[node.id] || 1;
        if (!levelNodes[d]) levelNodes[d] = [];
        levelNodes[d].push(node);
      });

      const centerX = 450;
      const centerY = 350;
      const ringRadiusStep = 180;

      const layoutedNodes: Node[] = currentGraph.nodes.map((node) => {
        const depth = depthMap[node.id] || 0;
        let pos = manualPositions[node.id];

        if (!pos) {
          if (depth === 0) {
            pos = { x: centerX - 140, y: centerY - 67 };
          } else {
            const nodesInLevel = levelNodes[depth] || [node];
            const index = nodesInLevel.findIndex((n) => n.id === node.id);
            const total = nodesInLevel.length;
            const radius = depth * ringRadiusStep;
            
            // Angle range from -PI/3 to 4*PI/3 spread evenly
            const angleStep = Math.PI / (total + 1);
            const angle = Math.PI / 2 - (total * angleStep) / 2 + (index + 0.5) * angleStep;

            pos = {
              x: centerX + radius * Math.cos(angle) - 140,
              y: centerY + radius * Math.sin(angle) - 67
            };
          }
        }

        const isSelected = selectedNodeId === node.id;
        const isActive = activeSimulationNodeId === node.id;
        const hasError = errorNodeIds.includes(node.id);
        const hasWarning = warningNodeIds.includes(node.id);

        return {
          id: node.id,
          type: 'workflowNode',
          position: pos,
          data: {
            node,
            isActiveSimulationStep: isActive,
            hasErrors: hasError,
            hasWarnings: hasWarning,
            layoutMode: 'radial',
            onSelectNode: (selected: WorkflowNode) => onSelectNode && onSelectNode(selected)
          },
          selected: isSelected
        };
      });

      const layoutedEdges = formatEdges(currentGraph, activeSimulationNodeId, selectedEdgeId);
      return { nodes: layoutedNodes, edges: layoutedEdges };
    },
    [computeTreeLayout, manualPositions, selectedNodeId, selectedEdgeId, activeSimulationNodeId, errorNodeIds, warningNodeIds, onSelectNode]
  );

  // Helper to format styled edges with badges
  const formatEdges = (
    currentGraph: WorkflowGraph,
    activeSimId?: string | null,
    selectedEdge?: string | null
  ): Edge[] => {
    return currentGraph.edges.map((edge) => {
      const hasGuard = edge.guard && edge.guard.expression;
      const isSimActive = activeSimId === edge.source;
      const isEdgeSelected = selectedEdge === edge.id;
      const labelText = hasGuard ? edge.guard?.expression : (edge.label || undefined);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'smoothstep',
        label: labelText,
        animated: isSimActive || !!hasGuard,
        selected: isEdgeSelected,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: isSimActive ? '#10b981' : isEdgeSelected ? '#818cf8' : '#64748b'
        },
        style: {
          stroke: isSimActive ? '#10b981' : isEdgeSelected ? '#818cf8' : '#475569',
          strokeWidth: isSimActive || isEdgeSelected ? 3 : 2,
          strokeDasharray: hasGuard ? '5,5' : undefined
        },
        labelStyle: {
          fill: '#93c5fd',
          fontWeight: 700,
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace'
        },
        labelBgStyle: {
          fill: '#090d16',
          fillOpacity: 0.95,
          rx: 8,
          ry: 8,
          stroke: isEdgeSelected ? '#818cf8' : hasGuard ? '#0284c7' : '#1e293b',
          strokeWidth: 1.5
        },
        labelBgPadding: [8, 5] as [number, number]
      };
    });
  };

  // Recompute layout when graph or layout mode changes
  const applyLayout = useCallback(
    (mode: LayoutMode = layoutMode) => {
      if (!graph || graph.nodes.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }
      const { nodes: layoutedNodes, edges: layoutedEdges } =
        mode === 'radial' ? computeRadialLayout(graph) : computeTreeLayout(graph);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    },
    [graph, layoutMode, computeRadialLayout, computeTreeLayout, setNodes, setEdges, fitView]
  );

  useEffect(() => {
    applyLayout(layoutMode);
  }, [graph, layoutMode, applyLayout]);

  // Handle Dragging
  const handleNodeDragStop = useCallback(
    (_: any, node: Node) => {
      setManualPositions((prev) => ({
        ...prev,
        [node.id]: node.position
      }));
    },
    []
  );

  // Handle Edge Click
  const handleEdgeClick = useCallback(
    (_: any, edge: Edge) => {
      if (graph) {
        const found = graph.edges.find((e) => e.id === edge.id);
        if (found && onSelectEdge) onSelectEdge(found);
      }
    },
    [graph, onSelectEdge]
  );

  // Connect new edge
  const handleConnect = useCallback(
    (params: Connection) => {
      if (!graph || !params.source || !params.target) return;
      const newEdge: WorkflowEdge = {
        id: `edge_${params.source}_${params.target}_${Date.now().toString().slice(-4)}`,
        source: params.source,
        target: params.target,
        confidence: 1.0
      };
      const updatedEdges = [...graph.edges, newEdge];
      if (onUpdateGraph) {
        onUpdateGraph({ ...graph, edges: updatedEdges });
      }
    },
    [graph, onUpdateGraph]
  );

  // Context Menu Handlers
  const handleContextMenu = (e: React.MouseEvent, nodeId?: string, edgeId?: string) => {
    e.preventDefault();
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        nodeId,
        edgeId,
        isOpen: true
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div
      ref={canvasRef}
      onClick={closeContextMenu}
      onContextMenu={(e) => handleContextMenu(e)}
      className="relative w-full h-full glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col select-none"
      style={{ width: '100%', height: '100%', minHeight: '520px' }}
    >
      {/* Top Floating Graph Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl">
        <span className="text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent px-2">
          Interactive IR Graph
        </span>
        <div className="h-4 w-px bg-white/15" />

        {/* Layout Switcher */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-white/10">
          <button
            onClick={() => {
              if (onLayoutModeChange) onLayoutModeChange('tree');
              applyLayout('tree');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              layoutMode === 'tree'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tree Hierarchical Layout (Branches spread left/right)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Tree</span>
          </button>
          <button
            onClick={() => {
              if (onLayoutModeChange) onLayoutModeChange('radial');
              applyLayout('radial');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              layoutMode === 'radial'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Radial Depth Layout (Force-directed from Start node)"
          >
            <Network className="w-3.5 h-3.5" />
            <span>Radial</span>
          </button>
        </div>

        <div className="h-4 w-px bg-white/15" />

        {/* Reset Layout */}
        <button
          onClick={() => {
            setManualPositions({});
            applyLayout(layoutMode);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
          title="Auto-arrange nodes"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Auto Layout</span>
        </button>

        {/* Zoom to fit */}
        <button
          onClick={() => fitView({ padding: 0.2, duration: 400 })}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
          title="Fit view to graph"
        >
          <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Fit View</span>
        </button>
      </div>

      {/* Quick Insert Floating Toolbar (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl">
        <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">
          Insert Node:
        </span>
        <button
          onClick={() => onAddNode && onAddNode('task', selectedNodeId || undefined)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Task
        </button>
        <button
          onClick={() => onAddNode && onAddNode('decision', selectedNodeId || undefined)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 text-xs font-medium transition-all"
        >
          <GitBranch className="w-3.5 h-3.5" /> Decision Gate
        </button>
        <button
          onClick={() => onAddNode && onAddNode('approval', selectedNodeId || undefined)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/50 text-xs font-medium transition-all"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Approval
        </button>
      </div>

      {/* Custom Context Menu */}
      {contextMenu.isOpen && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="absolute z-50 min-w-[190px] rounded-xl bg-slate-900/95 border border-white/15 p-1.5 shadow-2xl backdrop-blur-2xl text-slate-200 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.nodeId ? (
            <>
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1">
                Node Actions
              </div>
              <button
                onClick={() => {
                  onAddNode && onAddNode('task', contextMenu.nodeId);
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Step After
              </button>
              <button
                onClick={() => {
                  onAddNode && onAddNode('decision', contextMenu.nodeId);
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-600 hover:text-white flex items-center gap-2"
              >
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> Add Branch
              </button>
              <button
                onClick={() => {
                  onDuplicateNode && onDuplicateNode(contextMenu.nodeId!);
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-700 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" /> Duplicate Node
              </button>
              <div className="my-1 border-t border-white/10" />
              <button
                onClick={() => {
                  onDeleteNode && onDeleteNode(contextMenu.nodeId!);
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Node
              </button>
            </>
          ) : (
            <>
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1">
                Add to Canvas
              </div>
              <button
                onClick={() => {
                  onAddNode && onAddNode('task');
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" /> Add Task Node
              </button>
              <button
                onClick={() => {
                  onAddNode && onAddNode('decision');
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-cyan-600 hover:text-white flex items-center gap-2"
              >
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" /> Add Decision Gate
              </button>
              <button
                onClick={() => {
                  onAddNode && onAddNode('approval');
                  closeContextMenu();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-amber-600 hover:text-white flex items-center gap-2"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Add Approval Step
              </button>
            </>
          )}
        </div>
      )}

      {/* React Flow Canvas Engine */}
      <div className="flex-1 w-full h-full relative" style={{ width: '100%', height: '100%', minHeight: '480px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onEdgeClick={handleEdgeClick}
          onConnect={handleConnect}
          onNodeContextMenu={(e, node) => handleContextMenu(e, node.id)}
          onEdgeContextMenu={(e, edge) => handleContextMenu(e, undefined, edge.id)}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.15}
          maxZoom={2.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="#334155" />
          <Controls className="!bg-slate-900 !border-white/15 !text-slate-300 !rounded-xl !overflow-hidden !shadow-2xl" />
          <MiniMap
            nodeColor={(n: any) => {
              const type = n.data?.node?.type;
              if (type === 'start') return '#10b981';
              if (type === 'end') return '#f43f5e';
              if (type === 'approval') return '#f59e0b';
              if (type === 'decision') return '#06b6d4';
              if (type === 'external_call') return '#8b5cf6';
              return '#6366f1';
            }}
            maskColor="rgba(15, 23, 42, 0.8)"
            className="!bg-slate-950 !border !border-white/15 !rounded-xl !shadow-2xl"
          />
        </ReactFlow>
      </div>
    </div>
  );
};

export const GraphCanvas: React.FC<GraphCanvasProps> = (props) => (
  <ReactFlowProvider>
    <GraphCanvasInternal {...props} />
  </ReactFlowProvider>
);
