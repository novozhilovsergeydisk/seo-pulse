import dotenv from 'dotenv';
import { query } from '../src/lib/db.js';
import { performAuditInternal } from '../src/app/actions/audit.js';

dotenv.config({ path: '.env.local' });

async function scheduledAudit() {
  console.log('--- Starting Scheduled Audit Run ---');
  
  try {
    // Get all projects
    const projectsRes = await query('SELECT id, domain FROM projects');
    const projects = projectsRes.rows;

    for (const project of projects) {
      console.log(`Processing project: ${project.domain} (${project.id})`);
      
      try {
        const url = `https://${project.domain}`;
        console.log(`Triggering internal audit for ${url}...`);
        await performAuditInternal(project.id, url);
        console.log(`Successfully audited ${project.domain}`);
      } catch (err) {
        console.error(`Audit failed for ${project.domain}:`, err);
      }
    }
  } catch (error) {
    console.error('Scheduled audit error:', error);
  }
}

// Simple loop for now (e.g., every 6 hours)
const INTERVAL = 6 * 60 * 60 * 1000;

async function start() {
    while(true) {
        await scheduledAudit();
        await new Promise(resolve => setTimeout(resolve, INTERVAL));
    }
}

start();
