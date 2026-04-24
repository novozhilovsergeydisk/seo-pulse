import { Telegraf, Markup } from 'telegraf';
import * as pty from 'node-pty';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });
if (!process.env.TELEGRAM_BOT_TOKEN) {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const allowedChatId = parseInt(process.env.TELEGRAM_CHAT_ID);

const SYSTEM_INSTRUCTION = `
Ты - опытный разработчик в режиме YOLO. Тебе РАЗРЕШЕНО изменять любые файлы проекта.
1. Сразу приступай к выполнению задачи.
2. Используй инструменты напрямую (replace, run_shell_command).
3. Не вызывай субагентов.
4. В конце обязательно напиши "✅ ЗАДАЧА ВЫПОЛНЕНА".
`;

console.log(`Starting Interactive Telegram Bot: ${process.env.TELEGRAM_BOT_NAME}`);

bot.command('ps', async (ctx) => {
  try {
    const { query } = await import('../src/lib/db.js');
    const dbTasks = await query("SELECT id, task_description, start_time FROM agent_tasks WHERE status = 'in_progress' AND project_name = 'seo-app' ORDER BY start_time DESC");
    
    let report = "📋 <b>Статус системы</b>\n\n";
    
    // 1. Активная задача в боте
    report += "<b>Текущая сессия:</b>\n";
    if (currentTaskId) {
      report += `🔹 Задача #${currentTaskId} (в работе)\n\n`;
    } else {
      report += "🔸 Нет активной задачи в данной сессии\n\n";
    }

    // 2. Задачи из БД
    report += "<b>Задачи 'in_progress' в БД:</b>\n";
    if (dbTasks.rows.length > 0) {
      dbTasks.rows.forEach(t => {
        const time = new Date(t.start_time).toLocaleTimeString();
        report += `• [#${t.id}] ${t.task_description} (${time})\n`;
      });
    } else {
      report += "• Активных задач в БД нет\n";
    }
    report += "\n";

    // 3. Процессы в системе
    exec('ps aux | grep -E "gemini|commander" | grep -v grep', (err, stdout) => {
      report += "<b>Процессы в системе:</b>\n";
      if (stdout) {
        const lines = stdout.trim().split('\n');
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[1];
          const cpu = parts[2];
          const mem = parts[3];
          const cmd = line.toLowerCase();
          
          if (cmd.includes('commander')) {
            report += `• 🎖 <b>[ГЕНЕРАЛ]</b> <code>PID: ${pid}</code>\n`;
          } else {
            report += `• ⚙️ <code>PID: ${pid}</code> (CPU: ${cpu}%, MEM: ${mem}%)\n`;
          }
        });
      } else {
        report += "• Процессы не найдены\n";
      }
      
      ctx.reply(report, { parse_mode: 'HTML' });
    });
  } catch (error) {
    ctx.reply(`❌ Ошибка при получении статуса: ${error.message}`);
  }
});

bot.command('start', async (ctx) => {
  const welcomeText = `
👋 Привет! Я Gemini CLI Bot.

Я помогаю управлять проектом прямо из Telegram.
Доступные команды:
/task <описание> - Запустить новую задачу
/ps - Статус задач и процессов
/done <id> - Закрыть задачу (или текущую)
/clear - Очистить зависшие задачи в БД
/deploy - Полный деплой проекта
/stop - Остановить текущий процесс
/extend - Продлить сессию на 30 мин
/help - Показать это сообщение

Просто напиши мне любой запрос, и я передам его Gemini!
  `;
  await ctx.reply(welcomeText);
});

bot.command('help', async (ctx) => {
  const helpText = `
📖 Справка по командам:
/task - Запуск конкретной задачи
/ps - Показывает активную задачу, список из БД и процессы
/done <id> - Закрывает задачу. Если ID не указан, закрывает текущую активную.
/clear - Переводит ВСЕ задачи со статусом 'in_progress' в 'failed'
/deploy - Синхронизация Git -> Сборка -> Перезапуск
/stop - Остановить текущий процесс Gemini
/extend - Сбросить тайм-аут бездействия
/help - Показать справку
  `;
  await ctx.reply(helpText);
});

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== allowedChatId) return ctx.reply("❌ Доступ запрещен.");
  return next();
});

