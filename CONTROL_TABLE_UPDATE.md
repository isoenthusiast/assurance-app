# Control Table - Extended Columns Update

## ✅ What Was Added

All 20 requested columns have been added to the Control table schema and are now fully functional in the admin interface:

### New Columns Added ✅
1. ✅ **sourceFile** - Source file identifier
2. ✅ **controlId** → `controlRef` - Control reference ID
3. ✅ **practiceDocument** - Associated practice document
4. ✅ **processArea** - Already available via relation
5. ✅ **subProcess** - Already available via relation
6. ✅ **controlName** → `name` - Control name (already in schema)
7. ✅ **controlStatement** → `statement` - Control statement (already in schema)
8. ✅ **controlType** - Type of control (already in schema)
9. ✅ **isHSSECritical** - Already in schema as `isHsseCritical`
10. ✅ **csf_who** → `csfWho` - Responsibility/roles
11. ✅ **csf_what** → `csfWhat` - Activities
12. ✅ **csf_when** → `csfWhen` - Timing
13. ✅ **csf_where** → `csfWhere` - Location
14. ✅ **csf_why** → `csfWhy` - Rationale
15. ✅ **csf_how** → `csfHow` - Execution method
16. ✅ **csf_evidence** → `csfEvidence` - Compliance evidence
17. ✅ **keyActivities** - Key activities list
18. ✅ **riskAddressed** - Risk addressed by control
19. ✅ **testingApproach** - How to test control
20. ✅ **uncertainFlags** - Uncertain items flags

**Note:** Most of these columns were already in the Prisma schema but weren't exposed in the admin UI. They're now fully functional!

---

## 📁 Files Modified

### Backend Routes (5 files updated)
1. **`/api/admin/table/[table]/data/route.ts`**
   - Updated Control table schema to include all 28 columns
   - Now returns complete Control data with all fields

2. **`/api/admin/table/[table]/export/route.ts`**
   - Updated CSV export to include all Control columns
   - Proper CSV escaping for all field types

3. **`/api/admin/table/[table]/[id]/route.ts`**
   - No changes needed (generic handler works with all fields)

4. **`/api/admin/table/[table]/route.ts`**
   - Updated POST handler to accept and save all Control fields
   - Automatic ID generation for controlRef if not provided
   - Proper type conversion for all fields

5. **`/api/admin/import-csv/route.ts`**
   - Enhanced CSV import for Controls with column name mapping
   - Maps CSV names to schema names (e.g., `csf_who` → `csfWho`)
   - Handles all 28 fields on import
   - Validates required fields
   - Converts data types appropriately

### Frontend Routes (1 file updated)
1. **`/admin/import-csv/page.tsx`**
   - Updated Control table template example
   - Shows proper format for all new columns

### Documentation (2 new files)
1. **`CONTROL_TABLE_GUIDE.md`** - Complete reference guide
2. **`CONTROL_IMPORT_EXAMPLE.csv`** - CSV template with examples

---

## 🎯 Key Features Now Available

### 1. View All Control Columns
Navigate to `/admin/table/Control` to see all 28 columns:
- Scroll horizontally to see all fields
- Search across any column
- Edit any field inline

### 2. Add Controls with Full Data
Click "➕ Add Row" to create new control with:
- All required fields (name, statement, type, etc.)
- All optional CSF fields
- All reference fields (sourceFile, controlRef, etc.)
- All risk fields

