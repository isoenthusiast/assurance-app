"""
Generate TestingApproach and KeyRiskIndicator for ControlFromDocument records.

Reads each ControlFromDocument, looks at its CSF fields and linked
DocumentExtract content, and synthesizes:

  - testingApproach  → derived from csfHow + csfEvidence + doc keywords
  - keyRiskIndicator → derived from riskAddressed + statement + doc metrics

Run:
  python scripts/generate_testing_kri.py [--dry-run] [--limit N]
"""

import os
import sys
import re
import argparse
from collections import Counter

# ── Database connection ───────────────────────────────────────────────

def get_db_url():
    db_url = os.environ.get("DATABASE_URL")
    if db_url:
        return db_url
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DATABASE_URL not found")


def connect():
    db_url = get_db_url()
    url = db_url.replace("postgresql://", "")
    auth_host, dbname = url.rsplit("/", 1)
    auth, hostport = auth_host.rsplit("@", 1)
    user, password = auth.split(":", 1)
    if ":" in hostport:
        host, port = hostport.split(":", 1)
    else:
        host, port = hostport, "5432"
    import psycopg2
    return psycopg2.connect(host=host, port=port, user=user,
                            password=password, dbname=dbname)


# ── Testing Approach generator ────────────────────────────────────────

# Keywords that suggest testing methods
TEST_METHOD_KEYWORDS = {
    "inspect": "Physical inspection / walkdown",
    "verify": "Document review / verification",
    "review": "Document review",
    "audit": "Internal or external audit",
    "test": "Functional testing",
    "calibrat": "Calibration check",
    "measure": "Measurement / metrology verification",
    "sample": "Sampling and laboratory analysis",
    "witness": "Witness testing by independent party",
    "certif": "Certification / accreditation review",
    "checklist": "Checklist-based verification",
    "interview": "Personnel interview / competency assessment",
    "simulat": "Simulation / drill exercise",
    "record": "Records review",
    "log": "Log review",
    "permit": "Permit-to-work verification",
    "sign-off": "Sign-off / approval verification",
    "validate": "Validation against standard / procedure",
    "monitor": "Continuous monitoring / surveillance",
    "barrier": "Barrier health check",
    "maintenance": "Maintenance record review",
    "training": "Training record verification",
    "competenc": "Competency assessment",
    "procedure": "Procedure adherence check",
    "swp": "Safe Work Procedure review",
}


def generate_testing_approach(statement: str, csf_how: str, csf_evidence: str,
                               doc_content: str) -> str:
    """Synthesize a testing approach from available CSF data."""
    parts = []
    all_text = f"{statement} {csf_how} {csf_evidence} {doc_content[:3000]}".lower()

    # Detect testing method from keywords
    found_methods = []
    for keyword, method in TEST_METHOD_KEYWORDS.items():
        if keyword in all_text and method not in found_methods:
            found_methods.append(method)

    if found_methods:
        parts.append("Testing Method(s): " + ", ".join(found_methods[:3]) + ".")

    # Evidence requirement
    if csf_evidence and csf_evidence.strip() and csf_evidence.strip() != "None":
        evidence_clean = csf_evidence.strip().rstrip(".")
        if len(evidence_clean) > 10:
            parts.append(f"Evidence Required: {evidence_clean}.")

    # How-to from csfHow
    if csf_how and csf_how.strip() and csf_how.strip() != "None":
        how_clean = csf_how.strip().rstrip(".")
        # Truncate if too long
        if len(how_clean) > 300:
            how_clean = how_clean[:297] + "..."
        if not any(how_clean.lower().startswith(w) for w in ["inspection", "test", "verif", "review", "audit", "the ", "install"]):
            parts.append(f"Procedure: {how_clean}.")

    # Frequency hint from document
    freq_match = re.search(
        r'(annually|quarterly|monthly|weekly|daily|biannual|bi-annual|'
        r'every\s+\d+\s+(day|week|month|year)|'
        r'prior\s+to|before\s+each|after\s+each)',
        all_text
    )
    if freq_match:
        freq = freq_match.group(1).capitalize()
        parts.append(f"Frequency: {freq}.")

    if not parts:
        parts.append("Review control statement and verify implementation through document review and field observation.")

    return " ".join(parts)


# ── Key Risk Indicator generator ──────────────────────────────────────

RISK_METRIC_PATTERNS = [
    (r'(\d+)\s*%', r'Target: ≥\1% compliance rate'),
    (r'(\d+)\s*days?', r'Threshold: ≤\1 days'),
    (r'(\d+)\s*months?', r'Threshold: ≤\1 months'),
    (r'zero\s+(incident|accident|spill|leak|fatality)', r'Target: Zero \1s'),
    (r'100\s*%', r'Target: 100% compliance'),
    (r'no\s+(incident|accident|spill|leak|fatality|finding)', r'Target: Zero \1s'),
]

