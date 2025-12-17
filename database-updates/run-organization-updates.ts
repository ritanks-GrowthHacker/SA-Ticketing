// DEPRECATED: This migration script used Supabase and is no longer functional
// The database has been migrated to PostgreSQL
// Use Drizzle migrations or direct SQL scripts instead

import fs from 'fs';
import path from 'path';

console.warn('⚠️ This script is deprecated. Database has been migrated to PostgreSQL.');
console.warn('⚠️ Please use Drizzle migrations or run SQL scripts directly against PostgreSQL.');
console.warn('⚠️ See drizzle.config.ts and use: npx drizzle-kit push');

/*
// Example of how to run migrations with Drizzle:
// 1. Update your schema in db/schema.ts
// 2. Run: npx drizzle-kit generate
// 3. Run: npx drizzle-kit push

// Or run SQL directly:
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function runMigrations() {
  const sqlFile = fs.readFileSync(path.join(__dirname, 'your-migration.sql'), 'utf8');
  await db.execute(sql.raw(sqlFile));
}
*/