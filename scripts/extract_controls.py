"""
Control Extraction Script
=========================
Processes DocumentExtract records in batches, extracts control statements
using the Control Statement Framework (CSF: 5W+1H), populates 
ControlFromDocument table, and tracks progress via Status/CompletedOn.

Usage:
  python scripts/extract_controls.py [--batch-size 25] [--batch-start 0] [--limit 0]

Batch tracking:
  - Each document whose controls have been extracted is marked Status='Completed'
  - CompletedOn is set to current timestamp
  - Re-running is idempotent — skips already-Completed documents
"""

import os
import sys
import re
import uuid
from datetime import datetime, timezone

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
import psycopg2.extras


def get_db_url():
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        return db_url
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    # try .env.local
    env_local = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_local):
        with open(env_local) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DATABASE_URL not found in env or .env files")


def clean_text(text):
    """Remove excessive table markup and normalize whitespace."""
    if not text:
        return ""
    # Remove markdown table separators
    text = re.sub(r'\|[\s\-:|]+\|', ' ', text)
    # Collapse multiple spaces
    text = re.sub(r'\s+', ' ', text)
    # Remove excessive pipe characters
    text = re.sub(r'\|\s*', ' ', text)
    # Remove page number artifacts
    text = re.sub(r'Printed\s+\d+/\d+/\d+.*?Page\s+\d+\s+of\s+\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Printed copies are uncontrolled\.?', '', text, flags=re.IGNORECASE)
    return text.strip()


def parse_sections(content):
    """Parse document content into key sections: PURPOSE, SCOPE, ROLES, PROCEDURE."""
    sections = {
        'purpose': '',
        'scope': '',
        'roles': '',
        'procedure': '',
        'reference': '',
        'definitions': '',
        'all_text': clean_text(content)
    }
    
    # Try to find section boundaries
    text = content
    
    # Common section patterns in SMDS documents
    section_patterns = [
        (r'(?:^|\n)\s*PURPOSE\s*\n', 'purpose'),
        (r'(?:^|\n)\s*SCOPE\s*\n', 'scope'),
        (r'(?:^|\n)\s*ROLES\s*(?:&|AND)\s*RESPONSIBILIT', 'roles'),
        (r'(?:^|\n)\s*PROCEDURE\s*\n', 'procedure'),
        (r'(?:^|\n)\s*REFERENCE', 'reference'),
        (r'(?:^|\n)\s*RELEVANT\s*ACRONYMS', 'definitions'),
        (r'(?:^|\n)\s*DEFINITIONS', 'definitions'),
    ]
    
    # Find all section positions
    positions = []
    for pattern, name in section_patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            positions.append((m.start(), name))
    
    positions.sort()
    
    # Extract text between section markers
    for i, (pos, name) in enumerate(positions):
        start = pos
        end = positions[i+1][0] if i+1 < len(positions) else len(text)
        section_text = text[start:end]
        
        # Find the actual content after the section header
        header_end = section_text.find('\n')
        if header_end > 0:
            section_text = section_text[header_end:].strip()
        
        sections[name] = clean_text(section_text)
    
    return sections


