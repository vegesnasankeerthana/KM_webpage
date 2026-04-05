import React from 'react'

function parseMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/\n/g,            '<br/>')
}

export default function MessageBubble({ role, text, timestamp }) {
  const isUser = role === 'user'
  const time   = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div className={`msg-animate flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''} max-w-[78%] ${isUser ? 'ml-auto' : ''}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs font-bold text-blue-600">Kx</span>
        </div>
      )}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-xs font-semibold text-white">You</span>
        </div>
      )}

      <div>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-sm'
          }`}
          dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
        />
        <p className={`text-xs text-slate-400 mt-1 px-1 ${isUser ? 'text-right' : ''}`}>{time}</p>
      </div>
    </div>
  )
}