RISK_CATEGORY_KEYWORDS = {
    "safety": ["safety", "fatality", "injury", "loto", "isolation", "confined space", "working at height"],
    "environmental": ["spill", "leak", "emission", "discharge", "environmental", "waste"],
    "process": ["upset", "shutdown", "trip", "overpressure", "loss of containment"],
    "asset": ["failure", "damage", "corrosion", "erosion", "degradation", "breakdown"],
    "regulatory": ["non-compliance", "violation", "legal", "permit", "license", "regulation"],
    "operational": ["downtime", "delay", "backlog", "production loss", "outage"],
    "quality": ["defect", "rework", "non-conformance", "deviation", "out of spec"],
    "security": ["breach", "unauthorized", "access", "cyber"],
}


def generate_key_risk_indicator(statement: str, risk_addressed: str,
                                 doc_content: str) -> str:
    """Derive a key risk indicator from the risk and document content."""
    parts = []
    all_text = f"{statement} {risk_addressed} {doc_content[:3000]}".lower()

    # 1. Risk category
    categories = []
    for cat, keywords in RISK_CATEGORY_KEYWORDS.items():
        if any(kw in all_text for kw in keywords):
            categories.append(cat)
    if categories:
        parts.append(f"Risk Category: {', '.join(categories[:2]).title()}.")

    # 2. Metric / threshold from patterns
    for pattern, template in RISK_METRIC_PATTERNS:
        match = re.search(pattern, all_text, re.IGNORECASE)
        if match:
            parts.append(template)
            break

    # 3. Leading indicator from risk statement
    if risk_addressed and risk_addressed.strip() and risk_addressed.strip() != "None":
        risk_clean = risk_addressed.strip().rstrip(".")
        # Extract key measurable aspect
        meas_match = re.search(
            r'(ensure|prevent|detect|mitigate|control|monitor|reduce|eliminate)\s+(.+)',
            risk_clean, re.IGNORECASE
        )
        if meas_match:
            action = meas_match.group(2)[:150]
            parts.append(f"Leading Indicator: {action.strip()}.")

    # 4. Lagging indicator from keywords
    lag_keywords = {
        "incident": "Number of incidents reported",
        "spill": "Number of spills / volume spilled",
        "finding": "Number of audit findings",
        "non-compliance": "Number of non-compliance events",
        "failure": "Number of equipment failures",
        "injury": "Number of injuries / LTI rate",
        "fatality": "Fatalities (target: zero)",
        "leak": "Number of leaks detected",
        "backlog": "Maintenance/inspection backlog count",
        "downtime": "Unplanned downtime hours",
    }
    for kw, indicator in lag_keywords.items():
        if kw in all_text:
            parts.append(f"Lagging Indicator: {indicator}.")
            break

    if not parts:
        parts.append("Review control objective and define measurable risk indicators based on consequence of failure.")

    return " ".join(parts)


# ── Main ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate TestingApproach & KeyRiskIndicator for ControlFromDocument"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing to DB")
    parser.add_argument("--limit", type=int, default=0,
                        help="Limit to N records (0 = all)")
    args = parser.parse_args()

    conn = connect()
    cur = conn.cursor()

    # Fetch all ControlFromDocument with their DocumentExtract content
    query = """
        SELECT cfd.id, cfd.name, cfd.statement,
               cfd."csfHow", cfd."csfEvidence", cfd."riskAddressed",
               cfd."testingApproach", cfd."keyRiskIndicator",
               de.content as doc_content
        FROM "ControlFromDocument" cfd
        JOIN "DocumentExtract" de ON cfd."documentExtractId" = de.id
        ORDER BY cfd."createdAt"
    """
    if args.limit > 0:
        query += f" LIMIT {args.limit}"

    cur.execute(query)
    rows = cur.fetchall()
    total = len(rows)
    print(f"Processing {total} ControlFromDocument records...")

    updated = 0
    skipped = 0
    dry = args.dry_run

    for i, row in enumerate(rows):
        cfd_id, name, statement, csf_how, csf_evidence, risk_addressed, \
            existing_ta, existing_kri, doc_content = row

        # Skip if both fields already have content
        if existing_ta and existing_ta.strip() and existing_kri and existing_kri.strip():
            skipped += 1
            continue

        # Generate
        ta = existing_ta if (existing_ta and existing_ta.strip()) else \
            generate_testing_approach(statement or "", csf_how or "",
                                      csf_evidence or "", doc_content or "")
        kri = existing_kri if (existing_kri and existing_kri.strip()) else \
            generate_key_risk_indicator(statement or "", risk_addressed or "",
                                        doc_content or "")

        if dry:
            if (i < 3) or (i % 200 == 0):
                print(f"\n[{i+1}/{total}] {name[:80]}")
                print(f"  TestingApproach: {ta[:150]}...")
                print(f"  KeyRiskIndicator: {kri[:150]}...")
        else:
            cur.execute("""
                UPDATE "ControlFromDocument"
                SET "testingApproach" = %s, "keyRiskIndicator" = %s
                WHERE id = %s
            """, (ta, kri, cfd_id))
            updated += 1

        if (i + 1) % 100 == 0:
            if not dry:
                conn.commit()
            print(f"  ... {i+1}/{total} processed", flush=True)

    if not dry:
        conn.commit()
        print(f"\n✓ Updated {updated} records (skipped {skipped} already populated)")
    else:
        print(f"\n[DRY RUN] Would update ~{total - skipped} records")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
