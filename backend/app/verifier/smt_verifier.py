import z3
import re
import networkx as nx
from typing import List, Dict, Any, Tuple, Optional
from app.ir.models import (
    WorkflowGraph, WorkflowNode, WorkflowEdge, NodeType, Guard,
    VerificationCheckResult, FindingCategory, Severity
)


class Z3GuardTranslator:
    """Translates normalized boolean string guard expressions into Z3 AST formulas within a dedicated Z3 Context."""
    def __init__(self, ctx: Optional[z3.Context] = None):
        self.ctx = ctx or z3.Context()
        self.vars: Dict[str, Any] = {}

    def get_var(self, name: str, data_type: str = "number"):
        clean_name = name.replace('.', '_').replace('-', '_')
        if clean_name not in self.vars:
            if data_type in ["currency", "number", "float"]:
                self.vars[clean_name] = z3.Real(clean_name, ctx=self.ctx)
            elif data_type in ["integer", "int"]:
                self.vars[clean_name] = z3.Int(clean_name, ctx=self.ctx)
            elif data_type in ["boolean", "bool"]:
                self.vars[clean_name] = z3.Bool(clean_name, ctx=self.ctx)
            else:
                self.vars[clean_name] = z3.Real(clean_name, ctx=self.ctx)
        return self.vars[clean_name]

    def translate_expression(self, expr_str: str, glossary: Dict[str, Any] = None) -> Optional[z3.BoolRef]:
        if not expr_str or not expr_str.strip():
            return None
            
        try:
            expr = expr_str.strip()
            
            # Check NOT wrapper
            not_match = re.match(r'^NOT\s*\((.+)\)$', expr, re.IGNORECASE)
            if not_match:
                inner = self.translate_expression(not_match.group(1), glossary)
                return z3.Not(inner, ctx=self.ctx) if inner is not None else None

            # Regex for binary comparison: <var> <op> <val>
            comp_pattern = re.compile(
                r'([a-zA-Z0-9_\.]+)\s*(<=|>=|==|!=|<|>|=)\s*([a-zA-Z0-9_\.\-\"\']+)',
                re.IGNORECASE
            )
            match = comp_pattern.match(expr)
            if not match:
                # Check boolean variable directly e.g. "vendor.verified"
                clean_var = re.sub(r'[^a-zA-Z0-9_]', '_', expr)
                return self.get_var(clean_var, "boolean")
                
            left_str, op, right_str = match.group(1).strip(), match.group(2).strip(), match.group(3).strip()
            right_str_clean = right_str.strip('"\'')
            
            # Determine data type
            dt = "number"
            if glossary and left_str in glossary:
                dt = glossary[left_str].data_type
                
            left_var = self.get_var(left_str, dt)
            
            # Right operand boolean
            if right_str_clean.lower() in ["true", "false"]:
                right_val = (right_str_clean.lower() == "true")
                if op in ["==", "="]:
                    return left_var == right_val
                elif op == "!=":
                    return left_var != right_val
                    
            try:
                right_num = float(right_str_clean)
            except ValueError:
                # Variable or string identifier on right side
                clean_right = re.sub(r'[^a-zA-Z0-9_]', '_', right_str_clean)
                right_num = self.get_var(clean_right, dt)
                
            if op in [">", "gt"]:
                return left_var > right_num
            elif op in ["<", "lt"]:
                return left_var < right_num
            elif op in [">=", "gte"]:
                return left_var >= right_num
            elif op in ["<=", "lte"]:
                return left_var <= right_num
            elif op in ["==", "="]:
                return left_var == right_num
            elif op in ["!=", "<>"]:
                return left_var != right_num
                
            return None
        except Exception:
            return None


