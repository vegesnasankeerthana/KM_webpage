import React, { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Send, Trash2 } from 'lucide-react'
import ChatWindow      from '../components/ChatWindow'
import VoiceCallButton from '../components/VoiceCallButton'
import api             from '../utils/api'

// ── Quick-reply sets keyed by intent ─────────────────────────
const QR_SETS = {
  greeting:      ['Schedule an appointment', 'Prescription refill', 'Office hours & address', 'Emergency info'],
  body_part:     ['Heart / chest pain', 'Skin issue', 'Bone / joint pain', 'Headaches / brain'],
  day_pref:      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Any morning slot'],
  confirm:       ['Yes, confirm my appointment', 'No, choose a different time'],
  after_booking: ['Book another appointment', 'Office address', 'No thanks, I\'m done'],
  refill:        ['Yes, submit refill request', 'Never mind'],
}

function detectQuickReplies(text) {
  const t = text.toLowerCase()
  if (t.includes('what brings you') || t.includes('how can i help') || t.includes('help you today'))
    return QR_SETS.greeting
  if (t.includes('body part') || t.includes('concern') || t.includes('specialist') || t.includes('which part'))
    return QR_SETS.body_part
  if (t.includes('preferred day') || t.includes('which day') || t.includes('day work'))
    return QR_SETS.day_pref
  if (t.includes('is that correct') || t.includes('shall i confirm') || t.includes('confirm your appointment'))
    return QR_SETS.confirm
  if (t.includes('confirmation email') || t.includes('anything else') || t.includes('all set'))
    return QR_SETS.after_booking
  if (t.includes('refill') && t.includes('medication'))
    return QR_SETS.refill
  return []
}

export default function PatientChat({ toast }) {
  const [sessionId]    = useState(() => localStorage.getItem('kyron_session') || uuidv4())
  const [messages,     setMessages]     = useState([])
  const [input,        setInput]        = useState('')
  const [isTyping,     setIsTyping]     = useState(false)
  const [quickReplies, setQuickReplies] = useState([])

  // Persist session ID
  useEffect(() => { localStorage.setItem('kyron_session', sessionId) }, [sessionId])

  // Load history from backend OR start fresh
  useEffect(() => {
    api.get(`/chat/history/${sessionId}`)
      .then(({ data }) => {
        if (data.messages?.length) {
          const restored = data.messages.map(m => ({
            ...m,
            content: typeof m.content === 'string' ? m.content : '',
          })).filter(m => typeof m.content === 'string' && m.content.trim())
          setMessages(restored)
          const last = restored.at(-1)
          if (last?.role === 'assistant') setQuickReplies(detectQuickReplies(last.content))
        } else {
          sendGreeting()
        }
      })
      .catch(() => sendGreeting())
  }, [])

  function sendGreeting() {
    const greet = {
      role:      'assistant',
      content:   "Hi! I'm **Kyra**, your Kyron Medical AI assistant 👋\n\nI can help you **schedule an appointment**, request a **prescription refill**, or find **office information**.\n\nWhat can I help you with today?",
      timestamp: new Date().toISOString(),
    }
    setMessages([greet])
    setQuickReplies(QR_SETS.greeting)
  }

  const sendMessage = useCallback(async (text) => {
    const msg = (text || input).trim()
    if (!msg || isTyping) return
    setInput('')
    setQuickReplies([])

    const userMsg = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const { data } = await api.post('/chat/message', { message: msg, sessionId })
      const aiMsg = { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }
      setMessages(prev => [...prev, aiMsg])
      setQuickReplies(detectQuickReplies(data.reply))
      // Check for booking success
      if (data.reply.toLowerCase().includes('confirmation email')) {
        toast.success('Appointment booked! Check your email for confirmation.')
      }
    } catch {
      const errMsg = {
        role:      'assistant',
        content:   'Sorry, I encountered an issue. Please try again in a moment.',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
      toast.error('Connection error — please try again')
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, sessionId, toast])

  async function clearChat() {
    try {
      await api.delete(`/chat/history/${sessionId}`)
    } catch { /* no-op */ }
    setMessages([])
    setQuickReplies([])
    sendGreeting()
    toast.info('Chat cleared')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-900">AI Medical Assistant</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Powered by Claude · <span className="text-green-500">● Online</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearChat} className="btn-secondary text-xs px-3 py-2">
            <Trash2 size={13} /> New Chat
          </button>
          <VoiceCallButton sessionId={sessionId} toast={toast} />
        </div>
      </div>

      {/* Chat messages */}
      <ChatWindow
        messages={messages}
        isTyping={isTyping}
        quickReplies={quickReplies}
        onQuickReply={(qr) => sendMessage(qr)}
      />

      {/* Non-happy-path notice */}
      <div className="px-5 pb-1">
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <span>⚠️</span>
          <span>For medical emergencies, call <strong>911</strong> immediately. This AI cannot provide medical advice.</span>
        </div>
      </div>

      {/* Input bar */}
      <div className="px-5 py-4 bg-white border-t border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 focus-within:border-blue-400 focus-within:bg-white rounded-2xl px-4 py-3 gap-3 transition-all">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type your message…"
              className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
              disabled={isTyping}
            />
          </div>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
          >
            <Send size={16} className={input.trim() && !isTyping ? 'text-white' : 'text-slate-400'} />
          </button>
        </div>
      </div>
    </div>
  )
}
