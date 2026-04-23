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
ВАЖНОЕ ПРАВИЛО: 
1. Не забывай про рекомендации и принципы SOLID. 
2. Действуй максимально аккуратно, система в промышленной эксплуатации. 
3. ПРЕЖДЕ ЧЕМ ПРИСТУПАТЬ, ПОКАЖИ ПЛАН ДЕЙСТВИЙ. 
4. Если что-то не понятно - спрашивай. 
5. Как закончишь, НЕ ДЕЛАЙ ДЕПЛОЙ, сначала нужно протестировать изменения локально.
`;

console.log(`Starting Interactive Telegram Bot: ${process.env.TELEGRAM_BOT_NAME}`);

bot.use(async (ctx, next) => {
  if (ctx.from?.id !== allowedChatId) return ctx.reply("❌ Доступ запрещен.");
  return next();
});

let activeProcess = null;
let taskTimeout = null;
let currentStatusMsgId = null;
let currentTaskId = null;
let waitingForDescription = false;

const resetTimeout = (ctx, minutes = 30) => {
  if (taskTimeout) clearTimeout(taskTimeout);
  if (activeProcess) {
    taskTimeout = setTimeout(() => {
      if (activeProcess) {
        activeProcess.kill();
        activeProcess = null;
        ctx.reply(`⏰ Тайм-аут (${minutes}м). Сессия завершена.`);
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
  
  const ptyProcess = pty.spawn('gemini', ['-p', fullPrompt], {
    name: 'xterm-256color',
    cols: 80,
    rows: 40,
    cwd: projectRoot,
    env: { 
      ...process.env, 
      TERM: 'xterm-256color', 
      HOME: '/root', 
      USER: 'root',
      AGENT_TASK_ID: currentTaskId || '' 
    }
  });

  activeProcess = ptyProcess;
  resetTimeout(ctx, 30);

  const updateUI = async (content, isFinal = false) => {
    const clean = content
      .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-ntqry=><]/g, '')
      .replace(/[^\x20-\x7E\x0A\x0D\u0400-\u04FF]/g, '')
      .trim();

    if (!clean || (clean === lastSentLog && !isFinal)) return;
    lastSentLog = clean;

    const lines = clean.split('\n');
    const tail = lines.slice(-20).join('\n');
    const header = isFinal ? '✅ Завершено:\n' : '⏳ Выполнение...\n';
    
    const lastLine = lines[lines.length - 1] || '';
    const isPrompt = lastLine.includes('?') && (lastLine.includes('(y/N)') || lastLine.includes('[y/n]') || lastLine.includes('Execute'));

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
  if (activeProcess) {
    activeProcess.write('Заверши задачу и зафиксируй результат в БД.\r');
    return ctx.reply('⏳ Отправил запрос на завершение. Ждем фиксации...');
  }
  
  if (currentTaskId) {
    exec(`npx tsx scripts/log-tasks.ts end ${currentTaskId} completed "15 minutes"`, (error) => {
      ctx.reply(`✅ Задача #${currentTaskId} закрыта вручную.`);
      currentTaskId = null;
    });
  } else {
    ctx.reply('❌ Нет активной задачи.');
  }
});

bot.command('extend', async (ctx) => {
  if (activeProcess) {
    resetTimeout(ctx, 30);
    return ctx.reply('⏳ Работа продлена еще на 30 минут.');
  }
  ctx.reply('❌ Нет активных задач.');
});

bot.command('stop', async (ctx) => {
  if (activeProcess) {
    activeProcess.kill();
    activeProcess = null;
    if (taskTimeout) clearTimeout(taskTimeout);
    return ctx.reply('🛑 Остановлено.');
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
