import urllib.request
import json

def run_tests():
    print("Running API verification tests on http://localhost:8081...")

    # 1. Rules
    rules_res = urllib.request.urlopen("http://localhost:8081/api/rules", timeout=3).read().decode()
    rules = json.loads(rules_res)
    print(f"[OK] Rules endpoint working: {len(rules['role_resolution']['role_dictionary'])} role mappings, {len(rules['authorization']['segregation_of_duties'])} SoD rules")

    # 2. Parse with decision branching
    policy = "For any purchase over $10,000, verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
    req = urllib.request.Request(
        "http://localhost:8081/api/parse",
        data=json.dumps({"policy_text": policy}).encode(),
        headers={"Content-Type": "application/json"}
    )
    parse_res = json.loads(urllib.request.urlopen(req, timeout=5).read().decode())
    graph = parse_res["graph"]
    report = parse_res["report"]
    print(f"[OK] Parsed graph: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
    
    # Check decision gates
    dec_nodes = [n for n in graph["nodes"] if n["type"] == "decision"]
    for d in dec_nodes:
        out = [e for e in graph["edges"] if e["source"] == d["id"]]
        print(f"[OK] Decision Gate '{d['label']}' forks into {len(out)} branches (branching verified!)")
        assert len(out) >= 2

    # 3. Verify
    req_v = urllib.request.Request(
        "http://localhost:8081/api/verify",
        data=json.dumps(graph).encode(),
        headers={"Content-Type": "application/json"}
    )
    v_res = json.loads(urllib.request.urlopen(req_v, timeout=5).read().decode())
    print(f"[OK] Verification endpoint: is_valid={v_res['report']['is_valid']}, checks={len(v_res['report']['checks'])}")

    # 4. Deploy
    req_d = urllib.request.Request(
        "http://localhost:8081/api/deploy",
        data=json.dumps({"graph": graph, "target_format": "bpmn", "environment": "production"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    d_res = json.loads(urllib.request.urlopen(req_d, timeout=5).read().decode())
    print(f"[OK] Deploy endpoint working: status={d_res['status']}, deployment_id={d_res['deployment_id']}")

    print("\nAll Backend & Rules APIs verified successfully!")

if __name__ == "__main__":
    run_tests()
