import { prisma } from './prisma';

interface ColumnSchema {
  name: string;
  type: string;
  required: boolean;
  isId: boolean;
  isList: boolean;
  kind: 'scalar' | 'object' | 'enum';
}

interface TableSchema {
  name: string;
  columns: ColumnSchema[];
}

/**
 * Get the actual database schema dynamically from Prisma DMMF
 */
export function getTableSchema(tableName: string): TableSchema | null {
  try {
    const dmmf = (prisma as any)._dmmf;

    if (!dmmf || !dmmf.datamodel || !dmmf.datamodel.models) {
      console.error('DMMF not available for table:', tableName);
      return null;
    }

    const model = dmmf.datamodel.models.find((m: any) => m.name === tableName);

    if (!model) {
      console.warn('Model not found in DMMF:', tableName);
      return null;
    }

    const columns: ColumnSchema[] = model.fields.map((field: any) => {
      const typeMap: Record<string, string> = {
        String: 'String',
        Int: 'Int',
        Float: 'Float',
        Boolean: 'Boolean',
        DateTime: 'DateTime',
        Decimal: 'Decimal',
        BigInt: 'BigInt',
        Bytes: 'Bytes',
        JSON: 'JSON',
      };

      const displayType = typeMap[field.type] || field.type;
      const isRelation = field.kind === 'object';
      const isEnum = field.kind === 'enum';

      return {
        name: field.name,
        type: displayType,
        required: field.isRequired,
        isId: field.isId,
        isList: field.isList,
        kind: isRelation ? 'object' : isEnum ? 'enum' : 'scalar',
      };
    });

    return {
      name: tableName,
      columns,
    };
  } catch (error) {
    console.error('Error in getTableSchema:', tableName, error);
    return null;
  }
}

/**
 * Get all available table names - with fallback
 */
export function getAllTableNames(): string[] {
  const fallbackTables = [
    'User',
    'ProcessArea',
    'SubProcess',
    'Control',
    'Assessment',
    'ControlAssignment',
    'Sample',
    'AssuranceActivityType',
    'AchievementBadge',
    'PointTransaction',
    'UserAchievement',
    'EmotionalDriveMetric',
    'Milestone',
    'ActivityLog',
  ];

  try {
    const dmmf = (prisma as any)._dmmf;

    if (!dmmf?.datamodel?.models) {
      console.warn('DMMF not available, using fallback table list');
      return fallbackTables;
    }

    const tables = dmmf.datamodel.models
      .filter((m: any) => !m.name.startsWith('_'))
      .map((m: any) => m.name)
      .sort();

    if (tables.length === 0) {
      return fallbackTables;
    }

    return tables;
  } catch (error) {
    console.warn('Error reading schema, using fallback table list:', error);
    return fallbackTables;
  }
}

/**
 * Get schema for all tables
 */
export function getAllTableSchemas(): Record<string, TableSchema> {
  const tableNames = getAllTableNames();
  const schemas: Record<string, TableSchema> = {};

  for (const tableName of tableNames) {
    const schema = getTableSchema(tableName);
    if (schema) {
      schemas[tableName] = schema;
    }
  }

  return schemas;
}

/**
 * Convert schema to format needed by admin UI
 */
export function convertToAdminFormat(
  schema: TableSchema
): Record<string, { type: string; required: boolean; isId: boolean }> {
  const result: Record<string, { type: string; required: boolean; isId: boolean }> = {};

  for (const column of schema.columns) {
    if (column.kind === 'object') {
      continue;
    }

    result[column.name] = {
      type: column.type,
      required: column.required,
      isId: column.isId,
    };
  }

  return result;
}