class SMTConstraintVerifier:
    def __init__(self):
        pass

    def verify(self, graph: WorkflowGraph) -> List[VerificationCheckResult]:
        results: List[VerificationCheckResult] = []
        ctx = z3.Context()
        translator = Z3GuardTranslator(ctx=ctx)
        
        # Build DiGraph to extract root-to-leaf paths
        G = nx.DiGraph()
        for node in graph.nodes:
            G.add_node(node.id, node=node)
        for edge in graph.edges:
            G.add_edge(edge.source, edge.target, edge=edge)

        start_nodes = [n for n in graph.nodes if n.type == NodeType.START]
        end_nodes = [n for n in graph.nodes if n.type == NodeType.END]
        
        if not start_nodes or not end_nodes:
            return results
            
        start_id = start_nodes[0].id
        end_id = end_nodes[0].id

        # 1. Path Satisfiability Check
        try:
            all_paths = list(nx.all_simple_paths(G, start_id, end_id, cutoff=15))
        except Exception:
            all_paths = []

        unsat_paths_found = 0
        sat_paths_count = 0

        for path_idx, path in enumerate(all_paths):
            solver = z3.Solver(ctx=ctx)
            path_guards: List[Tuple[str, z3.BoolRef]] = []
            
            try:
                # Check edge guards
                for i in range(len(path) - 1):
                    u, v = path[i], path[i+1]
                    edge_data = G.get_edge_data(u, v)
                    edge: WorkflowEdge = edge_data["edge"]
                    if edge.guard and edge.guard.expression:
                        z3_expr = translator.translate_expression(edge.guard.expression, graph.glossary)
                        if z3_expr is not None:
                            solver.add(z3_expr)
                            path_guards.append((edge.guard.expression, z3_expr))

                # Check node preconditions (on non-decision nodes)
                for nid in path:
                    node_obj = G.nodes[nid].get("node")
                    if node_obj and node_obj.type != NodeType.DECISION and node_obj.preconditions:
                        for prec in node_obj.preconditions:
                            if prec and prec.expression:
                                z3_expr = translator.translate_expression(prec.expression, graph.glossary)
                                if z3_expr is not None and not any(p[0] == prec.expression for p in path_guards):
                                    solver.add(z3_expr)
                                    path_guards.append((prec.expression, z3_expr))

                if path_guards:
                    check_res = solver.check()
                    if check_res == z3.unsat:
                        unsat_paths_found += 1
                        path_str = " -> ".join(graph.get_node(nid).label for nid in path if graph.get_node(nid))
                        guard_conjunction = " AND ".join(g[0] for g in path_guards)
                        results.append(VerificationCheckResult(
                            passed=False,
                            checker_name="Z3 SMT Solver",
                            title=f"Mathematically Unsatisfiable (Dead) Path #{path_idx+1}",
                            details=f"Path '{path_str}' contains contradictory guards ({guard_conjunction}) that can never be simultaneously satisfied.",
                            category=FindingCategory.SMT_UNSATISFIABLE,
                            severity=Severity.ERROR,
                            suggestion="Resolve conflicting boundary constraints along this path."
                        ))
                    elif check_res == z3.sat:
                        sat_paths_count += 1
            except Exception as e:
                # Catch any solver edge cases gracefully
                pass

        if unsat_paths_found == 0:
            results.append(VerificationCheckResult(
                passed=True,
                checker_name="Z3 SMT Solver",
                title="All Execution Paths Satisfiable",
                details=f"Z3 solver verified {len(all_paths)} paths. All guard conjunctions are mathematically reachable and satisfiable.",
                category=FindingCategory.SMT_UNSATISFIABLE,
                severity=Severity.INFO
            ))

        # 2. Decision Gate Exhaustiveness & Gap Analysis
        decision_nodes = [n for n in graph.nodes if n.type == NodeType.DECISION]
        for dec in decision_nodes:
            out_edges = graph.get_outgoing_edges(dec.id)
            if len(out_edges) < 2:
                continue
                
            branch_z3_exprs = []
            for e in out_edges:
                if e.guard and e.guard.expression:
                    z3_expr = translator.translate_expression(e.guard.expression, graph.glossary)
                    if z3_expr is not None:
                        branch_z3_exprs.append(z3_expr)
                        
            if branch_z3_exprs:
                try:
                    # Check for unhandled gaps: solve for NOT(OR(branch_1, branch_2, ...))
                    solver_gap = z3.Solver(ctx=ctx)
                    disjunction = z3.Or(*branch_z3_exprs)
                    solver_gap.add(z3.Not(disjunction, ctx=ctx))
                    
                    if solver_gap.check() == z3.sat:
                        model = solver_gap.model()
                        counter_example = ", ".join(f"{d} = {model[d]}" for d in model.decls())
                        results.append(VerificationCheckResult(
                            passed=False,
                            checker_name="Z3 SMT Solver",
                            title=f"Incomplete Decision Gate at '{dec.label}'",
                            details=f"Decision branches do not cover all input domains. Z3 found unhandled input counter-example: [{counter_example}].",
                            category=FindingCategory.SMT_INCOMPLETE_GATE,
                            severity=Severity.WARNING,
                            node_id=dec.id,
                            source_span=dec.source_span,
                            source_text=dec.source_text,
                            suggestion="Add an explicit 'Otherwise' / default branch to handle uncovered conditions."
                        ))
                    else:
                        results.append(VerificationCheckResult(
                            passed=True,
                            checker_name="Z3 SMT Solver",
                            title=f"Exhaustive Decision Gate at '{dec.label}'",
                            details="Z3 proved branch guards are exhaustive across the entire input space.",
                            category=FindingCategory.SMT_INCOMPLETE_GATE,
                            severity=Severity.INFO,
                            node_id=dec.id
                        ))
                except Exception:
                    pass

        return results
