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

# Control-type-specific KRI templates
CONTROL_TYPE_KRIS = {
    "inspection": {
        "lead": [
            "% of inspections completed on schedule",
            "Average days overdue for scheduled inspections",
            "% of inspection findings closed within target timeframe",
        ],
        "lag": [
            "Number of defects found late (outside scheduled inspection)",
            "Equipment failure rate for items under inspection program",
        ],
    },
    "approval": {
        "lead": [
            "% of submissions approved within SLA timeframe",
            "Number of pending approvals older than target",
            "Approval rejection rate (first-pass yield)",
        ],
        "lag": [
            "Number of incidents linked to delayed approvals",
            "Non-compliance events from unapproved activities",
        ],
    },
    "verification": {
        "lead": [
            "% of verifications completed per schedule",
            "Discrepancy rate in verified records",
            "Average time from submission to verification",
        ],
        "lag": [
            "Number of incidents traced to unverified work",
            "Audit findings related to verification gaps",
        ],
    },
    "monitoring": {
        "lead": [
            "% of monitoring points within acceptable range",
            "Number of monitoring gaps (missing data points)",
            "Alert response time (time from alert to action)",
        ],
        "lag": [
            "Number of threshold exceedances per period",
            "Incidents not predicted by monitoring trends",
        ],
    },
    "maintenance": {
        "lead": [
            "% of preventive maintenance completed on time",
            "Maintenance backlog (count and aging)",
            "Mean time between failures (MTBF) trend",
        ],
        "lag": [
            "Number of breakdown maintenance events",
            "Production loss hours due to equipment failure",
        ],
    },
    "training": {
        "lead": [
            "% of personnel with current required certifications",
            "Training compliance rate by role/department",
            "Average days to close training gaps",
        ],
        "lag": [
            "Number of competency-related incidents",
            "Audit findings citing inadequate training",
        ],
    },
    "documentation": {
        "lead": [
            "% of documents reviewed within review cycle",
            "Number of documents past review date",
            "Document control non-conformance rate",
        ],
        "lag": [
            "Number of incidents attributed to outdated procedures",
            "Regulatory findings on document control",
        ],
    },
    "testing": {
        "lead": [
            "% of required tests completed on schedule",
            "First-pass test success rate",
            "Average time to resolve test failures",
        ],
        "lag": [
            "Number of in-service failures of tested items",
            "Incidents linked to inadequate testing",
        ],
    },
    "general": {
        "lead": [
            "Control implementation compliance rate (%)",
            "Timeliness of control execution vs. schedule",
            "Quality of control evidence (complete/accurate records)",
        ],
        "lag": [
            "Number of risk events occurring despite control",
            "Control effectiveness rating from assurance reviews",
        ],
    },
}

# Keywords that map to control types (with weights — higher = more specific)
CONTROL_TYPE_KEYWORDS = {
    "inspection": [
        ("inspect", 3), ("inspection", 3), ("examine", 2), ("ndt", 3),
        ("walkdown", 3), ("survey", 2), ("visual check", 3),
        ("non-destructive", 3), ("thickness measurement", 3),
    ],
    "approval": [
        ("approve", 3), ("approval", 3), ("authorize", 3), ("sign-off", 3),
        ("sign off", 3), ("endorse", 3), ("authorization", 3),
        ("acceptance", 2), ("concur", 2),
    ],
    "verification": [
        ("verify", 3), ("verification", 3), ("validate", 3), ("validation", 3),
        ("confirm", 2), ("check against", 3), ("cross-check", 3),
        ("reconcile", 2), ("audit", 3),
    ],
    "monitoring": [
        ("monitor", 3), ("monitoring", 3), ("surveillance", 3),
        ("continuous", 2), ("real-time", 3), ("sampling", 2),
        ("measure", 2), ("measurement", 2), ("meter", 2), ("gauge", 2),
    ],
    "maintenance": [
        ("maintenance", 3), ("maintain", 2), ("repair", 3), ("overhaul", 3),
        ("preventive", 3), ("corrective", 3), ("breakdown", 2),
        ("service", 2), ("replace", 2), ("restore", 2),
    ],
    "training": [
        ("train", 2), ("training", 3), ("competency", 3), ("competent", 2),
        ("certification", 3), ("certify", 3), ("qualification", 3),
        ("qualified", 2), ("authorized person", 3),
    ],
    "documentation": [
        ("record", 1), ("register", 2), ("log", 1), ("checklist", 2),
        ("form", 1), ("template", 1), ("data sheet", 2),
        ("document control", 3), ("version control", 3),
    ],
    "testing": [
        ("test", 2), ("testing", 3), ("calibrat", 3), ("function test", 3),
        ("pressure test", 3), ("leak test", 3), ("hydrotest", 3),
        ("performance test", 3), ("commissioning test", 3),
    ],
}


