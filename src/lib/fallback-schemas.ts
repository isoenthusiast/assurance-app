import { promises as fs } from 'fs';
import path from 'path';

let schemaCache: Record<
  string,
  Record<string, { type: string; required: boolean; isId: boolean }>
> | null = null;

/**
 * Load fallback schemas from JSON file
 * Reads fresh from disk on each call to ensure updates are reflected
 */
async function loadFallbackSchemas() {
  try {
    const schemaPath = path.join(process.cwd(), 'src', 'lib', 'fallback-schemas.json');
    const content = await fs.readFile(schemaPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load fallback schemas from JSON:', error);
    return null;
  }
}

/**
 * Get fallback schema for a table (reads fresh from disk)
 */
export async function getFallbackSchema(
  tableName: string
): Promise<Record<string, { type: string; required: boolean; isId: boolean }> | null> {
  const schemas = await loadFallbackSchemas();
  return schemas?.[tableName] || null;
}
