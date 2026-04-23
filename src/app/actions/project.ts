"use server";

import { auth } from "@/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProject(formData: FormData) {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const domain = formData.get("domain") as string;

  if (!name || !domain) {
    throw new Error("Name and domain are required");
  }

  await query(
    'INSERT INTO projects (user_id, name, domain) VALUES ($1, $2, $3)',
    [session.user.id, name, domain]
  );

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const domain = formData.get("domain") as string;

  if (!name || !domain) {
    throw new Error("Name and domain are required");
  }

  await query(
    'UPDATE projects SET name = $1, domain = $2 WHERE id = $3 AND user_id = $4',
    [name, domain, projectId, session.user.id]
  );

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${projectId}`);
}

export async function deleteProject(projectId: string) {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  await query(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, session.user.id]
  );

  revalidatePath("/dashboard");
  redirect("/dashboard");
}