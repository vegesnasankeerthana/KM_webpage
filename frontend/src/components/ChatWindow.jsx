import React, { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'

function TypingIndicator() {
  return (
    <div className="msg-animate flex gap-2.5">
      <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-bold text-blue-600">Kx</span>
      </div>
      <div className="bg-white border border-slate-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
        <span className="typing-dot w-2 h-2 rounded-full bg-slate-400 inline-block" />
      </div>
    </div>
  )
}

export default function ChatWindow({ messages, isTyping, quickReplies, onQuickReply }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">

      {/* Welcome banner (when empty) */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg">
            K
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Welcome to Kyron Medical</h2>
          <p className="text-slate-500 text-sm max-w-xs">
            I'm Kyra, your AI medical assistant. I can help you schedule appointments, refill prescriptions, or answer questions about our practice.
          </p>
        </div>
      )}

      {/* Message list */}
      {messages.map((msg, i) => (
        <MessageBubble
          key={i}
          role={msg.role}
          text={msg.content || msg.text || ''}
          timestamp={msg.timestamp}
        />
      ))}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Quick reply chips */}
      {quickReplies.length > 0 && !isTyping && (
        <div className="msg-animate flex flex-wrap gap-2 pl-10">
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => onQuickReply(qr)}
              className="px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 rounded-full text-xs font-medium transition-all duration-150"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
