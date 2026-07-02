# Dynamic Schema Architecture

## Overview

The admin interface now uses **dynamic schema introspection** instead of hardcoded table schemas. This means any changes to the Prisma schema are automatically reflected in the admin UI without manual code updates.

---

## Problem Solved

### Before (Hardcoded Schemas)
- ❌ Every time you add a field to a Prisma model, you had to manually update:
  - `TABLE_SCHEMAS` in `/api/admin/table/[table]/columns/route.ts`
  - `TABLE_SCHEMAS` in `/api/admin/table/[table]/data/route.ts`
  - Column lists in `/api/admin/table/[table]/export/route.ts`
  - `AVAILABLE_TABLES` in `/api/admin/tables/route.ts`
- ❌ Risk of inconsistency (UI showing different columns than actual database)
- ❌ Easy to forget updates when schema changes
- ❌ Brittleness: adding new models required code changes in multiple places

### After (Dynamic Schema)
- ✅ **No manual updates needed** - admin UI reads live from Prisma schema
- ✅ **Single source of truth** - Prisma schema is the authoritative definition
- ✅ **Automatic consistency** - all admin features always match database
- ✅ **Scalable** - new tables automatically appear in admin UI
- ✅ **Maintainable** - schema changes in one place (prisma.schema.prisma)

---

## How It Works

### 1. Schema Introspection Utility

**File:** `src/lib/schema-introspection.ts`

Uses Prisma's built-in **DMMF (Data Model MetaFormat)** to read the actual schema at runtime:

```typescript
// Get schema for specific table
const schema = getTableSchema('Control');
// Returns: { name: 'Control', columns: [...] }

// Get all table names
const tables = getAllTableNames();
// Returns: ['User', 'ProcessArea', 'Control', ...]

// Convert to admin format
const adminSchema = convertToAdminFormat(schema);
```

### 2. Replaced Hardcoded Schemas

#### `/api/admin/table/[table]/columns/route.ts` (Column Management)
**Before:**
```typescript
const TABLE_SCHEMAS = {
  Control: {
    id: { type: 'String', required: true, isId: true },
    name: { type: 'String', required: true, isId: false },
    // ... 26 more hardcoded fields
  }
};
const schema = TABLE_SCHEMAS[table];
```

**After:**
```typescript
import { getTableSchema, convertToAdminFormat } from "@/lib/schema-introspection";

const tableSchema = getTableSchema(table);
const schema = convertToAdminFormat(tableSchema);
```

#### `/api/admin/table/[table]/data/route.ts` (Table Viewer)
**Before:**
```typescript
const TABLE_SCHEMAS = { /* 80+ lines of hardcoded schemas */ };
const columns = TABLE_SCHEMAS[table];
```

**After:**
```typescript
const tableSchema = getTableSchema(table);
const columns = tableSchema.columns
  .filter((col) => col.kind !== 'object')
  .map((col) => ({ name: col.name, type: col.type }));
```

#### `/api/admin/table/[table]/export/route.ts` (CSV Export)
**Before:**
```typescript
case 'Control':
  columns = [
    'id', 'sourceFile', 'controlRef', 'practiceDocument', 'name', 'statement',
    // ... and 22 more hardcoded column names
  ];
  break;
```

**After:**
```typescript
const tableSchema = getTableSchema(table);
const columns = tableSchema.columns
  .filter((col) => col.kind !== 'object')
  .map((col) => col.name);

const model = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
data = await model.findMany();
```

#### `/api/admin/tables/route.ts` (Available Tables)
**Before:**
```typescript
const AVAILABLE_TABLES = ['User', 'ProcessArea', 'Control', /* ... */];
return NextResponse.json({ tables: AVAILABLE_TABLES });
```

**After:**
```typescript
import { getAllTableNames } from "@/lib/schema-introspection";

const tables = getAllTableNames();
return NextResponse.json({ tables });
```

---

## Benefits

### 1. **Zero Maintenance**
- Add a field to `prisma.schema.prisma` → automatically available in admin UI
- Add a new model → automatically appears in table list
- No code changes needed

### 2. **Consistency**
- Admin UI always reflects actual database schema
- Impossible to have mismatches
- All forms, tables, exports align with database

