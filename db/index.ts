import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// PostgreSQL connection for Ticketing System
const ticketSystemPool = new Pool({
  connectionString: process.env.NEXT_PUBLIC_POSTGRESQL_URL_TICKET_SYSTEM,
});

export const db = drizzle(ticketSystemPool, { schema });

