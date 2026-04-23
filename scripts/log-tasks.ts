import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function logTask() {
  const args = process.argv.slice(2);
  const mode = args[0]; // 'start' or 'end'

  try {
    const projectName = 'seo-app';

    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
    }

    const { query } = await import('../src/lib/db.js');
    
    if (mode === 'start') {
      const description = args[1];
      const res = await query(`
        INSERT INTO agent_tasks 
        (project_name, task_description, status) 
        VALUES ($1, $2, 'in_progress')
        RETURNING id
      `, [projectName, description]);
      console.log(`TASK_ID:${res.rows[0].id}`);
      console.log(`Started task: ${description}`);
    } else if (mode === 'end') {
      const id = args[1];
      const status = args[2] || 'completed';
      const timeEquiv = args[3] || '5 minutes';
      const inputTokens = parseInt(args[4]) || 0;
      const outputTokens = parseInt(args[5]) || 0;

      await query(`
        UPDATE agent_tasks 
        SET status = $2, 
            programmer_time_equiv = $3, 
            input_tokens = $4, 
            output_tokens = $5,
            end_time = CURRENT_TIMESTAMP,
            duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
        WHERE id = $1
      `, [id, status, timeEquiv, inputTokens, outputTokens]);
      console.log(`Completed task ID: ${id}`);
    } else {
      console.log('Usage:');
      console.log('  npx tsx scripts/log-tasks.ts start <description>');
      console.log('  npx tsx scripts/log-tasks.ts end <id> <status> [timeEquiv] [inputTokens] [outputTokens]');
    }
  } catch (error) {
    console.error('Error logging task:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

logTask();
