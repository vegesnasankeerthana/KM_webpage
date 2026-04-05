import React, { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown, ChevronUp, Lock, Unlock, Trash2, RefreshCw } from 'lucide-react'
import api from '../utils/api'

const DOC_COLORS = {
  1: { bg: 'bg-red-100',    text: 'text-red-700',    dot: '#ef4444' },
  2: { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: '#3b82f6' },
  3: { bg: 'bg-violet-100', text: 'text-violet-700', dot: '#8b5cf6' },
  4: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: '#f59e0b' },
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent || 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function SlotBadge({ slot, onToggleBlock, onDelete }) {
  const dt    = new Date(slot.slot_datetime)
  const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time  = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  let bg = 'bg-green-50 border-green-200 text-green-800'
  let tag = 'Available'
  if (slot.is_booked)  { bg = 'bg-slate-100 border-slate-200 text-slate-500'; tag = 'Booked' }
  if (slot.is_blocked) { bg = 'bg-red-50 border-red-200 text-red-700';        tag = 'Blocked' }

  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${bg}`}>
      <div>
        <span className="font-semibold">{label}</span>
        <span className="ml-1.5 opacity-70">{time}</span>
        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium ${
          slot.is_booked ? 'bg-slate-200 text-slate-600' : slot.is_blocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>{tag}</span>
      </div>
      {!slot.is_booked && (
        <div className="flex gap-1.5 ml-2">
          <button
            onClick={() => onToggleBlock(slot.id, !slot.is_blocked)}
            title={slot.is_blocked ? 'Unblock slot' : 'Block slot'}
            className={`p-1.5 rounded-lg transition-all ${
              slot.is_blocked
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}
          >
            {slot.is_blocked ? <Unlock size={11} /> : <Lock size={11} />}
          </button>
          <button
            onClick={() => onDelete(slot.id)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard({ toast }) {
  const [doctors,  setDoctors]  = useState([])
  const [slots,    setSlots]    = useState({})
  const [stats,    setStats]    = useState({})
  const [expanded, setExpanded] = useState({})
  const [adding,   setAdding]   = useState({})
  const [loading,  setLoading]  = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.get('/admin/doctors'),
        api.get('/admin/stats'),
      ])
      setDoctors(docsRes.data)
      setStats(statsRes.data)
      // Load slots for all doctors
      const slotMap = {}
      await Promise.all(docsRes.data.map(async (doc) => {
        const { data } = await api.get(`/admin/slots/${doc.id}`)
        slotMap[doc.id] = data
      }))
      setSlots(slotMap)
    } catch (e) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function toggleBlock(slotId, block) {
    try {
      await api.patch(`/admin/slots/${slotId}`, { isBlocked: block })
      await loadAll()
      toast.success(block ? 'Slot blocked' : 'Slot opened')
    } catch { toast.error('Failed to update slot') }
  }

  async function deleteSlot(slotId) {
    if (!window.confirm('Delete this slot?')) return
    try {
      await api.delete(`/admin/slots/${slotId}`)
      await loadAll()
      toast.success('Slot deleted')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete slot')
    }
  }

  async function addSlot(docId) {
    const dt = adding[docId]
    if (!dt) { toast.error('Select a date and time first'); return }
    try {
      await api.post('/admin/slots', { doctorId: docId, datetime: dt })
      setAdding(prev => ({ ...prev, [docId]: '' }))
      await loadAll()
      toast.success('Slot added — AI will see this immediately!')
    } catch { toast.error('Failed to add slot') }
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw size={24} className="animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">Changes apply to AI responses in real time</p>
        </div>
        <button onClick={loadAll} className="btn-secondary text-xs px-3 py-2">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Appointments" value={stats.totalAppointments ?? '—'} sub="All time" />
          <StatCard label="Available Slots"    value={stats.availableSlots    ?? '—'} sub="Next 45 days" accent="text-green-600" />
          <StatCard label="Active Doctors"     value={stats.activeDoctors     ?? '—'} sub="4 specialties" />
        </div>

        {/* Real-time notice */}
        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          <span className="text-base">⚡</span>
          <span><strong>Real-time sync:</strong> Any slot you block, open, or add here is reflected in the AI chat instantly — no restart needed.</span>
        </div>

        {/* Provider cards */}
        <div>
          <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Provider Availability</h2>
          <div className="space-y-3">
            {doctors.map(doc => {
              const docSlots   = slots[doc.id] || []
              const available  = docSlots.filter(s => !s.is_booked && !s.is_blocked).length
              const booked     = docSlots.filter(s =>  s.is_booked).length
              const blocked    = docSlots.filter(s => !s.is_booked && s.is_blocked).length
              const colors     = DOC_COLORS[doc.id] || DOC_COLORS[1]
              const isOpen     = expanded[doc.id]

              return (
                <div key={doc.id} className="card overflow-hidden">
                  {/* Doctor header */}
                  <button
                    onClick={() => toggleExpand(doc.id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
                        style={{ background: doc.color || '#3b82f6' }}
                      >
                        {doc.initials}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.specialty} · {(doc.body_parts || []).slice(0,3).join(', ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-600 font-semibold">{available} open</span>
                        <span className="text-slate-400">{booked} booked</span>
                        {blocked > 0 && <span className="text-red-500">{blocked} blocked</span>}
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {/* Expanded: slots grid + add form */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-4 pt-4 space-y-4">
                      {docSlots.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-4">No slots configured. Add one below.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                          {docSlots.map(slot => (
                            <SlotBadge
                              key={slot.id}
                              slot={slot}
                              onToggleBlock={toggleBlock}
                              onDelete={deleteSlot}
                            />
                          ))}
                        </div>
                      )}

                      {/* Add slot inline */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                        <Plus size={14} className="text-slate-400 flex-shrink-0" />
                        <input
                          type="datetime-local"
                          className="input-field flex-1 text-xs py-2"
                          value={adding[doc.id] || ''}
                          onChange={e => setAdding(prev => ({ ...prev, [doc.id]: e.target.value }))}
                        />
                        <button
                          onClick={() => addSlot(doc.id)}
                          className="btn-primary text-xs px-3 py-2 flex-shrink-0"
                        >
                          Add Slot
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