def extract_control_statement(doc, sections):
    """
    Build a CSF-compliant control statement from document sections.
    Returns a dict with fields for ControlFromDocument.
    """
    doc_id = doc['id']
    title = doc['documentTitle'] or 'Untitled'
    doc_num = doc['documentNumber'] or ''
    doc_type = doc['documentType'] or 'Procedure'
    custodian = doc['custodian'] or ''
    authorizer = doc['authorizer'] or ''
    
    # --- WHO ---
    # Extract roles from ROLES section and document metadata
    who_parts = []
    if custodian:
        who_parts.append(custodian.strip())
    if sections['roles']:
        # Try to extract role titles - look for patterns like "The XXXX shall/are/to"
        role_matches = re.findall(
            r'(?:The\s+)?([A-Z][A-Za-z\s/]+(?:Manager|Engineer|Lead|Personnel|Supervisor|Officer|Coordinator|Technician|Specialist|Custodian|Owner))',
            sections['roles']
        )
        for rm in role_matches[:3]:
            rm_clean = rm.strip()
            if rm_clean and rm_clean not in who_parts:
                who_parts.append(rm_clean)
    if authorizer and authorizer.strip() not in who_parts:
        who_parts.append(f"Approver: {authorizer.strip()}")
    
    csf_who = '; '.join(who_parts[:4]) if who_parts else (custodian or 'Site Process Focal Point')
    
    # --- WHAT ---
    # The document title describes what activity
    csf_what = title
    
    # --- WHY (Objective / Risk Addressed) ---
    why_parts = []
    if sections['purpose']:
        purpose_clean = sections['purpose'][:500]
        # Extract sentences that describe the purpose
        purpose_sents = re.findall(r'[^.!?]+(?:ensures?|prevent|mitigate|confirm|verify|protect|maintain|comply)[^.!?]*[.!?]', 
                                    purpose_clean, re.IGNORECASE)
        if purpose_sents:
            csf_why = ' '.join(purpose_sents[:2])
        else:
            csf_why = purpose_clean[:300]
    else:
        csf_why = f"Ensure proper execution of {title}"
    
    # --- WHERE (System / Location) ---
    where_parts = []
    if sections['scope']:
        # Look for system/equipment names
        sys_matches = re.findall(r'(?:in|on|using|within)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s/-]+(?:System|Equipment|Database|Server|Panel|Controller|Network|Application|Platform))', 
                                  sections['scope'], re.IGNORECASE)
        if sys_matches:
            where_parts.extend([s.strip() for s in sys_matches[:2]])
    if not where_parts:
        # Try to extract system from title
        sys_in_title = re.findall(r'(?:Honeywell|IPS|PCS7|PLC|DCS|SCADA|SIS|ESD|FGS|BMS)\s*\w*', title, re.IGNORECASE)
        if sys_in_title:
            where_parts.extend(sys_in_title[:2])
    
    csf_where = '; '.join(where_parts[:3]) if where_parts else 'SMDS Facility Systems'
    
    # --- WHEN (Frequency) ---
    freq_patterns = [
        (r'(?:daily|each\s+day)', 'Daily'),
        (r'(?:weekly|each\s+week|every\s+week)', 'Weekly'),
        (r'(?:monthly|each\s+month|every\s+month)', 'Monthly'),
        (r'(?:quarterly|each\s+quarter|every\s+quarter)', 'Quarterly'),
        (r'(?:annually|yearly|each\s+year|every\s+year)', 'Annually'),
        (r'(?:as\s+needed|as\s+required|on\s+demand|ad[\s-]?hoc)', 'As Needed'),
        (r'(?:continuous|real[\s-]?time|ongoing)', 'Continuous'),
        (r'before\s+(?:each|every|any)', 'Before Each Use'),
        (r'after\s+(?:each|every|any)', 'After Each Use'),
    ]
    csf_when = 'As Required'
    all_text = sections['all_text']
    for pattern, freq in freq_patterns:
        if re.search(pattern, all_text, re.IGNORECASE):
            csf_when = freq
            break
    
    # --- HOW (Method) ---
    how_parts = []
    if sections['procedure']:
        # Extract numbered steps or key action statements
        steps = re.findall(r'(?:^|\n)\s*(?:\d+[\.\)]\s*)?([A-Z][^.!?]{30,200}[.!?])', sections['procedure'])
        if steps:
            csf_how = '; '.join(steps[:5])
        else:
            csf_how = sections['procedure'][:500]
    else:
        csf_how = f"Execute procedure as documented in {doc_num}"
    
    # --- EVIDENCE ---
    evidence_patterns = re.findall(
        r'(?:record|log|report|checklist|form|register|certificate|sign[\s-]?off|approval|screenshot|printout|data\s+file)',
        all_text, re.IGNORECASE
    )
    csf_evidence = '; '.join(set(e.strip() for e in evidence_patterns[:5])) if evidence_patterns else 'Procedure execution records'
    
    # --- Build the one-line control statement ---
    statement = f"{csf_who} performs {csf_what} {csf_when} in {csf_where} to {csf_why}, using documented procedure, with {csf_evidence} as evidence."
    
    # Truncate long statements
    if len(statement) > 1500:
        statement = statement[:1497] + '...'
    
    # --- Determine control type ---
    control_type = 'Administrative'
    doc_type_lower = doc_type.lower()
    if 'procedure' in doc_type_lower or 'instruction' in doc_type_lower:
        control_type = 'Operational'
    elif 'policy' in doc_type_lower:
        control_type = 'Administrative'
    elif 'narrative' in doc_type_lower:
        control_type = 'Technical'
    
    # --- Risk weight ---
    risk_weight = 1
    if re.search(r'(?:critical|high\s*risk|safety|HSSE|process\s*safety)', all_text, re.IGNORECASE):
        risk_weight = 3
    elif re.search(r'(?:environmental|regulatory|compliance|legal)', all_text, re.IGNORECASE):
        risk_weight = 2
    
    # --- Key Activities summary ---
    key_activities = sections['procedure'][:500] if sections['procedure'] else csf_what
    
    # --- Risk Addressed ---
    risk_addressed = csf_why
    
    # --- Standard reference ---
    # Try to extract standard number from references
    std_match = re.search(r'(?:ISO\s*\d{4,5}(?::\d{4})?|SEAM\s*\d+\.\d+|BP-[A-Z]+-\d+)', 
                          sections.get('reference', '') + ' ' + all_text, re.IGNORECASE)
    standard = std_match.group(0) if std_match else None
    
    return {
        'id': str(uuid.uuid4()),
        'documentExtractId': doc_id,
        'name': title[:200],
        'statement': statement,
        'controlType': control_type,
        'processAreaId': '',  # Can be mapped later
        'isHsseCritical': bool(re.search(r'(?:HSSE|safety\s*critical|process\s*safety)', all_text, re.IGNORECASE)),
        'riskWeight': risk_weight,
        'rawHealthScore': 80,
        'controlRef': doc_num[:100],
        'sourceFile': f"SMDS Document Extract #{doc['docNo']}",
        'practiceDocument': f"{doc_num} - {title[:150]}",
        'controlTypeDetail': doc_type,
        'csfWho': csf_who[:500],
        'csfWhat': csf_what[:500],
        'csfWhen': csf_when[:200],
        'csfWhere': csf_where[:300],
        'csfWhy': csf_why[:500],
        'csfHow': csf_how[:1000],
        'csfEvidence': csf_evidence[:500],
        'keyActivities': key_activities[:1000],
        'riskAddressed': risk_addressed[:500],
        'standard': standard[:100] if standard else None,
        'Requirements': sections.get('reference', '')[:500] if sections.get('reference') else None,
    }


