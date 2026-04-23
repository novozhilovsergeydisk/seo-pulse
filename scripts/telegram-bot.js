import { Telegraf } from 'telegraf';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });
if (!process.env.TELEGRAM_BOT_TOKEN) {
  dotenv.config();
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const allowedChatId = parseInt(process.env.TELEGRAM_CHAT_ID);

console.log(`Starting Telegram Bot: ${process.env.TELEGRAM_BOT_NAME}`);
console.log(`Allowed Chat ID: ${allowedChatId}`);

// Security Middleware: Only allow messages from the owner
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== allowedChatId) {
    console.log(`Unauthorized access attempt from ${ctx.from?.id}`);
    return ctx.reply("❌ Доступ запрещен. Я работаю только с владельцем проекта.");
  }
  return next();
});

bot.start((ctx) => ctx.reply('🤖 Привет! Я твой ИИ-ассистент Gemini CLI. Присылай мне задачи, и я выполню их в контексте этого проекта.'));

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  
  if (userMessage.startsWith('/')) return; // Ignore other commands

  const loadingMsg = await ctx.reply('⏳ Выполняю запрос...');

  // Build the command: execute gemini in the project root
  // We use quotes to prevent shell injection (simple version)
  const escapedMessage = userMessage.replace(/"/g, '\\"');
  const command = `gemini "${escapedMessage}"`;

  console.log(`Executing: ${command}`);

  exec(command, { cwd: projectRoot }, async (error, stdout, stderr) => {
    let result = '';
    
    if (error) {
      result = `❌ Ошибка выполнения:\n\n${stderr || error.message}`;
    } else {
      result = stdout || '✅ Задача выполнена (без вывода в консоль).';
    }

    // Split message if too long (Telegram limit 4096 chars)
    const MAX_LENGTH = 4000;
    if (result.length > MAX_LENGTH) {
      const chunks = result.match(new RegExp(`.{1,${MAX_LENGTH}}`, 'gs')) || [];
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    } else {
      await ctx.editMessageText(result).catch(() => ctx.reply(result));
    }
  });
});

bot.launch().then(() => {
  console.log('🚀 Telegram Bot is running and waiting for your commands!');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
