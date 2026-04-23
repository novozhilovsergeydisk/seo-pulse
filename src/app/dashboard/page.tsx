import { auth } from "@/auth";
import { query } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  
  const res = await query(
    'SELECT id, name, domain, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC', 
    [session?.user?.id]
  );
  const projects = res.rows;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold leading-6 text-gray-900">Projects</h1>
          <p className="mt-2 text-sm text-gray-700">A list of all your SEO projects and domains.</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link 
            href="/dashboard/projects/new" 
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Add Project
          </Link>
        </div>
      </div>
      
      <div className="mt-8 flow-root">
        <ul role="list" className="divide-y divide-gray-100 bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-start gap-x-3">
                  <p className="text-sm font-semibold leading-6 text-gray-900">{project.name}</p>
                </div>
                <div className="mt-1 flex items-center gap-x-2 text-xs leading-5 text-gray-500">
                  <p className="truncate">{project.domain}</p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-x-2">
                <Link 
                  href={`/dashboard/projects/${project.id}/edit`} 
                  className="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block"
                >
                  Edit <span className="sr-only">, {project.name}</span>
                </Link>
                <Link 
                  href={`/dashboard/projects/${project.id}`} 
                  className="hidden rounded-md bg-indigo-50 px-2.5 py-1.5 text-sm font-semibold text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-300 hover:bg-indigo-100 sm:block"
                >
                  View <span className="sr-only">, {project.name}</span>
                </Link>
              </div>
            </li>
          ))}
          {projects.length === 0 && (
             <li className="px-4 py-10 text-center text-sm text-gray-500">
                No projects found. Create one to get started!
             </li>
          )}
        </ul>
      </div>
    </div>
  );
}
