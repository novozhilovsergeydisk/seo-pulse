"use server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import * as cheerio from "cheerio";

export async function runAudit(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const url = formData.get("url") as string;

  if (!projectId || !url) throw new Error("Missing required fields");

  // verify project belongs to user
  const projRes = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, session.user.id]);
  if (projRes.rows.length === 0) throw new Error("Unauthorized");

  let statusCode = 0;
  let title = "";
  let description = "";
  let h1Count = 0;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAppBot/1.0)',
      },
      // Avoid infinite hang on some servers
      signal: AbortSignal.timeout(10000) 
    });
    
    statusCode = response.status;
    const html = await response.text();
    const $ = cheerio.load(html);

    title = $('title').text().trim() || "";
    description = $('meta[name="description"]').attr('content')?.trim() || "";
    h1Count = $('h1').length;
    
  } catch (error) {
    console.error("Audit error:", error);
    statusCode = 500; // Mock internal error if fetch fails (e.g. invalid URL, timeout)
  }

  await query(
    'INSERT INTO audits (project_id, url, status_code, title, description, h1_count) VALUES ($1, $2, $3, $4, $5, $6)',
    [projectId, url, statusCode, title.substring(0, 2048), description, h1Count]
  );

  revalidatePath(`/dashboard/projects/${projectId}`);
}
