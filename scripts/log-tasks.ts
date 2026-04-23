import { query } from '../src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

async function logTasks() {
  try {
    console.log('Logging initial tasks...');
    
    // Task 1: Logout fix
    await query(`
      INSERT INTO agent_tasks 
      (project_name, task_description, status, duration_seconds, programmer_time_equiv, input_tokens, output_tokens) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['seo-app', 'Исправление Logout: перенаправление на главную вместо /login?error=MissingCSRF', 'completed', 300, '15 minutes', 1500, 500]);

    // Task 2: Metrics setup
    await query(`
      INSERT INTO agent_tasks 
      (project_name, task_description, status, duration_seconds, programmer_time_equiv, input_tokens, output_tokens) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, ['seo-app', 'Настройка системы метрик: создание таблицы agent_tasks и правил в GEMINI.md', 'completed', 600, '30 minutes', 2500, 800]);

    console.log('Successfully logged initial tasks.');
  } catch (error) {
    console.error('Error logging tasks:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

logTasks();