let activeProcess = null;
let taskTimeout = null;
let currentStatusMsgId = null;
let currentTaskId = null;
let waitingForDescription = false;

const resetTimeout = (ctx, minutes = 60) => {
  if (taskTimeout) clearTimeout(taskTimeout);
  if (activeProcess) {
    taskTimeout = setTimeout(() => {
      if (activeProcess) {
        activeProcess.kill();
        activeProcess = null;
        ctx.reply(`⏰ Тайм-аут (${minutes}м). Сессия завершена для экономии ресурсов.`);
      }
    }, minutes * 60000);
  }
};

const startGemini = async (ctx, prompt) => {
  const statusMsg = await ctx.reply('🚀 Запуск Gemini...');
  currentStatusMsgId = statusMsg.message_id;
  let fullLog = '';
  let lastSentLog = '';

  const fullPrompt = `${SYSTEM_INSTRUCTION}\n\nЗАДАНИЕ: ${prompt}`;

  const ptyProcess = pty.spawn('gemini', ['-i', fullPrompt, '--skip-trust', '--approval-mode', 'yolo'], {
    name: 'xterm-256color',
    cols: 100,
    rows: 50,
    cwd: projectRoot,
    env: { 
      ...process.env, 
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      HOME: '/root', 
      USER: 'root',
      AGENT_TASK_ID: currentTaskId || '' 
    }
  });

  activeProcess = ptyProcess;
  resetTimeout(ctx, 60);

  let frame = 0;
  const frames = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];

  const updateUI = async (content, isFinal = false) => {
    // Remove ANSI escape codes more robustly
    const clean = content
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-ntqry=><]/g, '')
      .trim();

    if (!clean && !isFinal) return;
    if (clean === lastSentLog && !isFinal && frame % 5 !== 0) return; // Update every few ticks if no new log
    lastSentLog = clean;

    const lines = clean.split('\n');
    // Filter out common noise like "True color support not detected"
    const filteredLines = lines.filter(line => !line.includes('True color (24-bit) support not detected'));
    
    const tail = filteredLines.slice(-25).join('\n');
    const clock = frames[frame % frames.length];
    const header = isFinal ? '✅ <b>Завершено:</b>\n' : `${clock} <b>Выполнение...</b>\n`;
    frame++;
    
    const lastLine = lines[lines.length - 1]?.toLowerCase() || '';
    const isPrompt = lastLine.includes('?') || 
                     lastLine.includes('(y/n)') || 
                     lastLine.includes('execute') || 
                     lastLine.includes('согласны') || 
                     lastLine.includes('одобрения');

    const keyboard = isPrompt ? Markup.inlineKeyboard([
      Markup.button.callback('✅ Да', 'approve'),
      Markup.button.callback('❌ Нет', 'decline')
    ]) : null;

    await ctx.telegram.editMessageText(ctx.chat.id, currentStatusMsgId, null, `${header}<code>${tail}</code>`, { 
      parse_mode: 'HTML',
      ...(keyboard || {})
    }).catch(() => {});
  };

  const throttle = setInterval(() => updateUI(fullLog), 2000);

  ptyProcess.onData((data) => {
    fullLog += data;
    console.log(data);
    if (data.includes('?') || data.includes('[y/n]')) {
      updateUI(fullLog);
    }
  });

  ptyProcess.onExit(async ({ exitCode }) => {
    clearInterval(throttle);
    activeProcess = null;
    if (taskTimeout) clearTimeout(taskTimeout);
    await updateUI(fullLog, true);
    if (exitCode !== 0 && exitCode !== null) {
      await ctx.reply(`⚠️ Код выхода: ${exitCode}`);
    }
  });
};

