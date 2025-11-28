import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as salesSchema from '@/db/sales-schema';

// PostgreSQL connection for Sales database
const salesPool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_POSTGRESQL_URL_SALES,
});

export const salesDb = drizzle(salesPool, { schema: salesSchema });

// Export all sales tables
export * from '@/db/sales-schema';
export { eq, and, or, sql, inArray, notInArray, like, desc, asc, count, gt, lt, gte, lte, isNull, ne, ilike } from 'drizzle-orm';
