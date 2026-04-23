import { Pool } from 'pg';

// We ensure a single instance of the connection pool is used across the application
const globalForPg = global as unknown as { pgPool: Pool };

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
  connectionString = connectionString.replace(/^"|"$/g, '');
}

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: connectionString,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;

export const query = (text: string, params?: unknown[]) => {
  return pool.query(text, params);
};

export default pool;
