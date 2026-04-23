"use server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addKeyword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectId = formData.get("projectId") as string;
  const phrase = formData.get("phrase") as string;

  if (!projectId || !phrase) throw new Error("Missing required fields");

  // verify project belongs to user
  const projRes = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, session.user.id]);
  if (projRes.rows.length === 0) throw new Error("Unauthorized");

  await query('INSERT INTO keywords (project_id, phrase) VALUES ($1, $2)', [projectId, phrase]);

  revalidatePath(`/dashboard/projects/${projectId}`);
}
