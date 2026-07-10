"""
Control Extraction Script v2.0
==============================
Processes DocumentExtract records in batches, identifies ALL distinct control
statements within each document's content using the Control Statement Framework
(CSF: 5W+1H), populates ControlFromDocument, and tracks progress.

Core Principle:
  ONE control = ONE complete CSF statement (Who/What/When/Where/Why/How/Evidence)
  ONE document = MANY possible controls (0 to N)

Source-Agnostic:
  Works with any document type stored in DocumentExtract.content — SEAM practices,
  ISO standards, corporate policies, work instructions, regulatory docs, etc.

Usage:
  python scripts/extract_controls.py [--batch-size 5] [--batch-start 0] [--limit 0]
  python scripts/extract_controls.py --doc-id <cuid>   # single document

Batch tracking:
  - Documents with all controls extracted are marked Status='Completed'
  - CompletedOn is set to current timestamp
  - Re-running is idempotent — skips already-Completed documents
"""

import os
import sys
import re
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import psycopg2
import psycopg2.extras


# ═══════════════════════════════════════════════════════════════════════════════
# SCHEMA-AWARE CONSTANTS — MUST match prisma/schema.prisma enums
# ═══════════════════════════════════════════════════════════════════════════════

VALID_CONTROL_TYPES = {
    'Administrative',
    'Procedural',
    'Analytical',
    'Behavioral',
    'Informational',
    'Engineering',
}

# ── Classification mapping: internal label → valid Prisma enum value ──
# These are the ONLY allowed output values. Any new classification logic
# MUST map to one of these exact strings.
CONTROL_TYPE_CLASSIFICATION = {
    # Behavioral indicators → Behavioral
    'behavioral': 'Behavioral',
    # Engineering/design indicators → Engineering
    'engineering': 'Engineering',
    # Analytical/review indicators → Analytical
    'analytical': 'Analytical',
    # Operational/procedural indicators → Procedural
    'procedural': 'Procedural',
    # Informational/reporting → Informational
    'informational': 'Informational',
    # Default / policy / governance → Administrative
    'administrative': 'Administrative',
}


# ---------------------------------------------------------------------------
# DATABASE
# ---------------------------------------------------------------------------

