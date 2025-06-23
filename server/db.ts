import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema";

// Force override DATABASE_URL to use external PostgreSQL
process.env.DATABASE_URL = 'postgresql://rtownsend:rTowns402@50.193.77.237:5432/high_bred?sslmode=disable';

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

export const db = drizzle(pool, { schema });
