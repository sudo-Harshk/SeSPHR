export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Left Sidebar - Fixed Width */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col p-4">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Sidebar</h2>
          <p className="text-slate-400 text-sm">Placeholder content</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}