### 3. Import from CSV
Upload CSV with any combination of columns:
- Automatic column name mapping
- Partial imports (don't need all columns)
- Data type validation
- Foreign key verification

### 4. Export Complete Data
Download Control table with:
- All 28 columns
- Proper CSV formatting
- UTF-8 encoding
- All data preserved

---

## 📊 Column Names in Admin UI

### As Displayed in Table View
```
id, sourceFile, controlRef, practiceDocument, name, statement,
controlType, controlTypeDetail, processAreaId, subProcessId,
isHsseCritical, csfWho, csfWhat, csfWhen, csfWhere, csfWhy,
csfHow, csfEvidence, keyActivities, riskAddressed, testingApproach,
uncertainFlags, ramRating, riskWeight, rawHealthScore, lastTestedDate,
lastTestResult, createdAt
```

### As CSV Column Headers (Import)
```
sourceFile, controlId, practiceDocument, controlName, controlStatement,
controlType, controlTypeDetail, isHSSECritical, csf_who, csf_what,
csf_when, csf_where, csf_why, csf_how, csf_evidence, keyActivities,
riskAddressed, testingApproach, uncertainFlags, processAreaId,
subProcessId
```

---

## 🔄 CSV Column Mapping

When importing, these CSV column names are automatically mapped:

| CSV Name | Schema Name | Example |
|----------|-------------|---------|
| `controlId` | `controlRef` | AIPSM-PHA-001 |
| `controlName` | `name` | Establish HAZOP |
| `controlStatement` | `statement` | Each Asset must... |
| `isHSSECritical` | `isHsseCritical` | true |
| `csf_who` | `csfWho` | HEMP Owner |
| `csf_what` | `csfWhat` | Establish plan |
| `csf_when` | `csfWhen` | Ongoing |
| `csf_where` | `csfWhere` | Asset level |
| `csf_why` | `csfWhy` | Compliance |
| `csf_how` | `csfHow` | Document |
| `csf_evidence` | `csfEvidence` | Plan records |

All other column names match directly (no mapping needed).

---

## 📥 How to Import from Combined_Controls.csv

### Step 1: Prepare Your CSV
Extract Control data from Combined_Controls.csv with columns:
- sourceFile (column 1)
- controlId (column 2)
- practiceDocument (column 3)
- processArea (column 4) - Use to find processAreaId
- subProcess (column 5) - Use to find subProcessId
- controlName (column 6)
- controlStatement (column 7)
- controlType (column 8)
- isHSSECritical (column 9)
- csf_who through csf_evidence (columns 10-16)
- keyActivities (column 17)
- riskAddressed (column 18)
- testingApproach (column 19)
- uncertainFlags (column 20)

### Step 2: Get ProcessArea & SubProcess IDs
First import ProcessArea and SubProcess tables, then note their IDs.

### Step 3: Prepare Control CSV
```csv
sourceFile,controlId,practiceDocument,controlName,controlStatement,controlType,isHSSECritical,csf_who,csf_what,csf_when,csf_where,csf_why,csf_how,csf_evidence,keyActivities,riskAddressed,testingApproach,uncertainFlags,processAreaId,subProcessId
"01 AIPSM","AIPSM-PHA-001","Practice.md","Name","Statement","Admin","true","Owner","Do","When","Where","Why","How","Evidence","Activity","Risk","Test","Flags","pa_001","sp_001"
```

### Step 4: Import via Admin Panel
1. Go to `/admin/import-csv`
2. Select "Control" table
3. Upload your CSV
4. Review results

---

## 🔐 Data Validation

### Required Fields
- ✅ `name` - Must have value
- ✅ `statement` - Must have value
- ✅ `controlType` - Must have value
- ✅ `processAreaId` - Must reference valid ProcessArea
- ✅ `subProcessId` - Must reference valid SubProcess

### Optional Fields
All CSF, reference, and detail fields are optional.

### Type Conversion
- **Boolean**: "true"/"false" or "1"/"0" automatically converted
- **Int**: String numbers converted to integers
- **DateTime**: ISO 8601 format required
- **String**: No conversion needed

---

## 🎮 Using the Admin UI

### View Controls
```
http://localhost:3000/admin/table/Control
```
- See all 28 columns
- Scroll right to view additional fields
- Use search to filter

### Edit Control
1. Find row in table
2. Click "Edit" button
3. All fields become editable
4. Click "✓ Save" to update

### Add Control
1. Click "➕ Add Row"
2. Fill in all fields in form
3. Click "Save"
4. New control appears in table

### Delete Control
1. Find row
2. Click "Delete"
3. Confirm deletion
4. Row removed

### Export Controls
1. On Control table, click "Export"
2. CSV file downloads with all fields
3. All controls included

---

## 📋 Example Workflows

### Import All Controls from Combined_Controls.csv

**Prerequisite:** ProcessAreas and SubProcesses already imported

1. Extract Control rows from Combined_Controls.csv
2. Create mapping of processArea/subProcess names to IDs
3. Create Control CSV with proper IDs
4. Go to `/admin/import-csv`
5. Select "Control" table
6. Upload CSV
7. Review and verify import

### Bulk Update Control Type

1. Go to `/admin/table/Control`
2. Click "Export" to download all controls
3. Edit CSV in Excel/Sheets
4. Change `controlType` column values
5. Go to `/admin/import-csv`
6. Upload modified CSV
7. Verify updates

### Add CSF Details to Existing Controls

1. Go to `/admin/table/Control`
2. Find control, click "Edit"
3. Fill in csf_who, csf_what, csf_when, etc.
4. Click "✓ Save"

---

## 🔧 API Endpoints

### Get Control Data (All 28 Columns)
```
GET /api/admin/table/Control/data
→ Returns all controls with all fields
```

### Export Controls as CSV
```
GET /api/admin/table/Control/export
→ Downloads CSV with all fields
```

### Add New Control
```
POST /api/admin/table/Control
Body: { name, statement, controlType, processAreaId, subProcessId, ... }
→ Creates new control with all fields
```

### Update Control
```
PUT /api/admin/table/Control/[id]
Body: { ...fields to update }
→ Updates any fields
```

### Delete Control
```
DELETE /api/admin/table/Control/[id]
→ Deletes control
```

---

## ✨ What Changed in Code

### No Database Migration Needed
All columns were already in the Prisma schema! Just weren't exposed in the admin UI.

### Admin UI Updates
- `/api/admin/table/[table]/data/route.ts` - Added all 28 columns to schema
- `/api/admin/table/[table]/export/route.ts` - Export all columns to CSV
- `/api/admin/table/[table]/route.ts` - Handle all fields on create/update
- `/api/admin/import-csv/route.ts` - Map CSV columns to schema fields

### CSV Import Enhancement
- Automatic column name mapping (CSV → Schema)
- Proper type conversion for all fields
- Foreign key validation
- Required field checking

---

## 🚀 Ready to Use

All features are now live:
- ✅ View all 28 Control columns in admin UI
- ✅ Edit any field inline
- ✅ Add new controls with all fields
- ✅ Import from CSV with automatic mapping
- ✅ Export complete data with all fields
- ✅ Search across all columns
- ✅ Delete controls with validation

---

## 📚 Documentation

See **CONTROL_TABLE_GUIDE.md** for:
- Complete field reference
- CSV format examples
- Import workflow
- API documentation
- Common tasks
- Examples and templates

See **CONTROL_IMPORT_EXAMPLE.csv** for:
- Sample import data
- Proper CSV formatting
- Real SEAM control examples

---

## 🎉 Summary

The Control table now supports full SEAM control data with:
- **28 total columns** covering all control aspects
- **Complete admin UI** for viewing and editing
- **CSV import/export** with automatic mapping
- **Full validation** for data integrity
- **Type-aware** form inputs
- **Search & filter** across all columns

**Start importing:** `/admin/import-csv` → Select "Control" → Upload CSV

---

**Implementation Date:** 2026-06-23  
**Status:** ✅ Complete & Ready to Use  
**Database:** No migration needed (columns already existed)  
**Admin UI:** Fully updated to support all fields
