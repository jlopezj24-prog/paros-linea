import { useEffect, useState } from 'react'
import api from '../api.js'

// Fecha local YYYY-MM-DD; para turno noche en madrugada, usa la fecha en que inició el turno (ayer)
function fechaTurnoActual() {
  const ahora = new Date()
  const h = ahora.getHours()
  const base = new Date(ahora)
  let turno = 'dia'
  if (h < 6) { base.setDate(base.getDate() - 1); turno = 'noche' }
  else if (h >= 18) { turno = 'noche' }
  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return { fecha: `${y}-${m}-${d}`, turno }
}

export default function GerencialPage() {
  const ini = fechaTurnoActual()
  const [pass, setPass] = useState('')
  const [auth, setAuth] = useState(false)
  const [fecha, setFecha] = useState(ini.fecha)
  const [turno, setTurno] = useState(ini.turno)
  const [umbral, setUmbral] = useState(2)
  const [lineaId, setLineaId] = useState('')
  const [lineas, setLineas] = useState([])
  const [paros, setParos] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data)).catch(() => {})
  }, [])

  async function cargar(passOverride) {
    const p = passOverride ?? pass
    try {
      const params = { fecha, turno, password: p, umbral_min: umbral }
      if (lineaId) params.linea_id = lineaId
      const r = await api.get('/reporte-gerencial', { params })
      setParos(r.data); setAuth(true); setErr('')
    } catch (e) {
      setErr(e?.response?.status === 401 ? 'Contraseña incorrecta' : 'Error al consultar')
      setAuth(false)
    }
  }

  useEffect(() => { if (auth) cargar() }, [fecha, turno, umbral, lineaId])

  async function excluir(id) {
    if (!confirm('¿Excluir este paro de la bitácora?')) return
    await api.patch(`/paros/${id}/excluir`, null, { params: { password: pass } })
    cargar()
  }

  if (!auth) {
    return (
      <div className="max-w-sm mx-auto bg-white rounded-lg shadow p-6 mt-10">
        <h2 className="font-semibold text-lg mb-2">Acceso gerencial</h2>
        <p className="text-xs text-slate-500 mb-4">Solo paros mayores al umbral configurado.</p>
        <input type="password" placeholder="Contraseña" value={pass}
               onChange={e => setPass(e.target.value)}
               className="border rounded px-3 py-2 w-full mb-2"
               onKeyDown={e => e.key === 'Enter' && cargar()} />
        {err && <p className="text-red-600 text-sm mb-2">{err}</p>}
        <button onClick={() => cargar()}
                className="bg-slate-900 text-white w-full py-2 rounded hover:bg-slate-700">
          Ingresar
        </button>
      </div>
    )
  }

  const totalMin = paros.reduce((s, p) => s + p.duracion_min, 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                 className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Turno</label>
          <select value={turno} onChange={e => setTurno(e.target.value)}
                  className="border rounded px-2 py-1">
            <option value="dia">Día</option>
            <option value="noche">Noche</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Umbral (min)</label>
          <input type="number" min="0" step="0.5" value={umbral}
                 onChange={e => setUmbral(Number(e.target.value))}
                 className="border rounded px-2 py-1 w-24" />
        </div>
        <div className="min-w-[200px]">
          <label className="block text-xs text-slate-500">Línea</label>
          <select value={lineaId} onChange={e => setLineaId(e.target.value)}
                  className="border rounded px-2 py-1 w-full">
            <option value="">— Todas —</option>
            <optgroup label="Vestiduras">
              {lineas.filter(l => l.area === 'Vestiduras').map(l =>
                <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </optgroup>
            <optgroup label="Chasis">
              {lineas.filter(l => l.area === 'Chasis').map(l =>
                <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="flex-1 text-right text-sm flex items-center justify-end gap-3 flex-wrap">
          <div>
            <span className="text-slate-500">Total paros: </span><b>{paros.length}</b>{' · '}
            <span className="text-slate-500">Minutos: </span><b>{totalMin.toFixed(1)}</b>
          </div>
          <a className="bg-emerald-600 text-white text-sm px-3 py-2 rounded hover:bg-emerald-700"
             href={`/api/export/gerencial-excel?fecha=${fecha}&turno=${turno}&umbral_min=${umbral}${lineaId ? `&linea_id=${lineaId}` : ''}&password=${encodeURIComponent(pass)}`}
             target="_blank" rel="noreferrer">
            Exportar Excel
          </a>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr className="text-left">
              <th className="px-3 py-2">Línea</th>
              <th className="px-3 py-2">Área</th>
              <th className="px-3 py-2">Hora</th>
              <th className="px-3 py-2">Categoría</th>
              <th className="px-3 py-2">Min</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {paros.length === 0 && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-6">
                Sin paros que reportar para esta combinación.
              </td></tr>
            )}
            {paros.map(p => (
              <tr key={p.paro_id} className="border-t"
                  style={{ borderLeft: `5px solid ${p.hex}` }}>
                <td className="px-3 py-2 font-medium">{p.linea}</td>
                <td className="px-3 py-2 text-slate-600">{p.area}</td>
                <td className="px-3 py-2">{p.hora}</td>
                <td className="px-3 py-2">
                  <span className="text-white px-2 py-0.5 rounded text-xs"
                        style={{ background: p.hex }}>{p.categoria}</span>
                </td>
                <td className="px-3 py-2 font-bold">{p.duracion_min}</td>
                <td className="px-3 py-2 text-slate-700">{p.descripcion}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => excluir(p.paro_id)}
                          className="text-red-600 hover:underline text-xs">
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
