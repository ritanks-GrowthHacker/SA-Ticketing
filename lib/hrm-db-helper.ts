import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as hrSchema from '../db/hrm-schema'

const hrmPool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_POSTGRES_URL_HRM,
});

export const hrDb = drizzle(hrmPool, { schema: hrSchema });

// Export schema for easy access
export * from '../db/hrm-schema';
export { eq, and, or, sql, inArray, notInArray, like, desc, asc, count, gt, lt, gte, lte, isNull, ne, ilike } from 'drizzle-orm';
