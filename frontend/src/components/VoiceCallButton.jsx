import React, { useState } from 'react'
import { Phone, PhoneOff, X } from 'lucide-react'
import api from '../utils/api'

export default function VoiceCallButton({ sessionId, toast }) {
  const [showModal,   setShowModal]   = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [calling,     setCalling]     = useState(false)
  const [phone,       setPhone]       = useState('')
  const [smsOptIn,    setSmsOptIn]    = useState(true)
  const [connected,   setConnected]   = useState(false)

  async function handleCall() {
    if (!phone.trim()) { toast.error('Please enter your phone number'); return }
    setCalling(true)
    try {
      await api.post('/voice/initiate', { sessionId, phone: phone.trim(), smsOptIn })
      setShowModal(false)
      setShowOverlay(true)
      setTimeout(() => setConnected(true), 2500)
      toast.success('Connecting your voice call…')
    } catch {
      toast.error('Could not initiate call. Check your phone number.')
    } finally {
      setCalling(false)
    }
  }

  function endCall() {
    setShowOverlay(false)
    setConnected(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setShowModal(true)}
        className="btn-voice"
      >
        <Phone size={15} />
        Switch to Voice Call
      </button>

      {/* Phone number modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-7 w-[420px] max-w-[95vw] shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-slate-900">Switch to Voice Call</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Enter your number and our AI will call you instantly — with full memory of this conversation.
            </p>

            <label className="label">Your Phone Number</label>
            <input
              type="tel"
              className="input-field mb-4"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCall()}
              autoFocus
            />

            <label className="flex items-center gap-3 cursor-pointer mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={e => setSmsOptIn(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                I agree to receive SMS appointment confirmations from Kyron Medical
              </span>
            </label>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCall} disabled={calling} className="btn-voice">
                <Phone size={14} />
                {calling ? 'Connecting…' : 'Call Me Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {showOverlay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 text-center shadow-2xl">
            {/* Pulsing avatar */}
            <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-200 flex items-center justify-center mx-auto mb-4"
                 style={{ animation: 'pulseRing 2s infinite' }}>
              <Phone size={32} className="text-blue-600" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {connected ? 'Call Connected' : 'Connecting…'}
            </h3>
            <p className="text-sm text-slate-500 mb-5">
              {connected
                ? 'The AI has your full conversation history. Speak naturally!'
                : 'Please wait — we\'re calling you now and loading your chat context.'}
            </p>

            {/* Sound wave bars */}
            <div className="flex items-center justify-center gap-1.5 h-10 mb-6">
              {[12, 20, 28, 20, 12].map((h, i) => (
                <div
                  key={i}
                  className={`voice-wave w-1.5 bg-blue-500 rounded-full ${connected ? '' : 'opacity-30'}`}
                  style={{ height: h + 'px' }}
                />
              ))}
            </div>

            <button onClick={endCall} className="btn-danger w-full justify-center">
              <PhoneOff size={15} />
              End Call
            </button>
          </div>
        </div>
      )}
    </>
  )
}
