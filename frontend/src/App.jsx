import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import CapturaPage from './pages/CapturaPage.jsx'
import GerencialPage from './pages/GerencialPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ImportarDTRPage from './pages/ImportarDTRPage.jsx'

const tab = ({ isActive }) =>
  `px-4 py-2 rounded-md text-sm font-medium ${
    isActive ? 'bg-white text-slate-900 shadow' : 'text-slate-200 hover:bg-slate-700'
  }`

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold flex-1">Paros de Línea digital</h1>
          <nav className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <NavLink to="/captura" className={tab}>Captura</NavLink>
            <NavLink to="/dashboard" className={tab}>Dashboard</NavLink>
            <NavLink to="/gerencial" className={tab}>Gerencial</NavLink>
            <NavLink to="/importar-dtr" className={tab}>Importar DTR</NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/captura" replace />} />
          <Route path="/captura" element={<CapturaPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/gerencial" element={<GerencialPage />} />
          <Route path="/importar-dtr" element={<ImportarDTRPage />} />
        </Routes>
      </main>
      <footer className="text-center text-xs text-slate-500 py-3">
        Meta JPH 62 · Lun-Sáb · Turnos 06-18 y 18-06 · 11h 15min productivos
      </footer>
    </div>
  )
}
