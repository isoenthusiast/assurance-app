"""
Parse smds-icop-statutory-requirements.md and import clauses into Requirement table.
pId = "6.05" → ProcessArea "PMS" (looked up via ProcessArea.pId)

Run: python scripts/import_icop_requirements.py
"""
import psycopg2
import os
import re


def get_connection():
    """Connect to PostgreSQL using DATABASE_URL from .env."""
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DATABASE_URL='):
                        db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                        break
    if not db_url:
        raise RuntimeError("DATABASE_URL not found")
    url = db_url.replace('postgresql://', '')
    auth_host, dbname = url.rsplit('/', 1)
    auth, hostport = auth_host.rsplit('@', 1)
    user, password = auth.split(':', 1)
    host, port = (hostport.split(':', 1) + ['5432'])[:2]
    return psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname, sslmode='require')


def parse_clauses(md_path):
    """Parse ICOP markdown into structured clause dicts."""
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match all #### **Clause ...** headers
    ch = list(re.finditer(r'^####\s+\*\*Clause\s+(.+?)\*\*\s*$', content, re.MULTILINE))
    kh = list(re.finditer(r'^###\s+\*\*KLAUSA\s+([\d]+\.[\d]+):\s+(.+?)\*\*\s*$', content, re.MULTILINE))

    klausa_map = {}
    for km in kh:
        klausa_map[km.start()] = (km.group(1), km.group(2).strip())

    clauses = []
    for i, m in enumerate(ch):
        raw = m.group(1).strip()
        if ':' in raw:
            raw = raw.split(':', 1)[0].strip()
        clause_id = raw

        start = m.end()
        end = len(content)
        if i + 1 < len(ch):
            end = ch[i + 1].start()
        else:
            hr = content.find('\n---\n', start)
            if hr > 0:
                end = hr

        text = content[start:end].strip()

        # Parent KLAUSA
        k_num = ""
        k_title = ""
        for pos, (kn, kt) in sorted(klausa_map.items(), reverse=True):
            if pos < m.start():
                k_num = kn
                k_title = kt
                break

        # Extract BM / EN / Audit
        bm = ""
        bm_m = re.search(r'\*\*Bahasa Malaysia\*\*:\s*(.+?)(?=\n\*\s+\*\*|\n\Z)', text, re.DOTALL)
        if bm_m:
            bm = bm_m.group(1).strip()

        en = ""
        en_m = re.search(r'\*\*English\*\*:\s*(.+?)(?=\n\*\s+\*\*|\n\Z)', text, re.DOTALL)
        if en_m:
            en = en_m.group(1).strip()

        audit = ""
        am = re.search(r'\*\*How to Demonstrate.+?\*\*:\s*\n((?:\s+\*.*(?:\n|$))+)', text, re.DOTALL)
        if am:
            audit = re.sub(r'^\s+\*\s+', '• ', am.group(1), flags=re.MULTILINE).strip()

        # Build fields
        clause_content = f"[BM] {bm}\n\n[EN] {en}" if bm else en
        if not clause_content:
            clause_content = bm

        intent = en[:500] if en else bm[:500]
        if audit:
            intent = f"Audit Checklist:\n{audit[:500]}"

        combined = (en + bm).lower()
        applicability = "All CoF plants under PMS scope"
        if any(w in combined for w in ['boiler', 'dandang', 'pressure vessel', 'bejana']):
            applicability = "CoF boilers and pressure systems"
        elif any(w in combined for w in ['lifting', 'angkat']):
            applicability = "Lifting machinery and devices"
        elif any(w in combined for w in ['occupational safety', 'pekerja', 'personnel']):
            applicability = "All plant personnel and workplace"
        elif any(w in combined for w in ['process safety', 'hazard', 'pha', 'sce']):
            applicability = "Process safety systems and SCE"
        elif any(w in combined for w in ['asset integrity', 'integriti aset', 'corrosion', 'kakisan']):
            applicability = "Static equipment and pressure systems"
        elif any(w in combined for w in ['emergency', 'kecemasan', 'erp']):
            applicability = "Emergency response systems"
        elif any(w in combined for w in ['management review', 'kajian semula', 'audit', 'penilaian']):
            applicability = "Management system governance"

        refs = f"ICOP PMS [P.U. (B) 399/2025], Klausa {k_num}" if k_num else "ICOP PMS [P.U. (B) 399/2025]"

        clauses.append({
            'requirementId': clause_id,
            'standard': 'SMDS ICOP PMS',
            'pId': '6.05',
            'clauseContent': clause_content[:3000],
            'intentOutcome': intent[:800],
            'clauseApplicability': applicability,
            'references': refs,
            'klausaNum': k_num,
            'klausaTitle': k_title,
        })

    return clauses


