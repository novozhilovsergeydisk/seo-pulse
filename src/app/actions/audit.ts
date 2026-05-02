"use server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import * as cheerio from "cheerio";

export async function performAuditInternal(projectId: string, url: string) {
  let statusCode = 0;
  let title = "";
  let description = "";
  let h1Count = 0;
  let loadTimeMs = 0;
  let ogTitle = "";
  let ogImage = "";

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAppBot/1.0)',
      },
      signal: AbortSignal.timeout(15000) 
    });
    
    loadTimeMs = Date.now() - startTime;
    statusCode = response.status;
    const html = await response.text();
    const $ = cheerio.load(html);

    title = $('title').text().trim() || "";
    description = $('meta[name="description"]').attr('content')?.trim() || "";
    h1Count = $('h1').length;
    
    ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || "";
    ogImage = $('meta[property="og:image"]').attr('content')?.trim() || "";
    
  } catch (error) {
    console.error("Audit error:", error);
    statusCode = 500;
  }

  // Generate Recommendations
  const recs = [];
  if (statusCode !== 200) recs.push(`⚠️ Страница вернула код ${statusCode}. Проверьте доступность.`);
  if (!title) recs.push("❌ Отсутствует тег <title>. Это критично для SEO.");
  else if (title.length < 30) recs.push("⚠️ Заголовок слишком короткий (< 30 симв.). Добавьте ключевые слова.");
  
  if (!description) recs.push("❌ Отсутствует Meta Description. Сниппет в поиске может быть некрасивым.");
  if (h1Count === 0) recs.push("❌ Нет заголовка H1. Поисковики не понимают главную тему страницы.");
  if (h1Count > 1) recs.push(`⚠️ Найдено ${h1Count} заголовков H1. Рекомендуется использовать только один.`);
  
  if (loadTimeMs > 2000) recs.push(`🐢 Медленная загрузка (${loadTimeMs}мс). Оптимизируйте изображения и скрипты.`);
  if (!ogTitle || !ogImage) recs.push("📢 Отсутствует разметка OpenGraph. Ссылка будет плохо выглядеть в соцсетях.");

  const recommendations = recs.length > 0 ? recs.join("\n") : "✅ Технических проблем не обнаружено. Страница оптимизирована.";

  await query(
    'INSERT INTO audits (project_id, url, status_code, title, description, h1_count, load_time_ms, og_title, og_image, recommendations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [projectId, url, statusCode, title.substring(0, 2048), description, h1Count, loadTimeMs, ogTitle, ogImage, recommendations]
  );
}

export async function runAudit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const url = formData.get("url") as string;

  if (!projectId || !url) throw new Error("Missing required fields");

  // verify project belongs to user and get domain
  const projRes = await query('SELECT id, domain FROM projects WHERE id = $1 AND user_id = $2', [projectId, session.user.id]);
  if (projRes.rows.length === 0) throw new Error("Unauthorized");
  
  const projectDomain = projRes.rows[0].domain;

  // Simple SSRF protection
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== projectDomain && !parsedUrl.hostname.endsWith('.' + projectDomain)) {
       throw new Error(`URL must belong to the project domain: ${projectDomain}`);
    }
  } catch (e: any) {
    throw new Error(e.message || "Invalid URL");
  }

  await performAuditInternal(projectId, url);

  revalidatePath(`/dashboard/projects/${projectId}`);
}
