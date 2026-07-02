# Dynamic CSV Templates Architecture

## Overview

The CSV import and export functionality now uses **dynamic schema-based templates** instead of hardcoded examples. When you select a table, the template automatically updates to show all current columns.

---

## Problem Solved

### Before (Hardcoded Templates)
- ❌ Downloading CSV template showed outdated column list
- ❌ Adding new fields to schema required manual template updates
- ❌ Risk of users uploading CSV with wrong columns
- ❌ Template examples hard-coded in frontend

### After (Dynamic Templates)
- ✅ **Template reflects actual live schema** - always accurate
- ✅ **Automatic column discovery** - new fields appear immediately
- ✅ **Sample data generated dynamically** - appropriate for each field type
- ✅ **Column list displayed** - users see all available fields before downloading

---

## How It Works

### 1. Template Generation API

**New Endpoint:** `GET /api/admin/table/[table]/template`

Returns the schema-derived CSV template for any table:

```typescript
// Request
GET /api/admin/table/Control/template

// Response
{
  "table": "Control",
  "columns": [
    "id", "sourceFile", "controlRef", "practiceDocument", "name", 
    "statement", "controlType", "controlTypeDetail", "processAreaId", 
    "subProcessId", "isHsseCritical", "csfWho", "csfWhat", "csfWhen",
    // ... all 28 columns
  ],
  "sampleRow": [
    "id_123456", "01 Example", "CTRL-001", "Practice.md", "Example Control",
    // ... sample values
  ],
  "example": [
    ["id", "sourceFile", "controlRef", ...], // headers
    ["id_123456", "01 Example", "CTRL-001", ...] // sample row
  ]
}
```

### 2. Smart Sample Data Generation

The template endpoint generates appropriate sample values based on field type:

```typescript
// Relationship fields (ending with 'Id')
fieldName: 'processAreaId' → 'pa_001'

// Boolean fields
fieldName: 'isHsseCritical' → 'true'

// Integer fields
fieldName: 'riskWeight' → '1'

// DateTime fields
fieldName: 'createdAt' → '2026-06-23T10:00:00Z'

// Named fields (use lookup dictionary)
fieldName: 'controlType' → 'Administrative'
fieldName: 'status' → 'Active'
fieldName: 'csfWho' → 'Process Owner'
```

### 3. Updated Import Page

**File:** `src/app/admin/import-csv/page.tsx`

**Before:**
```typescript
const tableExamples = {
  Control: [
    ['sourceFile', 'controlId', 'practiceDocument', ...],
    ['01 AIPSM', 'AIPSM-PHA-001', 'SEAM_Practice.md', ...],
  ],
};

const downloadExample = () => {
  const example = tableExamples[selectedTable];
  // Generate CSV from hardcoded example
};
```

**After:**
```typescript
const [template, setTemplate] = useState<TemplateData | null>(null);
const [tables, setTables] = useState<string[]>([]);

// Load available tables dynamically
useEffect(() => {
  const res = await fetch('/api/admin/tables');
  setTables(res.data.tables);
}, []);

// Load template when table changes
useEffect(() => {
  const res = await fetch(`/api/admin/table/${selectedTable}/template`);
  setTemplate(res.data);
}, [selectedTable]);

// Download uses live template
const downloadExample = () => {
  if (!template) return;
  const rows = [template.columns, template.sampleRow];
  // Generate CSV from live schema
};
```

---

## Features

### 1. Dynamic Table List
- Tables loaded from `/api/admin/tables`
- Automatically includes new models in Prisma schema
- Always current

### 2. Schema-Based Template Generation
```
User selects "Control" table
       ↓
API fetches Control schema from Prisma DMMF
       ↓
Generates 28 column headers
       ↓
Creates sample row with type-appropriate data
       ↓
Returns template as JSON
       ↓
Frontend generates CSV download
```

### 3. Column List Preview
When user selects a table, sidebar shows:
- Total column count (e.g., "✓ 28 columns available")
- Complete list of available columns
- Helpful for validation before download

### 4. Type-Aware Sample Values
Sample data matches field semantics:
- **String** fields get realistic examples ("Administrative", "HEMP Owner")
- **Boolean** fields get "true" or "false"
- **Int** fields get "1"
- **DateTime** fields get ISO 8601 format
- **Relationship ID** fields get pattern like "pa_001"