### 3. **Scalability**
- Works with any number of tables
- Works with any number of fields
- Adding new tables doesn't require code changes

### 4. **Maintainability**
- Easier to understand (dynamic not hardcoded)
- Fewer places to update
- Reduced cognitive load

### 5. **Future-Proof**
- When you add new fields to Control table, they automatically appear
- No risk of "I forgot to update the admin UI"
- Schema-driven architecture

---

## Example: Adding a New Control Field

### Old Approach (3 files to update)
```
1. Edit prisma.schema.prisma → add field
2. Edit src/app/api/admin/table/[table]/columns/route.ts → update TABLE_SCHEMAS
3. Edit src/app/api/admin/table/[table]/data/route.ts → update TABLE_SCHEMAS
4. Edit src/app/api/admin/table/[table]/export/route.ts → add to columns array
5. Test admin UI
```

### New Approach (1 file to update)
```
1. Edit prisma.schema.prisma → add field
2. Run schema changes
3. Test admin UI (no code changes needed!)
```

---

## Technical Details

### Prisma DMMF Structure

Prisma exposes the schema via `prisma._dmmf`:

```typescript
{
  datamodel: {
    models: [
      {
        name: 'Control',
        fields: [
          {
            name: 'id',
            type: 'String',
            kind: 'scalar',
            isId: true,
            isRequired: true,
            isList: false
          },
          {
            name: 'processArea',
            type: 'ProcessArea',
            kind: 'object',
            isRequired: true,
            isList: false
          },
          // ... all fields
        ]
      }
    ]
  }
}
```

### Field Kind Types

- **scalar** - Primitive types (String, Int, Boolean, DateTime, etc.)
- **object** - Relations to other models (skipped in admin UI)
- **enum** - Enum types

---

## Migration Path

### No Database Migration Needed
The Prisma schema is the source of truth. Schema introspection reads it at runtime.

### Seamless Transition
Existing data is preserved. Only the admin UI mechanism changes (reads from schema instead of hardcoded lists).

---

## API Endpoints

All endpoints now read schema dynamically:

### GET /api/admin/tables
Returns all available table names from Prisma schema

### GET /api/admin/table/[table]/columns
Returns all columns for table from Prisma schema

### GET /api/admin/table/[table]/data
Returns table data with schema-derived column list

### GET /api/admin/table/[table]/export
Exports CSV with schema-derived column list

---

## Testing

After deployment, verify:

1. ✅ Column Management UI shows all 28 Control columns
2. ✅ Table Viewer displays all columns
3. ✅ CSV export includes all columns
4. ✅ Table list is complete and accurate
5. ✅ Add/edit forms work for all fields

---

## Future Improvements

### Possible Next Steps
1. **Dynamic Field-Level Validation** - Use schema to validate field types on import
2. **Auto-generated Forms** - Generate field forms based on field type
3. **Schema Drift Detection** - Warn if database and schema diverge
4. **Field Metadata** - Read descriptions and constraints from schema comments

### Beyond Admin
This pattern can be applied to:
- API route validation
- GraphQL schema generation
- Type-safe data access layer
- Database migration scripts

---

## Files Changed

### New Files
- `src/lib/schema-introspection.ts` - Core schema introspection logic

### Updated Files
- `src/app/api/admin/table/[table]/columns/route.ts` - Uses dynamic schema
- `src/app/api/admin/table/[table]/data/route.ts` - Uses dynamic schema
- `src/app/api/admin/table/[table]/export/route.ts` - Uses dynamic schema
- `src/app/api/admin/tables/route.ts` - Uses dynamic schema

### Removed
- 80+ lines of hardcoded TABLE_SCHEMAS
- Hardcoded AVAILABLE_TABLES
- Multiple switch statements with column lists

---

## Summary

✨ **Schema-driven admin architecture** that eliminates manual schema synchronization and provides a scalable foundation for future enhancements.

**Key Principle:** *Prisma schema is the single source of truth.*

---

**Implemented:** 2026-06-23  
**Architecture Pattern:** Dynamic Schema Introspection  
**Compatibility:** Backward compatible - no data changes  
**Status:** ✅ Ready to use
