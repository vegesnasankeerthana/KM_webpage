import React, { useState } from 'react'
import Sidebar           from './components/Sidebar'
import ToastContainer    from './components/ToastContainer'
import PatientChat       from './pages/PatientChat'
import AdminDashboard    from './pages/AdminDashboard'
import AppointmentsPage  from './pages/AppointmentsPage'
import { useToast }      from './hooks/useToast'

export default function App() {
  const [view,        setView]        = useState('chat')
  const { toasts,    toast }          = useToast()

  const pages = {
    chat:         <PatientChat       toast={toast} />,
    admin:        <AdminDashboard    toast={toast} />,
    appointments: <AppointmentsPage  toast={toast} />,
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar activeView={view} onNavigate={setView} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {pages[view] || pages.chat}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
