-- Миграция для отслеживания сессий процессов Gemini
CREATE TABLE IF NOT EXISTS agent_sessions (
    id SERIAL PRIMARY KEY,
    pid INTEGER NOT NULL,
    task_id INTEGER REFERENCES agent_tasks(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'killed', 'finished'
    last_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_pid ON agent_sessions(pid);
