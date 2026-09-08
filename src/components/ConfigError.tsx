export default function ConfigError() {
  return (
    <div className="flex min-h-full items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">ACT is not configured</h1>
        <p className="mt-2 text-sm text-gray-600">
          The Supabase connection is missing. Create a <code className="rounded bg-gray-100 px-1">.env.local</code> file
          in the project root with:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">
{`VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>`}
        </pre>
        <p className="mt-3 text-sm text-gray-600">
          Then run <code className="rounded bg-gray-100 px-1">supabase/functions</code> deployments and set{" "}
          <code className="rounded bg-gray-100 px-1">GEMINI_API_KEY</code> as a server-side secret. See the README.
        </p>
      </div>
    </div>
  );
}