---

## Example Workflows

### Adding a New Control Column

**1. Update Prisma Schema**
```prisma
model Control {
  // ... existing fields
  auditNotes  String?    // NEW FIELD
}
```

**2. Run Prisma commands**
```bash
npx prisma migrate dev
```

**3. Open Import Page**
- User goes to `/admin/import-csv`
- Selects "Control" table
- Downloads template
- **Template now includes `auditNotes` column!** ✅

No code changes needed.

### Importing Controls with New Column

**Template CSV (auto-generated):**
```
id,sourceFile,controlRef,practiceDocument,name,statement,controlType,...,auditNotes
id_001,01 AIPSM,AIPSM-001,Practice.md,Control Name,Control Statement,Admin,...,Sample notes
```

User fills in their data and imports. The column is validated and saved.

---

## API Endpoints

### Get Available Tables
```
GET /api/admin/tables
→ Returns: { tables: ["User", "ProcessArea", "Control", ...] }
```

### Get Table Template
```
GET /api/admin/table/[table]/template
→ Returns: { table, columns, sampleRow, example }
```

### Get Table Schema (for Column Management)
```
GET /api/admin/table/[table]/columns
→ Returns: { name, columns: [...] }
```

### Get Table Data
```
GET /api/admin/table/[table]/data
→ Returns: { columns, rows, totalRows }
```

### Export Table as CSV
```
GET /api/admin/table/[table]/export
→ Returns: CSV file (all columns from live schema)
```

### Import CSV Data
```
POST /api/admin/import-csv
Body: FormData { file, table }
→ Returns: { success, rowsImported, errors, warnings }
```

---

## Benefits

### 1. **Always Accurate**
- Template reflects current database schema
- No stale column lists
- Users see exactly what's available

### 2. **Self-Documenting**
- Column list shows all available fields
- Sample data shows data format
- Users know what's required vs optional

### 3. **Scalable**
- Works with any schema
- Any number of columns
- Works with new tables automatically

### 4. **Maintainable**
- No hardcoded examples to update
- Single source of truth (Prisma schema)
- Reduced cognitive load

### 5. **Friction-Free**
- Users don't have to guess column names
- Templates are up-to-date automatically
- Clear visual feedback on available columns

---

## Sample Data Strategy

### Field Name Matching
First, check if field name has a direct sample in lookup dictionary:
- `role` → "Assessor"
- `status` → "Active"
- `controlType` → "Administrative"

### Pattern Matching
If no direct match, check field name patterns:
- Ends with `Id` + type String → `pa_001`, `sp_001`
- Name is exactly `id` → generates unique ID

### Type-Based Defaults
If no name or pattern match, use field type:
- String → "Sample Data"
- Int → 1
- Boolean → true
- DateTime → 2026-06-23T10:00:00Z
- Float → 0.0

---

## Testing Checklist

After deployment, verify:

- [ ] `/admin/import-csv` loads tables dynamically
- [ ] Selecting different tables updates template
- [ ] Downloaded CSV has correct column count
- [ ] Downloaded CSV includes all new columns
- [ ] Sample row has appropriate data values
- [ ] Column list sidebar shows all fields
- [ ] CSV import still works with new templates
- [ ] Export endpoint includes all columns
- [ ] New tables appear in import dropdown

---

## Files Changed

### New Files
- `src/app/api/admin/table/[table]/template/route.ts` - Template generation

### Updated Files
- `src/app/admin/import-csv/page.tsx` - Dynamic templates and table loading

### Removed
- Hardcoded `tableExamples` object

---

## Future Enhancements

1. **Column-Level Help Text** - Show descriptions from Prisma comments
2. **Validation Examples** - Show valid enum values if field is enum type
3. **Required Fields Highlight** - Visually mark required vs optional
4. **Field Descriptions** - Pull descriptions from schema comments
5. **Template Variants** - Minimal (required only) vs full (all columns)

---

## Summary

✨ **Schema-driven CSV templates** that stay current automatically and guide users to import correct data formats.

**Key Principle:** *Templates are generated from live schema, never hardcoded.*

---

**Implemented:** 2026-06-23  
**Architecture Pattern:** Dynamic Schema-Based Template Generation  
**Integration:** Works with Dynamic Schema Architecture  
**Status:** ✅ Ready to use
