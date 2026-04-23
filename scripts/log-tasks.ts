import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function logTask(
  description: string, 
  status: string, 
  timeEquiv: string, 
  inputTokens: number, 
  outputTokens: number
) {
  try {
    const projectName = 'seo-app';

    // Strip quotes from DATABASE_URL if they exist BEFORE importing db
    if (process.env.DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/^"|"$/g, '');
    }

    // Dynamic import to ensure process.env.DATABASE_URL is ready
    const { query } = await import('../src/lib/db.js');
    
    await query(`
      INSERT INTO agent_tasks 
      (project_name, task_description, status, programmer_time_equiv, input_tokens, output_tokens) 
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [projectName, description, status, timeEquiv, inputTokens, outputTokens]);

    console.log(`Successfully logged task: ${description}`);
  } catch (error) {
    console.error('Error logging task:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Get arguments from command line
const [,, description, status, timeEquiv, inputTokens, outputTokens] = process.argv;

if (description && status) {
  logTask(
    description, 
    status, 
    timeEquiv || '10 minutes', 
    parseInt(inputTokens) || 0, 
    parseInt(outputTokens) || 0
  );
} else {
  console.log('Usage: npx tsx scripts/log-tasks.ts <description> <status> [timeEquiv] [inputTokens] [outputTokens]');
  process.exit(1);
}