def derive_control_type(control_name: str, statement: str, csf_what: str, csf_how: str) -> str:
    """Determine the primary control type from statement content."""
    # Include the control name for better detection
    combined = f"{control_name} {statement} {csf_what} {csf_how}".lower()
    # Strip document metadata boilerplate
    combined = re.sub(r'(document owner|custodian|author:|approver:|process owner|'
                      r'local management system|process focal point|'
                      r'shell mds|ams |revision date|classification|'
                      r'security classification|eccn|page \d+ of \d+)',
                      '', combined)

    scores = {}
    for ctype, keywords in CONTROL_TYPE_KEYWORDS.items():
        score = 0
        for kw, weight in keywords:
            if kw in combined:
                score += weight
        if score > 0:
            scores[ctype] = score

    if not scores:
        return "general"
    return max(scores, key=scores.get)


def extract_subject(statement: str, csf_what: str, csf_why: str) -> str:
    """Extract the specific subject/domain of this control."""
    combined = statement or csf_what or ""
    # Strip document boilerplate
    combined = re.sub(
        r'(?i)(document owner|custodian|author:|approver:|process owner|'
        r'local management system|process focal point|shell mds|ams |'
        r'revision date|classification|security classification|eccn|'
        r'page \d+ of \d+|role\s+name\s+signature\s+date)',
        '', combined
    )
    # Strip actor prefix pattern: "X performs", "X shall"
    combined = re.sub(r'(?i)\S+\s+(performs?|shall|must|will|is to)\s+', '', combined)
    # Remove common prefixes
    combined = re.sub(r'^(the |a |an |this |all |any )', '', combined.strip(), flags=re.IGNORECASE)
    # Collapse whitespace
    combined = re.sub(r'\s+', ' ', combined).strip()
    # Take first meaningful segment
    subject = combined[:80].strip().rstrip(".")
    if len(subject) < 5:
        subject = (csf_why or "this control").strip()
    return subject


def extract_measurable_aspects(all_text: str) -> dict:
    """Extract measurable numbers, frequencies, and thresholds."""
    aspects = {}

    # Frequencies
    freq_match = re.search(
        r'(annually|annual|quarterly|monthly|weekly|daily|'
        r'every\s+(\d+)\s*(day|week|month|year)s?|'
        r'prior\s+to\s+(each|every)|'
        r'before\s+(each|every)|'
        r'upon\s+(completion|receipt|approval))',
        all_text, re.IGNORECASE
    )
    if freq_match:
        aspects["frequency"] = freq_match.group(0).strip()

    # Time thresholds
    time_match = re.search(
        r'(within|before|after|not\s+exceed\w*\s+|maximum\s+|'
        r'no\s+later\s+than\s+|by\s+)\s*'
        r'(\d+)\s*(day|week|month|year|hour)s?',
        all_text, re.IGNORECASE
    )
    if time_match:
        aspects["time_threshold"] = f"{time_match.group(0).strip()}"

    # Percentage targets
    pct_match = re.search(r'(100\s*%|(\d+)\s*%\s*(compliance|complet|accuracy))', all_text, re.IGNORECASE)
    if pct_match:
        aspects["pct_target"] = pct_match.group(1).strip()

    # Specific counts
    count_match = re.search(
        r'(all|every|each|zero|no|none)\s+(incident|accident|spill|leak|'
        r'fatality|finding|non-compliance|failure|injury|defect)',
        all_text, re.IGNORECASE
    )
    if count_match:
        aspects["zero_target"] = count_match.group(2)

    return aspects


