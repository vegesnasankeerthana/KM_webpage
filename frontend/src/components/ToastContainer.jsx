import React from 'react'
import { CheckCircle, XCircle, Info } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={16} className="text-green-400 flex-shrink-0" />,
  error:   <XCircle    size={16} className="text-red-400   flex-shrink-0" />,
  info:    <Info       size={16} className="text-blue-400  flex-shrink-0" />,
}

const BG = {
  success: 'bg-slate-900 border-green-700',
  error:   'bg-slate-900 border-red-700',
  info:    'bg-slate-900 border-blue-700',
}

export default function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast-show flex items-center gap-3 px-4 py-3 rounded-xl border text-white text-sm max-w-xs shadow-xl ${BG[t.type]}`}
        >
          {ICONS[t.type]}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
