// Dashboard home page for authenticated users
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Welcome</h2>
          <p className="mt-2 text-sm text-slate-600">Signed in as —</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Sales (last 12 months)
          </h2>
          <div className="mt-3 h-24 rounded-lg border border-dashed" />
        </div>
      </div>

      {/* Joinery AI box */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Joinery AI</h2>
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
            Try: “sales this month?”
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Type a question..."
            />
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
