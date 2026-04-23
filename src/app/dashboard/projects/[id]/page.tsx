import { auth } from "@/auth";
import { query } from "@/lib/db";
import { redirect } from "next/navigation";
import { addKeyword } from "@/app/actions/keyword";
import { addRegion } from "@/app/actions/region";
import { runAudit } from "@/app/actions/audit";
import { deleteProject } from "@/app/actions/project";
import Link from "next/link";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  // Get project
  const projectRes = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [id, session.user.id]);
  if (projectRes.rows.length === 0) redirect("/dashboard");
  const project = projectRes.rows[0];

  const deleteProjectWithId = deleteProject.bind(null, project.id);

  // Get keywords
  const keywordsRes = await query('SELECT * FROM keywords WHERE project_id = $1 ORDER BY created_at DESC', [id]);
  const keywords = keywordsRes.rows;

  // Get regions
  const regionsRes = await query('SELECT * FROM regions WHERE project_id = $1 ORDER BY created_at DESC', [id]);
  const regions = regionsRes.rows;

  // Get audits
  const auditsRes = await query('SELECT * FROM audits WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10', [id]);
  const audits = auditsRes.rows;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 mb-4 inline-block">
            &larr; Back to projects
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500">{project.domain}</p>
        </div>
        <div className="flex items-center gap-x-3 mt-8">
          <Link
            href={`/dashboard/projects/${project.id}/edit`}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Edit
          </Link>
          <form action={deleteProjectWithId}>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Keywords Section */}
        <div className="bg-white shadow sm:rounded-lg flex flex-col">
          <div className="px-4 py-5 sm:p-6 flex-grow">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Keywords</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Add target keywords for position tracking.</p>
            </div>
            <form action={addKeyword} className="mt-5 sm:flex sm:items-center">
              <input type="hidden" name="projectId" value={project.id} />
              <div className="w-full sm:max-w-xs">
                <label htmlFor="phrase" className="sr-only">Keyword</label>
                <input
                  type="text"
                  name="phrase"
                  id="phrase"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  placeholder="e.g., best seo tool"
                  required
                />
              </div>
              <button
                type="submit"
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:ml-3 sm:mt-0 sm:w-auto"
              >
                Add
              </button>
            </form>
            <ul className="mt-6 divide-y divide-gray-200">
              {keywords.map(kw => (
                <li key={kw.id} className="py-3 flex justify-between items-center text-sm font-medium text-gray-900">
                  {kw.phrase}
                </li>
              ))}
              {keywords.length === 0 && <li className="py-3 text-sm text-gray-500">No keywords added yet.</li>}
            </ul>
          </div>
        </div>

        {/* Regions Section */}
        <div className="bg-white shadow sm:rounded-lg flex flex-col">
          <div className="px-4 py-5 sm:p-6 flex-grow">
            <h3 className="text-base font-semibold leading-6 text-gray-900">Regions & Search Engines</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Configure where you want to track the keywords.</p>
            </div>
            <form action={addRegion} className="mt-5 flex flex-col gap-3">
              <input type="hidden" name="projectId" value={project.id} />
              <div className="w-full">
                <input
                  type="text"
                  name="name"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                  placeholder="Region (e.g., New York, Global)"
                  required
                />
              </div>
              <div className="w-full flex gap-3 items-center">
                <select
                  name="searchEngine"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3 bg-white"
                  required
                >
                  <option value="google">Google</option>
                  <option value="yandex">Yandex</option>
                  <option value="bing">Bing</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 w-auto whitespace-nowrap"
                >
                  Add Region
                </button>
              </div>
            </form>
            <ul className="mt-6 divide-y divide-gray-200">
              {regions.map(reg => (
                <li key={reg.id} className="py-3 flex justify-between items-center text-sm font-medium text-gray-900">
                  <span>{reg.name}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full capitalize text-gray-600 border border-gray-200">{reg.search_engine}</span>
                </li>
              ))}
              {regions.length === 0 && <li className="py-3 text-sm text-gray-500">No regions added yet.</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Technical Audit Section */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900">Technical Audit</h3>
          <p className="mt-2 max-w-xl text-sm text-gray-500">Run a quick technical scan on any page of this project.</p>
          <form action={runAudit} className="mt-5 sm:flex sm:items-center">
            <input type="hidden" name="projectId" value={project.id} />
            <div className="w-full sm:max-w-md">
              <label htmlFor="url" className="sr-only">Page URL</label>
              <input
                type="url"
                name="url"
                id="url"
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                placeholder={`https://${project.domain}/path`}
                defaultValue={`https://${project.domain}`}
                required
              />
            </div>
            <button
              type="submit"
              className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:ml-3 sm:mt-0 sm:w-auto"
            >
              Scan Page
            </button>
          </form>
          
          <div className="mt-8 overflow-hidden border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {audits.map(audit => (
                <li key={audit.id} className="py-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 truncate max-w-xs md:max-w-md">{audit.url}</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${audit.status_code >= 200 && audit.status_code < 300 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {audit.status_code}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p><strong>Title:</strong> {audit.title ? <span className="text-gray-900">{audit.title}</span> : <span className="text-red-500">Missing</span>}</p>
                      <p className="mt-1"><strong>Description:</strong> {audit.description ? "✅ Present" : <span className="text-red-500">❌ Missing</span>}</p>
                    </div>
                    <div>
                      <p><strong>H1 Count:</strong> {audit.h1_count} {audit.h1_count === 1 ? '✅' : <span className="text-red-500">⚠️ (Should be 1)</span>}</p>
                      <p className="mt-1 text-xs text-gray-400">Checked: {new Date(audit.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </li>
              ))}
              {audits.length === 0 && <li className="py-4 text-sm text-gray-500">No audits run yet.</li>}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
