#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <time.h>
#include <sys/types.h>
#include <libpq-fe.h>

// Константы
#define TIMEOUT_MINUTES 2
#define CHECK_INTERVAL_SECONDS 60

void send_telegram_notification(const char* bot_token, const char* chat_id, const char* message) {
    char command[2048];
    snprintf(command, sizeof(command), 
        "curl -s -X POST https://api.telegram.org/bot%s/sendMessage "
        "-d chat_id=%s -d text=\"%s\" -d parse_mode=\"HTML\" > /dev/null",
        bot_token, chat_id, message);
    system(command);
}

void finish_task_in_db(PGconn *conn, int task_id) {
    if (task_id <= 0) return;
    char query[256];
    snprintf(query, sizeof(query), 
        "UPDATE agent_tasks SET status = 'failed', end_time = CURRENT_TIMESTAMP WHERE id = %d", 
        task_id);
    PGresult *res = PQexec(conn, query);
    PQclear(res);
}

int main() {
    const char *conninfo = getenv("DATABASE_URL");
    const char *bot_token = getenv("TELEGRAM_BOT_TOKEN");
    const char *chat_id = getenv("TELEGRAM_CHAT_ID");

    if (!conninfo || !bot_token || !chat_id) {
        fprintf(stderr, "Error: Environment variables DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID must be set\n");
        return 1;
    }

    printf("Gemini Watchdog started. Timeout: %d minutes. Check interval: %d seconds.\n", TIMEOUT_MINUTES, CHECK_INTERVAL_SECONDS);

    while (1) {
        PGconn *conn = PQconnectdb(conninfo);

        if (PQstatus(conn) != CONNECTION_OK) {
            fprintf(stderr, "Connection to database failed: %s\n", PQerrorMessage(conn));
            PQfinish(conn);
            sleep(CHECK_INTERVAL_SECONDS);
            continue;
        }

        // Поиск активных сессий, которые работают дольше TIMEOUT_MINUTES
        char query[512];
        snprintf(query, sizeof(query),
            "SELECT id, pid, task_id, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))/60 as duration "
            "FROM agent_sessions "
            "WHERE status = 'active' AND (CURRENT_TIMESTAMP - start_time) > interval '%d minutes'",
            TIMEOUT_MINUTES);

        PGresult *res = PQexec(conn, query);

        if (PQresultStatus(res) == PGRES_TUPLES_OK) {
            int rows = PQntuples(res);
            for (int i = 0; i < rows; i++) {
                int session_id = atoi(PQgetvalue(res, i, 0));
                int pid = atoi(PQgetvalue(res, i, 1));
                int task_id = atoi(PQgetvalue(res, i, 2));
                double duration = atof(PQgetvalue(res, i, 3));

                printf("Found hanging process: PID %d, Session ID %d, Duration %.1f min. Killing...\n", pid, session_id, duration);

                // 1. Убиваем процесс
                if (kill(pid, SIGKILL) == 0) {
                    printf("Process %d killed successfully.\n", pid);
                } else {
                    perror("kill");
                }

                // 2. Обновляем статус сессии
                char update_query[256];
                snprintf(update_query, sizeof(update_query), 
                    "UPDATE agent_sessions SET status = 'killed' WHERE id = %d", session_id);
                PGresult *upd_res = PQexec(conn, update_query);
                PQclear(upd_res);

                // 3. Закрываем задачу в agent_tasks
                finish_task_in_db(conn, task_id);

                // 4. Уведомляем в Telegram
                char msg[512];
                snprintf(msg, sizeof(msg), 
                    "🚨 <b>Watchdog Notice</b>\n\nПроцесс Gemini (PID: %d) был принудительно завершен.\n"
                    "⏱ Длительность: %.1f мин\n"
                    "🆔 Задача: #%d\n\nПричина: Превышен лимит времени выполнения (%d мин).", 
                    pid, duration, task_id, TIMEOUT_MINUTES);
                send_telegram_notification(bot_token, chat_id, msg);
            }
        }

        PQclear(res);
        PQfinish(conn);

        sleep(CHECK_INTERVAL_SECONDS);
    }

    return 0;
}
