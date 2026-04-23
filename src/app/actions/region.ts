"use server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addRegion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const searchEngine = formData.get("searchEngine") as string;

  if (!projectId || !name || !searchEngine) throw new Error("Missing required fields");

  // verify project belongs to user
  const projRes = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, session.user.id]);
  if (projRes.rows.length === 0) throw new Error("Unauthorized");

  await query('INSERT INTO regions (project_id, name, search_engine) VALUES ($1, $2, $3)', [projectId, name, searchEngine]);

  revalidatePath(`/dashboard/projects/${projectId}`);
}
