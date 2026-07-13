/**
 * Fallback column schemas — embedded directly (no JSON file dependency)
 * so they work in Railway standalone builds where src/ is not included.
 *
 * Update this file whenever a model adds/removes columns.
 */
const FALLBACK_SCHEMAS: Record<
  string,
  Record<string, { type: string; required: boolean; isId: boolean }>
> = {
  "ProcessArea": {
    "id":          { type: "String",   required: true,  isId: true },
    "name":        { type: "String",   required: true,  isId: false },
    "description": { type: "String",   required: false, isId: false },
    "createdAt":   { type: "DateTime", required: true,  isId: false },
    "pId":         { type: "String",   required: false, isId: false },
    "standard":    { type: "String",   required: false, isId: false },
    "StandardID":  { type: "String",   required: false, isId: false },
  },
  "Standard": {
    "id":                  { type: "String",   required: true,  isId: true },
    "standard":            { type: "String",   required: true,  isId: false },
    "standardDescription": { type: "String",   required: false, isId: false },
    "sequenceNo":          { type: "Int",      required: true,  isId: false },
    "createdAt":           { type: "DateTime", required: true,  isId: false },
  },
  "Requirement": {
    "rId":                 { type: "Int",      required: true,  isId: true },
    "standard":            { type: "String",   required: true,  isId: false },
    "pId":                 { type: "String",   required: true,  isId: false },
    "processAreaId":       { type: "String",   required: false, isId: false },
    "requirementId":       { type: "String",   required: true,  isId: false },
    "clauseContent":       { type: "String",   required: true,  isId: false },
    "intentOutcome":       { type: "String",   required: true,  isId: false },
    "clauseApplicability": { type: "String",   required: true,  isId: false },
    "references":          { type: "String",   required: false, isId: false },
    "applicable":          { type: "Boolean",  required: true,  isId: false },
    "createdAt":           { type: "DateTime", required: true,  isId: false },
  },
  "MapControl2Requirement": {
    "id":             { type: "String",   required: true,  isId: true },
    "controlId":      { type: "String",   required: true,  isId: false },
    "requirementRId": { type: "Int",      required: true,  isId: false },
    "processAreaId":  { type: "String",   required: false, isId: false },
    "createdAt":      { type: "DateTime", required: true,  isId: false },
  },
};

/**
 * Get fallback schema for a table (sync, no disk I/O)
 */
export async function getFallbackSchema(
  tableName: string
): Promise<Record<string, { type: string; required: boolean; isId: boolean }> | null> {
  return FALLBACK_SCHEMAS[tableName] || null;
}
