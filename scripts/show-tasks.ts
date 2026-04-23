import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
}

async function showTasks() {
  try {
    const { query } = await import('../src/lib/db.js');
    const res = await query('SELECT id, project_name, task_description, status, start_time, duration_seconds FROM agent_tasks ORDER BY start_time DESC LIMIT 20');
    console.table(res.rows);
  } catch (error) {
    console.error('Error selecting tasks:', error);
  } finally {
    process.exit(0);
  }
}

showTasks();
