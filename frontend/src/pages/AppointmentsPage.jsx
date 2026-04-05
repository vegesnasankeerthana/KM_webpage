import React, { useState, useEffect } from 'react'
import { RefreshCw, Calendar } from 'lucide-react'
import api from '../utils/api'

const STATUS_STYLE = {
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  pending:   'bg-amber-50  text-amber-700  border-amber-200',
  cancelled: 'bg-red-50    text-red-700    border-red-200',
}

export default function AppointmentsPage({ toast }) {
  const [appointments, setAppointments] = useState([])
  const [loading,      setLoading]      = useState(true)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/appointments')
      setAppointments(data)
    } catch {
      toast.error('Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-900">Booked Appointments</h1>
          <p className="text-xs text-slate-400 mt-0.5">{appointments.length} total appointments</p>
        </div>
        <button onClick={load} className="btn-secondary text-xs px-3 py-2">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw size={22} className="animate-spin mr-3" /> Loading…
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Calendar size={40} className="mb-4 opacity-30" />
            <p className="text-base font-medium">No appointments yet</p>
            <p className="text-sm mt-1">Book one via the AI Chat!</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Patient', 'Doctor', 'Date & Time', 'Reason', 'Contact', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt, i) => {
                  const dt = appt.slot_datetime ? new Date(appt.slot_datetime) : null
                  return (
                    <tr key={appt.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{appt.patient_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">DOB: {appt.dob || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: appt.color || '#64748b' }} />
                          <div>
                            <p className="font-medium text-slate-800">{appt.doctor_name || '—'}</p>
                            <p className="text-xs text-slate-400">{appt.specialty || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {dt ? (
                          <>
                            <p className="font-medium">{dt.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</p>
                            <p className="text-xs text-slate-400">{dt.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })}</p>
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                        <p className="truncate">{appt.reason || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{appt.phone || '—'}</p>
                        <p className="text-xs text-blue-500 mt-0.5">{appt.email || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[appt.status] || STATUS_STYLE.pending}`}>
                          {appt.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
