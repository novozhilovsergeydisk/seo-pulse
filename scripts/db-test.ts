import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
    dbUrl = dbUrl.replace(/^"|"$/g, '');
}

console.log('Raw DATABASE_URL length:', process.env.DATABASE_URL?.length);
console.log('Cleaned dbUrl length:', dbUrl?.length);

const pool = new Pool({
  connectionString: dbUrl,
});

async function test() {
  try {
    const res = await pool.query('SELECT current_user, current_database()');
    console.log('Success!', res.rows[0]);
  } catch (err) {
    console.error('Test failed:', err.message);
  } finally {
    process.exit(0);
  }
}

test();
