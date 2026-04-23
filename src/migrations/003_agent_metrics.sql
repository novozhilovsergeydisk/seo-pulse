-- Migration for tracking AI agent tasks and performance metrics
CREATE TABLE IF NOT EXISTS agent_tasks (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress',
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    programmer_time_equiv INTERVAL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by project
CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_name);