def main():
    conn = get_connection()
    conn.autocommit = True
    cur = conn.cursor()

    # Lookup ProcessArea
    cur.execute('SELECT id, name FROM "ProcessArea" WHERE "pId" = %s', ('6.05',))
    pa = cur.fetchone()
    if not pa:
        print("ERROR: No ProcessArea with pId='6.05'. Available:")
        cur.execute('SELECT id, name, "pId" FROM "ProcessArea" ORDER BY "pId"')
        for r in cur.fetchall():
            print(f"  {r[2]} → {r[1]}")
        cur.close(); conn.close()
        return
    processAreaId, pa_name = pa
    print(f"ProcessArea: {pa_name} (id={processAreaId})")

    # Parse markdown
    md_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontline library', 'smds-icop-statutory-requirements.md')
    if not os.path.exists(md_path):
        md_path = os.path.join(os.path.dirname(__file__), '..', 'frontline library', 'smds-icop-statutory-requirements.md')
    print(f"Parsing: {md_path}")
    clauses = parse_clauses(md_path)
    print(f"Found {len(clauses)} clauses")

    # Insert
    cur.execute('SELECT COALESCE(MAX("rID"), 0) + 1 FROM "Requirement"')
    next_rid = cur.fetchone()[0]
    inserted = skipped = 0

    for c in clauses:
        cur.execute('SELECT "rID" FROM "Requirement" WHERE "requirementId" = %s AND "pID" = %s',
                    (c['requirementId'], c['pId']))
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute("""
            INSERT INTO "Requirement"
            ("rID", "standard", "pID", "processAreaId", "requirementId",
             "clauseContent", "intentOutcome", "clauseApplicability", "references", "applicable")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (next_rid, c['standard'], c['pId'], processAreaId, c['requirementId'],
              c['clauseContent'], c['intentOutcome'], c['clauseApplicability'],
              c['references'], True))
        print(f"  OK rID={next_rid} {c['requirementId']}")
        next_rid += 1
        inserted += 1

    print(f"\nInserted: {inserted}, Skipped: {skipped}")
    cur.execute('SELECT COUNT(*) FROM "Requirement" WHERE "pID" = %s', ('6.05',))
    print(f"Total requirements with pID=6.05: {cur.fetchone()[0]}")
    cur.close(); conn.close()
    print("Done.")


if __name__ == "__main__":
    main()


def parse_clauses(md_path):
    """Parse the ICOP statutory requirements markdown into structured clause dicts."""
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    clauses = []
    
    # Find all clause headers: #### **Clause X.Y.Z** or #### **Clause X.Y & X.Z**
    # Also handle: #### **Clause X.Y.Z - X.Y.W**
    clause_pattern = re.compile(
        r'^####\s+\*\*Clause\s+([\d]+(?:\.[\d]+(?:[a-z])?(?:\s*[,&]\s*[\d]+\.[\d]+(?:[a-z])?)*))\*\*\s*$',
        re.MULTILINE
    )
    
    # Also match patterns like "#### **Clause 5.1.a**"
    single_clause = re.compile(
        r'^####\s+\*\*Clause\s+([\d]+\.[\d]+\.[a-z])\*\*\s*$',
        re.MULTILINE
    )
    
    # Find all clause header positions
    matches = list(re.finditer(
        r'^####\s+\*\*Clause\s+([\d]+(?:\.[\d]+(?:[a-z])?(?:\s*[,&]\s*[\d]+\.[\d]+(?:[a-z])?)*))\*\*\s*$',
        content, re.MULTILINE
    ))
    
    # Also find the major KLAUSA headers for context
    klausa_headers = list(re.finditer(
        r'^###\s+\*\*KLAUSA\s+([\d]+\.[\d]+):\s+(.+?)\*\*\s*$',
        content, re.MULTILINE
    ))
    
    # Build klausa lookup: position -> (number, title)
    klausa_map = {}
    for km in klausa_headers:
        klausa_map[km.start()] = (km.group(1), km.group(2).strip())
    
    for i, m in enumerate(matches):
        clause_id = m.group(1).strip()
        start_pos = m.end()
        
        # Determine end position (next clause header, or next ### header, or end)
        end_pos = len(content)
        if i + 1 < len(matches):
            end_pos = matches[i + 1].start()
        else:
            # Look for next major header
            next_section = re.search(r'^---\s*$', content[start_pos:], re.MULTILINE)
            if next_section:
                end_pos = start_pos + next_section.start()
        
        clause_text = content[start_pos:end_pos].strip()
        
        # Find which KLAUSA this belongs to
        klausa_num = ""
        klausa_title = ""
        for pos, (knum, ktitle) in sorted(klausa_map.items(), reverse=True):
            if pos < m.start():
                klausa_num = knum
                klausa_title = ktitle
                break
        
        # Extract Bahasa Malaysia
        bm_match = re.search(r'\*\*Bahasa Malaysia\*\*:\s*(.+?)(?=\n\*|\n\Z)', clause_text, re.DOTALL)
        bm_text = bm_match.group(1).strip() if bm_match else ""
        
        # Extract English
        en_match = re.search(r'\*\*English\*\*:\s*(.+?)(?=\n\*|\n\Z)', clause_text, re.DOTALL)
        en_text = en_match.group(1).strip() if en_match else ""
        
        # Extract How to Demonstrate
        audit_match = re.search(r'\*\*How to Demonstrate.+?\*\*:\s*\n((?:\s*\*.+?\n?)+)', clause_text, re.DOTALL)
        audit_text = ""
        if audit_match:
            audit_lines = audit_match.group(1).strip()
            # Clean up bullet markers
            audit_text = re.sub(r'^\s*\*\s*', '• ', audit_lines, flags=re.MULTILINE)
        
        # Build clause content: English description (primary) with BM note
        clause_content = en_text
        if bm_text:
            clause_content = f"[BM] {bm_text}\n\n[EN] {en_text}"
        
        # Build intent/outcome from audit checklist
        intent_outcome = audit_text if audit_text else en_text[:200] if en_text else ""
        
        # Determine applicability
        applicability = "All CoF plants under PMS scope"
        if "boiler" in (en_text + bm_text).lower() or "dandang" in bm_text.lower():
            applicability = "CoF boilers and connected pressure systems"
        if "OSH" in klausa_title.upper() or "pekerjaan" in bm_text.lower():
            applicability = "All plant personnel and contractors"
        
        # Build references from KLAUSA context
        references = f"ICOP PMS [P.U. (B) 399/2025], Klausa {klausa_num}" if klausa_num else "ICOP PMS [P.U. (B) 399/2025]"
        
        # Standard
        standard = "SMDS ICOP PMS"
        
        clauses.append({
            'requirementId': clause_id,
            'standard': standard,
            'pId': '6.05',
            'clauseContent': clause_content[:3000],  # Truncate very long content
            'intentOutcome': intent_outcome[:1000],
            'clauseApplicability': applicability,
            'references': references,
            'applicable': True,
            'klausaNum': klausa_num,
            'klausaTitle': klausa_title,
        })
    
    return clauses


def main():
    conn = get_connection()
    conn.autocommit = True
    cur = conn.cursor()
    
    # Look up processAreaId for pId = "6.05"
    cur.execute('SELECT id, name FROM "ProcessArea" WHERE "pId" = %s', ('6.05',))
    pa_row = cur.fetchone()
    if not pa_row:
        print("ERROR: No ProcessArea found with pId = '6.05'")
        print("Available ProcessAreas:")
        cur.execute('SELECT id, name, "pId" FROM "ProcessArea" ORDER BY "pId"')
        for r in cur.fetchall():
            print(f"  id={r[0]}  pId={r[2]}  name={r[1]}")
        cur.close(); conn.close()
        return
    
    processAreaId = pa_row[0]
    pa_name = pa_row[1]
    print(f"ProcessArea: {pa_name} (id={processAreaId})")
    
    # Parse the markdown
    md_path = os.path.join(os.path.dirname(__file__), '..', '..', 'frontline library', 'smds-icop-statutory-requirements.md')
    if not os.path.exists(md_path):
        md_path = os.path.join(os.path.dirname(__file__), '..', 'frontline library', 'smds-icop-statutory-requirements.md')
    
    print(f"Parsing: {md_path}")
    clauses = parse_clauses(md_path)
    print(f"Found {len(clauses)} clauses")
    
    # Determine next rID
    cur.execute('SELECT COALESCE(MAX("rID"), 0) + 1 FROM "Requirement"')
    next_rid = cur.fetchone()[0]
    
    inserted = 0
    skipped = 0
    
    for c in clauses:
        # Check if already exists by requirementId + standard + pId
        cur.execute(
            'SELECT "rID" FROM "Requirement" WHERE "requirementId" = %s AND standard = %s AND "pID" = %s',
            (c['requirementId'], c['standard'], c['pId'])
        )
        existing = cur.fetchone()
        if existing:
            print(f"  SKIP: {c['requirementId']} already exists (rID={existing[0]})")
            skipped += 1
            continue
        
        rid = next_rid
        next_rid += 1
        
        cur.execute("""
            INSERT INTO "Requirement" 
            ("rID", "standard", "pID", "processAreaId", "requirementId", 
             "clauseContent", "intentOutcome", "clauseApplicability", 
             "references", "applicable")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            rid,
            c['standard'],
            c['pId'],
            processAreaId,
            c['requirementId'],
            c['clauseContent'],
            c['intentOutcome'],
            c['clauseApplicability'],
            c['references'],
            c['applicable']
        ))
        inserted += 1
        print(f"  OK: rID={rid}  {c['requirementId']}  [{c['klausaNum']}] {c['klausaTitle'][:60]}")
    
    print(f"\nInserted: {inserted}, Skipped: {skipped}")
    
    # Verify
    cur.execute('SELECT COUNT(*) FROM "Requirement" WHERE "pID" = %s', ('6.05',))
    total = cur.fetchone()[0]
    print(f"Total requirements with pID=6.05: {total}")
    
    # Sample
    cur.execute('SELECT "rID", "requirementId", LEFT("clauseContent", 80) FROM "Requirement" WHERE "pID" = %s ORDER BY "rID" LIMIT 5', ('6.05',))
    print("\nSample:")
    for row in cur.fetchall():
        print(f"  rID={row[0]}  reqID={row[1]}  content={row[2]}...")
    
    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