def process_batch(conn, batch_size=25, offset=0, limit=0):
    """Process a batch of documents. Returns count processed."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Count total pending
    cur.execute('SELECT COUNT(*) as cnt FROM "DocumentExtract" WHERE "Status" = \'Not Started\'')
    total_pending = cur.fetchone()['cnt']
    print(f"\n{'='*60}")
    print(f"Total pending documents: {total_pending}")
    print(f"Batch size: {batch_size}, Offset: {offset}")
    
    # Fetch batch
    query = '''
        SELECT id, "docNo", "documentNumber", "documentType", "documentTitle", 
               content, custodian, authorizer, "Status"
        FROM "DocumentExtract"
        WHERE "Status" = 'Not Started'
        ORDER BY "docNo"
        LIMIT %s OFFSET %s
    '''
    cur.execute(query, (batch_size, offset))
    docs = cur.fetchall()
    
    if not docs:
        print("No pending documents found.")
        cur.close()
        return 0
    
    print(f"Processing {len(docs)} documents...")
    
    processed = 0
    now = datetime.now(timezone.utc)
    
    for doc in docs:
        doc_no = doc['docNo']
        doc_title = (doc['documentTitle'] or 'Untitled')[:80]
        doc_id = doc['id']
        
        print(f"  [{doc_no}] {doc_title}...", end=' ', flush=True)
        
        try:
            # Parse sections
            sections = parse_sections(doc['content'] or '')
            
            # Extract control
            control = extract_control_statement(doc, sections)
            
            # Insert into ControlFromDocument
            insert_sql = '''
                INSERT INTO "ControlFromDocument" (
                    "id", "documentExtractId", "name", "statement", "controlType",
                    "processAreaId", "isHsseCritical", "riskWeight", "rawHealthScore",
                    "controlRef", "sourceFile", "practiceDocument", "controlTypeDetail",
                    "csfWho", "csfWhat", "csfWhen", "csfWhere", "csfWhy", "csfHow",
                    "csfEvidence", "keyActivities", "riskAddressed", "standard",
                    "Requirements", "createdAt"
                ) VALUES (
                    %(id)s, %(documentExtractId)s, %(name)s, %(statement)s, %(controlType)s,
                    %(processAreaId)s, %(isHsseCritical)s, %(riskWeight)s, %(rawHealthScore)s,
                    %(controlRef)s, %(sourceFile)s, %(practiceDocument)s, %(controlTypeDetail)s,
                    %(csfWho)s, %(csfWhat)s, %(csfWhen)s, %(csfWhere)s, %(csfWhy)s, %(csfHow)s,
                    %(csfEvidence)s, %(keyActivities)s, %(riskAddressed)s, %(standard)s,
                    %(Requirements)s, NOW()
                )
            '''
            cur.execute(insert_sql, control)
            
            # Mark document as completed
            cur.execute(
                'UPDATE "DocumentExtract" SET "Status" = %s, "CompletedOn" = %s WHERE id = %s',
                ('Completed', now, doc_id)
            )
            
            conn.commit()
            processed += 1
            print("✓")
            
        except Exception as e:
            conn.rollback()
            print(f"✗ ERROR: {str(e)[:100]}")
    
    cur.close()
    
    print(f"\n✅ Batch complete: {processed} documents processed.")
    
    # Show stats
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "ControlFromDocument"')
    total_controls = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "DocumentExtract" WHERE "Status" = \'Completed\'')
    total_completed = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "DocumentExtract" WHERE "Status" = \'Not Started\'')
    total_remaining = cur.fetchone()[0]
    cur.close()
    
    print(f"Stats: {total_controls} controls extracted, {total_completed} docs completed, {total_remaining} docs remaining")
    
    return processed


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Extract controls from DocumentExtract records')
    parser.add_argument('--batch-size', type=int, default=25, help='Number of documents per batch')
    parser.add_argument('--batch-start', type=int, default=0, help='Starting offset (0-based)')
    parser.add_argument('--limit', type=int, default=0, help='Max total to process (0 = all)')
    args = parser.parse_args()
    
    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    
    try:
        batch_size = args.batch_size
        offset = args.batch_start
        total_processed = 0
        max_total = args.limit if args.limit > 0 else float('inf')
        
        while total_processed < max_total:
            remaining = max_total - total_processed
            current_batch = min(batch_size, remaining)
            
            processed = process_batch(conn, batch_size=current_batch, offset=offset)
            
            if processed == 0:
                break
            
            total_processed += processed
            offset += processed
            
            if total_processed < max_total:
                print(f"\n--- Progress: {total_processed} total processed ---")
        
        print(f"\n🎉 Extraction complete! Total processed: {total_processed}")
        
    finally:
        conn.close()


if __name__ == '__main__':
    main()