bot.command('deploy', async (ctx) => {
  const description = 'Full deployment: git push, build and restart';
  exec(`npx tsx scripts/log-tasks.ts start "${description}"`, (error, stdout) => {
    const match = stdout.match(/TASK_ID:(\d+)/);
    if (match) currentTaskId = match[1];
    startGemini(ctx, 'Perform a full deployment: 1. Check git status, commit and push any changes if needed. 2. Run production build. 3. Restart necessary services.');
  });
});

bot.command('task', async (ctx) => {
  const description = ctx.message.text.split(' ').slice(1).join(' ');
  if (!description) {
    waitingForDescription = true;
    return ctx.reply('📝 Какую задачу начинаем? Опишите её:');
  }

  exec(`npx tsx scripts/log-tasks.ts start "${description}"`, (error, stdout) => {
    const match = stdout.match(/TASK_ID:(\d+)/);
    if (match) currentTaskId = match[1];
    startGemini(ctx, description);
  });
});

bot.command('done', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const targetId = args[1];

  if (activeProcess && !targetId) {
    activeProcess.write('Заверши задачу и зафиксируй результат в БД.\r');
    return ctx.reply('⏳ Отправил запрос на завершение активному Gemini. Ждем...');
  }
  
  const idToClose = targetId || currentTaskId;

  if (idToClose) {
    exec(`npx tsx scripts/log-tasks.ts end ${idToClose} completed "15 minutes"`, (error) => {
      if (error) return ctx.reply(`❌ Ошибка при закрытии #${idToClose}`);
      ctx.reply(`✅ Задача #${idToClose} закрыта.`);
      if (idToClose === currentTaskId) currentTaskId = null;
    });
  } else {
    ctx.reply('❌ Укажите ID задачи: /done <id> или используйте внутри активной сессии.');
  }
});

bot.command('clear', async (ctx) => {
  try {
    const { query } = await import('../src/lib/db.js');
    const res = await query("UPDATE agent_tasks SET status = 'failed', end_time = CURRENT_TIMESTAMP WHERE status = 'in_progress' AND project_name = 'seo-app'");
    ctx.reply(`🧹 Порядок наведен! Закрыто задач: ${res.rowCount}`);
    currentTaskId = null;
  } catch (error) {
    ctx.reply(`❌ Ошибка при очистке: ${error.message}`);
  }
});

bot.command('extend', async (ctx) => {
  if (activeProcess) {
    resetTimeout(ctx, 60);
    return ctx.reply('⏳ Работа продлена еще на 60 минут.');
  }
  ctx.reply('❌ Нет активных задач.');
});

bot.command('stop', async (ctx) => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    if (taskTimeout) clearTimeout(taskTimeout);
    
    if (currentTaskId) {
      const idToClose = currentTaskId;
      exec(`npx tsx scripts/log-tasks.ts end ${idToClose} failed "1 minute"`, (error) => {
        ctx.reply(`🛑 Остановлено. Задача #${idToClose} помечена как невыполненная.`);
        currentTaskId = null;
      });
    } else {
      ctx.reply('🛑 Остановлено.');
    }
    return;
  }
  ctx.reply('❌ Нет активных задач.');
});

bot.action('approve', async (ctx) => {
  if (activeProcess) {
    activeProcess.write('y\r');
    resetTimeout(ctx, 30);
    await ctx.answerCbQuery('✅ Yes');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
  }
});

bot.action('decline', async (ctx) => {
  if (activeProcess) {
    activeProcess.write('n\r');
    resetTimeout(ctx, 30);
    await ctx.answerCbQuery('❌ No');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
  }
});

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  
  if (waitingForDescription) {
    waitingForDescription = false;
    const description = ctx.message.text;
    exec(`npx tsx scripts/log-tasks.ts start "${description}"`, (error, stdout) => {
      const match = stdout.match(/TASK_ID:(\d+)/);
      if (match) currentTaskId = match[1];
      startGemini(ctx, description);
    });
    return;
  }

  if (activeProcess) {
    activeProcess.write(ctx.message.text + '\r');
    resetTimeout(ctx, 30);
    await ctx.react('✍️').catch(() => {}); 
    return;
  }

  startGemini(ctx, ctx.message.text);
});

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