def get_db_url():
    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        return db_url
    for env_file in ['.env', '.env.local']:
        env_path = os.path.join(os.path.dirname(__file__), '..', env_file)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DATABASE_URL='):
                        return line.split('=', 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("DATABASE_URL not found in env or .env files")


# ---------------------------------------------------------------------------
# TEXT CLEANING
# ---------------------------------------------------------------------------

def clean_text(text):
    """Remove markup artifacts and normalize whitespace."""
    if not text:
        return ""
    text = re.sub(r'\|[\s\-:|]+\|', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\|\s*', ' ', text)
    text = re.sub(r'Printed\s+\d+/\d+/\d+.*?Page\s+\d+\s+of\s+\d+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Printed copies are uncontrolled\.?', '', text, flags=re.IGNORECASE)
    text = text.replace('\x00', '')
    return text.strip()


# ---------------------------------------------------------------------------
# SECTION PARSING (source-agnostic — 30+ header patterns)
# ---------------------------------------------------------------------------

SECTION_PATTERNS = [
    (r'(?:^|\n)\s*PURPOSE\s*\n', 'purpose'),
    (r'(?:^|\n)\s*OBJECTIVE', 'purpose'),
    (r'(?:^|\n)\s*SCOPE\s*\n', 'scope'),
    (r'(?:^|\n)\s*APPLICABILITY', 'scope'),
    (r'(?:^|\n)\s*ROLES\s*(?:&|AND)\s*RESPONSIBILIT', 'roles'),
    (r'(?:^|\n)\s*RESPONSIBILIT', 'roles'),
    (r'(?:^|\n)\s*ACCOUNTABILIT', 'roles'),
    (r'(?:^|\n)\s*PROCEDURE\s*\n', 'procedure'),
    (r'(?:^|\n)\s*PROCESS\s*\n', 'procedure'),
    (r'(?:^|\n)\s*METHOD\s*\n', 'procedure'),
    (r'(?:^|\n)\s*INSTRUCTIONS?\s*\n', 'procedure'),
    (r'(?:^|\n)\s*WORKFLOW', 'procedure'),
    (r'(?:^|\n)\s*STEPS?\s*\n', 'procedure'),
    (r'(?:^|\n)\s*REFERENCE', 'reference'),
    (r'(?:^|\n)\s*RELATED\s*DOCUMENT', 'reference'),
    (r'(?:^|\n)\s*STANDARD', 'reference'),
    (r'(?:^|\n)\s*RELEVANT\s*ACRONYMS', 'definitions'),
    (r'(?:^|\n)\s*DEFINITIONS', 'definitions'),
    (r'(?:^|\n)\s*GLOSSARY', 'definitions'),
    (r'(?:^|\n)\s*TERMS?\s*(?:&|AND)\s*DEFINITIONS', 'definitions'),
    (r'(?:^|\n)\s*REQUIREMENTS?\s*\n', 'requirements'),
    (r'(?:^|\n)\s*POLICY\s*\n', 'requirements'),
    (r'(?:^|\n)\s*GUIDELINES?\s*\n', 'procedure'),
    (r'(?:^|\n)\s*INTRODUCTION', 'purpose'),
    (r'(?:^|\n)\s*BACKGROUND', 'purpose'),
    (r'(?:^|\n)\s*OVERVIEW', 'purpose'),
    (r'(?:^|\n)\s*RECORDS?\s*\n', 'evidence'),
    (r'(?:^|\n)\s*EVIDENCE', 'evidence'),
    (r'(?:^|\n)\s*DOCUMENTATION', 'evidence'),
    (r'(?:^|\n)\s*MONITORING', 'monitoring'),
    (r'(?:^|\n)\s*MEASUREMENT', 'monitoring'),
    (r'(?:^|\n)\s*KPI', 'monitoring'),
    (r'(?:^|\n)\s*PERFORMANCE', 'monitoring'),
]


def parse_sections(content):
    """Parse document into sections using common header patterns."""
    sections = {
        'purpose': '', 'scope': '', 'roles': '', 'procedure': '',
        'reference': '', 'definitions': '', 'requirements': '',
        'evidence': '', 'monitoring': '', 'all_text': clean_text(content)
    }
    text = content or ''
    positions = []
    for pattern, name in SECTION_PATTERNS:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            positions.append((m.start(), name))
    positions.sort()
    for i, (pos, name) in enumerate(positions):
        start = pos
        end = positions[i + 1][0] if i + 1 < len(positions) else len(text)
        section_text = text[start:end]
        header_end = section_text.find('\n')
        if header_end > 0:
            section_text = section_text[header_end:].strip()
        cleaned = clean_text(section_text)
        if sections[name]:
            sections[name] += '\n' + cleaned
        else:
            sections[name] = cleaned
    return sections


# ---------------------------------------------------------------------------
# CONTROL CANDIDATE IDENTIFICATION (multi-strategy)
# ---------------------------------------------------------------------------

def split_into_steps(procedure_text):
    """Split procedure into numbered/bulleted steps. Returns [(num, text), ...]."""
    if not procedure_text:
        return []
    steps = []
    numbered = re.findall(
        r'(?:^|\n)\s*(\d+[\.\)\:\-\–]\s*)(.*?)(?=(?:\n\s*\d+[\.\)\:\-\–])|\Z)',
        procedure_text, re.DOTALL
    )
    if numbered:
        for num, text in numbered:
            text = text.strip()
            if len(text) > 40:
                steps.append((int(re.match(r'\d+', num).group()), text))
        if len(steps) >= 2:
            return steps
    bullets = re.findall(
        r'(?:^|\n)\s*[•\-\*\→\✓\☐\▪]\s*(.*?)(?=(?:\n\s*[•\-\*\→\✓\☐\▪])|\Z)',
        procedure_text, re.DOTALL
    )
    if bullets and len(bullets) >= 2:
        for i, text in enumerate(bullets, 1):
            text = text.strip()
            if len(text) > 40:
                steps.append((i, text))
    if not steps:
        lettered = re.findall(
            r'(?:^|\n)\s*([a-zA-Z][\.\)]\s*)(.*?)(?=(?:\n\s*[a-zA-Z][\.\)])|\Z)',
            procedure_text, re.DOTALL
        )
        if lettered and len(lettered) >= 2:
            for i, (letter, text) in enumerate(lettered, 1):
                text = text.strip()
                if len(text) > 40:
                    steps.append((i, text))
    return steps


def split_into_requirement_statements(text):
    """Split requirements into individual shall/must statements."""
    if not text:
        return []
    statements = []
    pattern = r'([^.!?]*(?:shall|must|is\s+responsible\s+for|is\s+accountable\s+for|ensures?\s+that|required\s+to)[^.!?]*[.!?])'
    matches = re.findall(pattern, text, re.IGNORECASE)
    for i, m in enumerate(matches, 1):
        m = m.strip()
        if len(m) > 50:
            statements.append((i, m))
    return statements


def extract_roles_from_section(roles_text):
    """Extract (role_title, responsibility) tuples from ROLES section."""
    if not roles_text:
        return []
    roles = []
    role_pattern = re.findall(
        r'(?:The\s+)?([A-Z][A-Za-z\s/]+(?:Manager|Engineer|Lead|Personnel|Supervisor|Officer|Coordinator|Technician|Specialist|Custodian|Owner|Advisor|Inspector|Assessor|Auditor|Operator|Planner|Scheduler|Administrator|Director|Head|VP|President))\s*(?:shall|is\s+responsible\s+for|is\s+accountable\s+for|ensures?\s+that|must|will)\s+(.{30,500}?)(?=(?:The\s+[A-Z]|\Z))',
        roles_text, re.DOTALL
    )
    for role_title, responsibility in role_pattern:
        role_title = role_title.strip()
        responsibility = responsibility.strip().rstrip('.')
        if len(responsibility) > 30:
            roles.append((role_title, responsibility))
    if not roles:
        simple_roles = re.findall(
            r'(?:^|\n)\s*([A-Z][A-Za-z\s/]{3,60}?)\s*[:\-\–]\s*(.{20,300}?)(?=\n\s*[A-Z][A-Za-z\s/]{3,60}?\s*[:\-\–]|\Z)',
            roles_text, re.DOTALL
        )
        for role_title, responsibility in simple_roles:
            role_title = role_title.strip()
            responsibility = responsibility.strip()
            if len(responsibility) > 20:
                roles.append((role_title, responsibility))
    return roles


def identify_control_candidates(doc, sections):
    """
    Identify ALL distinct control candidates within a document.

    Strategies (tried in order):
      1. PROCEDURE steps → each major step is a potential control
      2. REQUIREMENTS statements → each shall/must is a potential control
      3. ROLES-based → each role+responsibility is a potential control
      4. Whole-document fallback → 1 control from entire document

    Returns list of candidate dicts with scoped CSF fields.
    """
    candidates = []
    all_text = sections['all_text']
    procedure_text = sections['procedure']
    requirements_text = sections['requirements']
    roles_text = sections['roles']
    purpose_text = sections['purpose']
    scope_text = sections['scope']
    evidence_text = sections.get('evidence', '')
    doc_title = doc['documentTitle'] or 'Untitled'

    # Strategy 1: Procedure Steps
    steps = split_into_steps(procedure_text)
    if steps:
        for step_num, step_text in steps:
            context = step_text + ' ' + purpose_text
            candidates.append({
                'source': 'step', 'step_number': step_num,
                'context_text': step_text,
                'who': _extract_who(step_text, roles_text, doc),
                'what': _extract_what(step_text, doc_title),
                'when': _extract_when(step_text),
                'where': _extract_where(step_text, scope_text),
                'why': _extract_why(step_text, purpose_text, doc_title),
                'how': step_text[:800],
                'evidence': _extract_evidence(step_text, evidence_text),
                'risk_context': context,
            })

    # Strategy 2: Requirement Statements
    if not candidates:
        req_statements = split_into_requirement_statements(requirements_text or procedure_text)
        if req_statements:
            for step_num, req_text in req_statements:
                context = req_text + ' ' + purpose_text
                candidates.append({
                    'source': 'requirement', 'step_number': step_num,
                    'context_text': req_text,
                    'who': _extract_who(req_text, roles_text, doc),
                    'what': _extract_what(req_text, doc_title),
                    'when': _extract_when(req_text),
                    'where': _extract_where(req_text, scope_text),
                    'why': _extract_why(req_text, purpose_text, doc_title),
                    'how': req_text[:800],
                    'evidence': _extract_evidence(req_text, evidence_text),
                    'risk_context': context,
                })

    # Strategy 3: Role-Based
    if not candidates:
        role_entries = extract_roles_from_section(roles_text)
        if role_entries:
            for i, (role_title, responsibility) in enumerate(role_entries, 1):
                context = responsibility + ' ' + purpose_text
                candidates.append({
                    'source': 'role', 'step_number': i,
                    'context_text': responsibility,
                    'who': role_title,
                    'what': _extract_what(responsibility, doc_title),
                    'when': _extract_when(responsibility),
                    'where': _extract_where(responsibility, scope_text),
                    'why': _extract_why(responsibility, purpose_text, doc_title),
                    'how': responsibility[:800],
                    'evidence': _extract_evidence(responsibility, evidence_text),
                    'risk_context': context,
                })

    # Strategy 4: Whole-Document Fallback
    if not candidates:
        summary = procedure_text[:1000] if procedure_text else all_text[:1000]
        candidates.append({
            'source': 'document', 'step_number': 1,
            'context_text': summary,
            'who': _extract_who(all_text, roles_text, doc),
            'what': doc_title,
            'when': _extract_when(all_text),
            'where': _extract_where(scope_text or all_text, scope_text),
            'why': purpose_text[:500] if purpose_text else f"Ensure proper execution of {doc_title}",
            'how': summary,
            'evidence': _extract_evidence(all_text, evidence_text),
            'risk_context': all_text,
        })

    return candidates


# ---------------------------------------------------------------------------
# CSF FIELD EXTRACTORS (scoped to individual control context)
# ---------------------------------------------------------------------------

def _extract_who(context_text, roles_text, doc):
    who_parts = []
    role_in_context = re.findall(
        r'(?:The\s+)?([A-Z][A-Za-z\s/]+(?:Manager|Engineer|Lead|Personnel|Supervisor|Officer|Coordinator|Technician|Specialist|Custodian|Owner|Advisor|Inspector|Assessor|Auditor|Operator|Planner|Scheduler|Administrator))',
        context_text
    )
    for r in role_in_context[:2]:
        r_clean = r.strip()
        if r_clean and r_clean not in who_parts:
            who_parts.append(r_clean)
    if not who_parts:
        for role_title, _ in extract_roles_from_section(roles_text)[:3]:
            if role_title not in who_parts:
                who_parts.append(role_title)
    if not who_parts:
        custodian = (doc.get('custodian') or '').strip()
        if custodian:
            who_parts.append(custodian)
    if not who_parts:
        who_parts.append('Assigned Personnel')
    return '; '.join(who_parts[:4])


def _extract_what(context_text, doc_title):
    action_match = re.search(
        r'(?:^|[.!?]\s*)([A-Z][^.!?]{20,200}(?:ensures?|performs?|conducts?|executes?|reviews?|approves?|verifies?|validates?|monitors?|inspects?|tests?|assesses?|evaluates?|develops?|implements?|maintains?|manages?|documents?|records?|reports?|communicates?|coordinates?|investigates?|analyz|analys|identifies?|establishes?|creates?|updates?|defines?|determines?|confirms?)[^.!?]*[.!?])',
        context_text, re.IGNORECASE
    )
    if action_match:
        return action_match.group(1).strip()[:500]
    first_sent = re.match(r'([^.!?]{30,300}[.!?])', context_text)
    if first_sent:
        return first_sent.group(1).strip()[:500]
    return doc_title[:500]


def _extract_when(context_text):
    freq_patterns = [
        (r'\b(?:daily|each\s+day|every\s+day)\b', 'Daily'),
        (r'\b(?:weekly|each\s+week|every\s+week)\b', 'Weekly'),
        (r'\b(?:monthly|each\s+month|every\s+month|per\s+month)\b', 'Monthly'),
        (r'\b(?:quarterly|each\s+quarter|every\s+quarter|per\s+quarter)\b', 'Quarterly'),
        (r'\b(?:annually|yearly|each\s+year|every\s+year|per\s+year|annual)\b', 'Annually'),
        (r'\b(?:as\s+needed|as\s+required|on\s+demand|ad[\s-]?hoc|when\s+required)\b', 'As Needed'),
        (r'\b(?:continuous|real[\s-]?time|ongoing|continuously)\b', 'Continuous'),
        (r'\bbefore\s+(?:each|every|any|commencing|starting|beginning)\b', 'Before Each Use'),
        (r'\bafter\s+(?:each|every|any|completing|finishing)\b', 'After Each Use'),
        (r'\b(?:per\s+shift|each\s+shift|every\s+shift)\b', 'Per Shift'),
        (r'\b(?:bi[\s-]?weekly|fortnightly|every\s+two\s+weeks)\b', 'Bi-Weekly'),
        (r'\b(?:bi[\s-]?monthly|every\s+two\s+months)\b', 'Bi-Monthly'),
        (r'\b(?:semi[\s-]?annually|twice\s+(?:a|per)\s+year)\b', 'Semi-Annually'),
    ]
    for pattern, freq in freq_patterns:
        if re.search(pattern, context_text, re.IGNORECASE):
            return freq
    return 'As Required'


def _extract_where(context_text, scope_text):
    where_parts = []
    sys_pattern = r'(?:in|on|using|within|via|through)\s+(?:the\s+)?([A-Z][A-Za-z0-9\s/-]{3,40}?(?:System|Equipment|Database|Server|Panel|Controller|Network|Application|Platform|Software|Tool|Module|Portal|Repository|Register|Log|Dashboard))'
    for match in re.findall(sys_pattern, context_text, re.IGNORECASE):
        m = match.strip()
        if m and m not in where_parts:
            where_parts.append(m)
    if not where_parts and scope_text:
        for match in re.findall(sys_pattern, scope_text, re.IGNORECASE):
            m = match.strip()
            if m and m not in where_parts:
                where_parts.append(m)
    if not where_parts:
        acronyms = re.findall(
            r'\b(Honeywell|IPS|PCS7|PLC|DCS|SCADA|SIS|ESD|FGS|BMS|SAP|MAXIMO|OSIsoft|PI|LIMS|QMS|EMS|ERP|EHS)\b',
            context_text, re.IGNORECASE
        )
        for a in set(acronyms):
            where_parts.append(a.upper())
    return '; '.join(where_parts[:3]) if where_parts else 'Organizational Systems'


def _extract_why(context_text, purpose_text, doc_title):
    purpose_kw = r'(?:ensures?|prevent|mitigate|confirm|verify|protect|maintain|comply|achieve|improve|reduce|eliminate|control|manage|address|support|enable|facilitate|provide|establish)'
    matches = re.findall(rf'[^.!?]+{purpose_kw}[^.!?]*[.!?]', context_text, re.IGNORECASE)
    if matches:
        return ' '.join(matches[:2])[:500]
    if purpose_text:
        return purpose_text[:500]
    return f"Ensure proper execution of {doc_title}"


def _extract_evidence(context_text, evidence_text):
    evidence_keywords = [
        'record', 'log', 'report', 'checklist', 'form', 'register',
        'certificate', 'sign-off', 'signoff', 'approval', 'screenshot',
        'printout', 'data file', 'permit', 'work order', 'inspection report',
        'test result', 'audit trail', 'meeting minutes', 'photograph',
        'video', 'email', 'memo', 'tag', 'label', 'receipt', 'invoice',
        'training record', 'competency record', 'calibration certificate',
    ]
    found = set()
    search_text = context_text + ' ' + evidence_text
    for kw in evidence_keywords:
        if re.search(r'\b' + re.escape(kw) + r'\b', search_text, re.IGNORECASE):
            found.add(kw.title())
    return '; '.join(sorted(found)[:6]) if found else 'Documented records of activity completion'


# ---------------------------------------------------------------------------
# CONTROL ASSEMBLY
# ---------------------------------------------------------------------------

# Module-level cache for sections (used by build_control_record)
_sections_cache = {}

INSERT_SQL = '''
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


def build_control_record(doc, candidate, index, total_candidates):
    """Build a ControlFromDocument dict from a control candidate."""
    doc_id = doc['id']
    title = doc['documentTitle'] or 'Untitled'
    doc_num = doc['documentNumber'] or ''
    doc_type = doc['documentType'] or 'Procedure'
    doc_no = doc['docNo']

    # Name
    what_short = candidate['what'][:120].strip()
    if total_candidates > 1:
        name = f"{title[:120]} — Control #{index}/{total_candidates}: {what_short}"
    else:
        name = f"{title[:120]} — {what_short}"
    name = name[:200]

    # One-line CSF Statement
    statement = (
        f"{candidate['who']} performs {candidate['what']} "
        f"{candidate['when']} in {candidate['where']} "
        f"to {candidate['why']}, "
        f"using documented procedure, "
        f"with {candidate['evidence']} as evidence."
    )
    if len(statement) > 2000:
        statement = statement[:1997] + '...'

    # Control Type — MUST be a valid Prisma ControlType enum value
    context = candidate.get('context_text', '') + ' ' + candidate.get('risk_context', '')
    doc_type_lower = (doc_type or '').lower()

    if re.search(r'\b(?:behavi|mindset|culture|awareness|competenc|training|capabilit|skill|attitude|human\s*factor)\b', context, re.IGNORECASE):
        control_type = 'Behavioral'
    elif re.search(r'\b(?:design|engineer|install|construct|fabricat|commission|technical\s*specif|drawing|calculation|structural)\b', context, re.IGNORECASE):
        control_type = 'Engineering'
    elif re.search(r'\b(?:analyz|analys|assess|evaluate|review|investigate|measure|monitor|test|inspect|verify|validate|audit|check|examine)\b', context, re.IGNORECASE):
        control_type = 'Analytical'
    elif re.search(r'\b(?:operate|execute|perform|conduct|carry\s*out|undertake|complete|implement|do|run)\b', context, re.IGNORECASE):
        control_type = 'Procedural'
    elif 'procedure' in doc_type_lower or 'instruction' in doc_type_lower or 'work instruction' in doc_type_lower:
        control_type = 'Procedural'
    elif 'policy' in doc_type_lower or 'standard' in doc_type_lower:
        control_type = 'Administrative'
    elif 'narrative' in doc_type_lower or 'report' in doc_type_lower:
        control_type = 'Informational'
    else:
        control_type = 'Administrative'

    # ── GUARD: ensure control_type is a valid Prisma enum value ──
    assert control_type in VALID_CONTROL_TYPES, \
        f"INVALID CONTROL TYPE '{control_type}' — must be one of {sorted(VALID_CONTROL_TYPES)}"

    # Risk Weight
    risk_context = candidate.get('risk_context', '')
    if re.search(r'\b(?:critical|high\s*risk|safety|HSSE|process\s*safety|life\s+safety|major\s*accident|loss\s*of\s*containment|fatal|catastrophic|explosion|toxic|fire)\b', risk_context, re.IGNORECASE):
        risk_weight = 3
    elif re.search(r'\b(?:environmental|regulatory|compliance|legal|spill|release|pollution|contamination|permit\s*violation|enforcement)\b', risk_context, re.IGNORECASE):
        risk_weight = 2
    else:
        risk_weight = 1

    # HSSE Critical
    is_hsse = bool(re.search(
        r'\b(?:HSSE|safety\s*critical|process\s*safety|life\s*safety|major\s*accident|loss\s*of\s*containment|fatal|catastrophic)\b',
        risk_context, re.IGNORECASE
    ))

    # Standard Reference
    sections = _sections_cache.get(doc_id, {})
    all_refs = (doc_num or '') + ' ' + (sections.get('reference', '') or '')
    std_match = re.search(
        r'\b(?:ISO\s*\d{4,5}(?::\d{4})?|SEAM\s*\d+\.\d+|BP-[A-Z]+-\d+|OSHA\s*\d+|API\s*\d+|IEC\s*\d+|ANSI\s*\d+|NFPA\s*\d+)\b',
        all_refs, re.IGNORECASE
    )
    standard = std_match.group(0) if std_match else None

    # Control Ref
    if total_candidates > 1:
        control_ref = f"{doc_num}-{index:03d}" if doc_num else f"DOC-{doc_no}-{index:03d}"
    else:
        control_ref = (doc_num[:100] if doc_num else f"DOC-{doc_no}")

    return {
        'id': str(uuid.uuid4()),
        'documentExtractId': doc_id,
        'name': name,
        'statement': statement,
        'controlType': control_type,
        'processAreaId': '',
        'isHsseCritical': is_hsse,
        'riskWeight': risk_weight,
        'rawHealthScore': 80,
        'controlRef': control_ref[:100],
        'sourceFile': f"Document Extract #{doc_no}",
        'practiceDocument': f"{doc_num} - {title[:150]}" if doc_num else title[:200],
        'controlTypeDetail': f"{doc_type} › {candidate['source']}",
        'csfWho': candidate['who'][:500],
        'csfWhat': candidate['what'][:500],
        'csfWhen': candidate['when'][:200],
        'csfWhere': candidate['where'][:300],
        'csfWhy': candidate['why'][:500],
        'csfHow': candidate['how'][:1000],
        'csfEvidence': candidate['evidence'][:500],
        'keyActivities': candidate['how'][:1000],
        'riskAddressed': candidate['why'][:500],
        'standard': standard[:100] if standard else None,
        'Requirements': (sections.get('requirements', '') or '')[:500],
    }


# ---------------------------------------------------------------------------
# PROCESSING
# ---------------------------------------------------------------------------

def process_document(doc, cur):
    """Process one document: identify controls, insert them. Returns (count, error)."""
    global _sections_cache
    doc_id = doc['id']
    sections = parse_sections(doc['content'] or '')
    _sections_cache[doc_id] = sections
    candidates = identify_control_candidates(doc, sections)
    if not candidates:
        return (0, "no control candidates identified")
    for i, candidate in enumerate(candidates, 1):
        control = build_control_record(doc, candidate, i, len(candidates))
        cur.execute(INSERT_SQL, control)
    return (len(candidates), None)


def process_batch(conn, batch_size=5, offset=0):
    """Process a batch of documents. Returns (docs_processed, controls_extracted)."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute('SELECT COUNT(*) as cnt FROM "DocumentExtract" WHERE "Status" = \'Not Started\'')
    total_pending = cur.fetchone()['cnt']

    print(f"\n{'='*70}")
    print(f"  CONTROL EXTRACTION ENGINE v2.0")
    print(f"  Pending: {total_pending} | Batch: {batch_size} | Offset: {offset}")
    print(f"{'='*70}")

    cur.execute(
        'SELECT id, "docNo", "documentNumber", "documentType", "documentTitle", '
        'content, custodian, authorizer, "Status" '
        'FROM "DocumentExtract" WHERE "Status" = \'Not Started\' '
        'ORDER BY "docNo" LIMIT %s OFFSET %s',
        (batch_size, offset)
    )
    docs = cur.fetchall()

    if not docs:
        print("  No pending documents found.")
        cur.close()
        return (0, 0)

    print(f"  Processing {len(docs)} documents...\n")

    docs_processed = 0
    total_controls = 0
    now = datetime.now(timezone.utc)

    for doc in docs:
        doc_no = doc['docNo']
        doc_title = (doc['documentTitle'] or 'Untitled')[:70]
        doc_id = doc['id']

        print(f"  [{doc_no:>4}] {doc_title}...", end=' ', flush=True)

        try:
            num_controls, error = process_document(doc, cur)
            if error:
                print(f"⚠ {error}")
            else:
                print(f"✓ ({num_controls} control{'s' if num_controls != 1 else ''})")

            cur.execute(
                'UPDATE "DocumentExtract" SET "Status" = %s, "CompletedOn" = %s WHERE id = %s',
                ('Completed', now, doc_id)
            )
            conn.commit()
            docs_processed += 1
            total_controls += num_controls

        except Exception as e:
            conn.rollback()
            print(f"✗ ERROR: {str(e)[:120]}")

    cur.close()

    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM "ControlFromDocument"')
    grand_ctrl = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "DocumentExtract" WHERE "Status" = \'Completed\'')
    grand_docs = cur.fetchone()[0]
    cur.execute('SELECT COUNT(*) FROM "DocumentExtract" WHERE "Status" = \'Not Started\'')
    remaining = cur.fetchone()[0]
    cur.close()

    print(f"\n  {'─'*60}")
    print(f"  Batch: {docs_processed} docs → {total_controls} controls")
    print(f"  Total: {grand_docs} docs → {grand_ctrl} controls | Remaining: {remaining}")
    print(f"  {'─'*60}")
    return (docs_processed, total_controls)


def process_single_document(conn, doc_id):
    """Process a single document by ID (for targeted re-extraction)."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        'SELECT id, "docNo", "documentNumber", "documentType", "documentTitle", '
        'content, custodian, authorizer, "Status" '
        'FROM "DocumentExtract" WHERE id = %s',
        (doc_id,)
    )
    doc = cur.fetchone()
    if not doc:
        print(f"Document not found: {doc_id}")
        cur.close()
        return

    print(f"\n{'='*70}")
    print(f"  SINGLE DOCUMENT EXTRACTION")
    print(f"  Doc #{doc['docNo']}: {(doc['documentTitle'] or 'Untitled')[:80]}")
    print(f"{'='*70}\n")

    cur.execute('DELETE FROM "ControlFromDocument" WHERE "documentExtractId" = %s', (doc_id,))
    deleted = cur.rowcount
    if deleted:
        print(f"  Cleared {deleted} existing control(s) for re-extraction.\n")

    try:
        num_controls, error = process_document(doc, cur)
        if error:
            print(f"  ⚠ {error}")
        else:
            print(f"  ✓ Extracted {num_controls} control(s)")

        now = datetime.now(timezone.utc)
        cur.execute(
            'UPDATE "DocumentExtract" SET "Status" = %s, "CompletedOn" = %s WHERE id = %s',
            ('Completed', now, doc_id)
        )
        conn.commit()

        cur.execute(
            'SELECT name, statement FROM "ControlFromDocument" WHERE "documentExtractId" = %s ORDER BY "controlRef"',
            (doc_id,)
        )
        controls = cur.fetchall()
        for i, c in enumerate(controls, 1):
            print(f"\n  ┌─ Control #{i}")
            print(f"  │ Name: {c['name'][:120]}")
            print(f"  │ Statement: {c['statement'][:200]}...")
            print(f"  └{'─'*50}")

    except Exception as e:
        conn.rollback()
        print(f"  ✗ ERROR: {e}")

    cur.close()


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description='Extract controls from DocumentExtract records using CSF framework v2.0'
    )
    parser.add_argument('--batch-size', type=int, default=5,
                        help='Documents per batch (default: 5)')
    parser.add_argument('--batch-start', type=int, default=0,
                        help='Starting offset (default: 0)')
    parser.add_argument('--limit', type=int, default=0,
                        help='Max docs to process (0 = all)')
    parser.add_argument('--doc-id', type=str, default=None,
                        help='Process a single document by ID')
    args = parser.parse_args()

    db_url = get_db_url()
    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        if args.doc_id:
            process_single_document(conn, args.doc_id)
        else:
            batch_size = args.batch_size
            offset = args.batch_start
            total_docs = 0
            total_ctrls = 0
            max_total = args.limit if args.limit > 0 else float('inf')

            while total_docs < max_total:
                remaining = max_total - total_docs
                current_batch = min(batch_size, int(remaining))
                docs, ctrls = process_batch(conn, batch_size=current_batch, offset=offset)
                if docs == 0:
                    break
                total_docs += docs
                total_ctrls += ctrls
                offset += docs

            print(f"\n  🎉 Done! {total_docs} docs → {total_ctrls} controls")

    finally:
        conn.close()


if __name__ == '__main__':
    main()
