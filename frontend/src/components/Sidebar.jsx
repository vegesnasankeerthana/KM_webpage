import React from 'react'
import { MessageSquare, LayoutDashboard, Calendar, Activity } from 'lucide-react'

const NAV = [
  { id: 'chat',         label: 'AI Chat',          icon: MessageSquare  },
  { id: 'admin',        label: 'Admin Dashboard',   icon: LayoutDashboard },
  { id: 'appointments', label: 'Appointments',      icon: Calendar       },
]

export default function Sidebar({ activeView, onNavigate }) {
  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col flex-shrink-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            K
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">Kyron Medical</h2>
            <p className="text-xs text-slate-400">Patient Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Menu</p>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left ${
              activeView === id
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer status */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5 px-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs text-slate-500">AI Assistant Online</span>
        </div>
        <div className="flex items-center gap-2.5 px-2 mt-2">
          <Activity size={12} className="text-slate-300" />
          <span className="text-xs text-slate-400">Kyron Medical Group</span>
        </div>
      </div>
    </aside>
  )
}