def generate_key_risk_indicator(control_name: str, statement: str, risk_addressed: str,
                                 doc_content: str, csf_what: str = "",
                                 csf_how: str = "", csf_why: str = "",
                                 csf_when: str = "") -> str:
    """Derive specific, measurable Key Risk Indicators from document context."""
    parts = []
    all_text = f"{statement} {risk_addressed} {csf_what} {csf_how} {csf_why} {doc_content[:2500]}".lower()
    statement_lower = (statement or "").lower()

    # ── 1. Control Type & Lead Indicators ──────────────────────────
    control_type = derive_control_type(control_name or "", statement or "", csf_what, csf_how)
    templates = CONTROL_TYPE_KRIS.get(control_type, CONTROL_TYPE_KRIS["general"])

    # Pick the most relevant lead indicator based on statement content
    lead_options = templates["lead"]
    lead_scores = []
    for option in lead_options:
        # Score by keyword overlap with statement
        option_words = set(option.lower().replace("%", " ").split())
        stmt_words = set(statement_lower.split())
        score = len(option_words & stmt_words)
        lead_scores.append((score, option))
    lead_scores.sort(reverse=True)
    best_lead = lead_scores[0][1] if lead_scores else lead_options[0]

    # Customize the lead indicator with extracted subject
    subject = extract_subject(statement or "", csf_what, csf_why)
    if subject and len(subject) > 5 and subject.lower() not in ("none", "ensure proper execution"):
        # Make it specific
        parts.append(f"Lead: {best_lead} — applies to: {subject[:80]}.")
    else:
        parts.append(f"Lead: {best_lead}.")

    # ── 2. Measurable Aspects ──────────────────────────────────────
    aspects = extract_measurable_aspects(all_text)

    if aspects.get("frequency"):
        parts.append(f"Target Frequency: {aspects['frequency']}.")

    if aspects.get("time_threshold"):
        parts.append(f"Time Threshold: {aspects['time_threshold']}.")

    if aspects.get("pct_target"):
        parts.append(f"Compliance Target: {aspects['pct_target']}.")

    if aspects.get("zero_target"):
        parts.append(f"Zero-Tolerance Metric: {aspects['zero_target']}s — target zero.")

    # ── 3. Lag Indicator (what happens when control fails) ─────────
    # Pick most relevant lag indicator
    lag_options = templates["lag"]
    lag_scores = []
    for option in lag_options:
        option_words = set(option.lower().split())
        stmt_words = set(statement_lower.split())
        score = len(option_words & stmt_words)
        lag_scores.append((score, option))
    lag_scores.sort(reverse=True)
    best_lag = lag_scores[0][1] if lag_scores else lag_options[0]

    parts.append(f"Lag: {best_lag}.")

    # ── 4. Control effectiveness metric ────────────────────────────
    # Based on control type, define how to measure if the control works
    effectiveness_metrics = {
        "inspection": "Control is effective if: inspections completed on schedule AND findings closed within target timeframe.",
        "approval": "Control is effective if: approvals completed within SLA AND no incidents from delayed/unapproved work.",
        "verification": "Control is effective if: verifications completed per schedule AND verified records match actual conditions.",
        "monitoring": "Control is effective if: monitoring coverage complete AND alerts acted upon within response time.",
        "maintenance": "Control is effective if: PM compliance on schedule AND breakdown events decreasing quarter-over-quarter.",
        "training": "Control is effective if: certification compliance at target % AND zero competency-related incidents.",
        "documentation": "Control is effective if: documents current within review cycle AND no audit findings on document control.",
        "testing": "Control is effective if: tests completed per schedule AND first-pass rate meets target AND no in-service failures of tested items.",
        "general": "Control is effective if: implemented as designed, evidence of execution exists, and risk events do not occur despite control presence.",
    }
    parts.append(effectiveness_metrics.get(control_type, effectiveness_metrics["general"]))

    return " ".join(parts)


# Update the caller signature ─────────────────────────────────────────
# The generate_testing_approach function stays the same, but we need to
# update how generate_key_risk_indicator is called to pass extra fields.


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
               cfd."csfWhat", cfd."csfWhy", cfd."csfWhen",
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
            csf_what, csf_why, csf_when, \
            existing_ta, existing_kri, doc_content = row

        # Always regenerate KRI (improved algorithm)
        ta = generate_testing_approach(statement or "", csf_how or "",
                                       csf_evidence or "", doc_content or "")
        kri = generate_key_risk_indicator(
            name or "", statement or "", risk_addressed or "", doc_content or "",
            csf_what or "", csf_how or "", csf_why or "", csf_when or ""
        )

        if dry:
            if (i < 5) or (i % 300 == 0):
                print(f"\n[{i+1}/{total}] {name[:80]}")
                print(f"  TA: {ta[:120]}...")
                print(f"  KRI: {kri[:200]}...")
        else:
            cur.execute("""
                UPDATE "ControlFromDocument"
                SET "testingApproach" = %s, "keyRiskIndicator" = %s
                WHERE id = %s
            """, (ta, kri, cfd_id))
            updated += 1

        if (i + 1) % 200 == 0:
            if not dry:
                conn.commit()
            print(f"  ... {i+1}/{total} processed", flush=True)

    if not dry:
        conn.commit()
        print(f"\n✓ Updated {updated} records")
    else:
        print(f"\n[DRY RUN] Would update ~{total} records")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
