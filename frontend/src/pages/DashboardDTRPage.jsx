import { useEffect, useMemo, useState } from 'react'
import api from '../api.js'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, LineChart, Line, Cell,
} from 'recharts'

const CAT_COLORS = {
  FPS: '#dc2626',     // rojo
  Andon: '#f59e0b',   // ámbar
  PF: '#0ea5e9',      // azul cielo
  MF: '#2563eb',      // azul
  TFS: '#a855f7',     // morado
  TFIB: '#ec4899',    // rosa
  Otros: '#6b7280',   // gris
}

function fechaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fechaHaceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return fechaLocal(d)
}

export default function DashboardDTRPage() {
  const [lineas, setLineas] = useState([])
  const [imports, setImports] = useState([])
  const [data, setData] = useState(null)

  // Filtros
  const [fechaDesde, setFechaDesde] = useState(fechaHaceDias(7))
  const [fechaHasta, setFechaHasta] = useState(fechaLocal())
  const [lineaFiltro, setLineaFiltro] = useState('')
  const [catFiltro, setCatFiltro] = useState('')

  // Form de carga
  const [archivo, setArchivo] = useState(null)
  const [cargaFecha, setCargaFecha] = useState(fechaLocal())
  const [cargaTurno, setCargaTurno] = useState('dia')
  const [cargaLinea, setCargaLinea] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data))
  }, [])

  function paramsFiltro() {
    const p = {}
    if (fechaDesde) p.fecha_desde = fechaDesde
    if (fechaHasta) p.fecha_hasta = fechaHasta
    if (lineaFiltro) p.linea_id = lineaFiltro
    if (catFiltro) p.categoria = catFiltro
    return p
  }

  async function cargar() {
    try {
      const params = paramsFiltro()
      const [d, l] = await Promise.all([
        api.get('/dtr/dashboard', { params }),
        api.get('/dtr/imports', { params: {
          fecha_desde: params.fecha_desde,
          fecha_hasta: params.fecha_hasta,
          linea_id: params.linea_id,
        }}),
      ])
      setData(d.data)
      setImports(l.data)
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message
      setMsg(`Error al cargar dashboard: ${det}`)
    }
  }

  useEffect(() => { cargar() }, [fechaDesde, fechaHasta, lineaFiltro, catFiltro])

  async function subir() {
    if (!archivo) { alert('Selecciona PDF'); return }
    if (!cargaLinea) { alert('Selecciona línea'); return }
    setCargando(true)
    setMsg('Procesando PDF…')
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      const r = await api.post('/dtr/ingest', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: {
          fecha: cargaFecha,
          turno: cargaTurno,
          linea_id: cargaLinea,
        },
      })
      setMsg(`✓ Importado: ${r.data.alarmas_total} alarmas, ${r.data.duracion_total_min} min totales`)
      setArchivo(null)
      // Reset input file
      const input = document.getElementById('dtr-file-input')
      if (input) input.value = ''
      cargar()
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
      setMsg('')
      alert(`Error al subir${status}:\n${typeof det === 'string' ? det : JSON.stringify(det)}`)
    } finally {
      setCargando(false)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  async function borrarImport(id) {
    if (!confirm('¿Borrar este import del dashboard?')) return
    try {
      await api.delete(`/dtr/imports/${id}`)
      cargar()
    } catch (e) {
      alert('Error al borrar')
    }
  }

  const cats = data?.por_categoria || []
  const tendencia = data?.tendencia_diaria || []
  const topDur = data?.top_alarmas_duracion || []
  const topFreq = data?.top_alarmas_frecuencia || []
  const resumen = data?.resumen || { total_paros: 0, total_min: 0, total_imports: 0 }

  // Datos para barras horizontales (recharts horizontal con layout="vertical")
  const topDurChart = useMemo(() => topDur.map(t => ({
    ...t,
    label: t.mensaje.length > 60 ? t.mensaje.slice(0, 60) + '…' : t.mensaje,
  })), [topDur])
  const topFreqChart = useMemo(() => topFreq.map(t => ({
    ...t,
    label: t.mensaje.length > 60 ? t.mensaje.slice(0, 60) + '…' : t.mensaje,
  })), [topFreq])

  return (
    <div className="space-y-4">
      {/* CARGA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Cargar PDF DTR (un día después del cierre)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Sube el PDF "Top Alarms" por línea/turno. Cada carga reemplaza la anterior con el mismo (fecha + turno + línea).
          Los paros se acumulan automáticamente en el dashboard.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500">Fecha producción</label>
            <input type="date" value={cargaFecha} onChange={e => setCargaFecha(e.target.value)}
                   className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Turno</label>
            <select value={cargaTurno} onChange={e => setCargaTurno(e.target.value)}
                    className="border rounded px-2 py-1 w-full">
              <option value="dia">Día</option>
              <option value="noche">Noche</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Línea</label>
            <select value={cargaLinea} onChange={e => setCargaLinea(e.target.value)}
                    className="border rounded px-2 py-1 w-full">
              <option value="">— Seleccionar —</option>
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
          <div className="col-span-2 flex items-end gap-2">
            <input id="dtr-file-input" type="file" accept="application/pdf"
                   onChange={e => setArchivo(e.target.files?.[0] || null)}
                   className="text-sm flex-1" />
            <button onClick={subir} disabled={cargando}
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {cargando ? 'Procesando…' : 'Subir DTR'}
            </button>
          </div>
        </div>
        {msg && <div className="mt-2 text-sm text-slate-600">{msg}</div>}
      </div>

      {/* FILTROS DASHBOARD */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Filtros del dashboard</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                   className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                   className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Línea</label>
            <select value={lineaFiltro} onChange={e => setLineaFiltro(e.target.value)}
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
          <div>
            <label className="block text-xs text-slate-500">Categoría DTR</label>
            <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
                    className="border rounded px-2 py-1 w-full">
              <option value="">— Todas —</option>
              {Object.keys(CAT_COLORS).map(c =>
                <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* RESUMEN KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Total paros (frecuencia)</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.total_paros}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Tiempo total (min)</div>
          <div className="text-2xl font-bold text-red-600">{resumen.total_min.toFixed(1)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">PDFs cargados</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.total_imports}</div>
        </div>
      </div>

      {/* PARETO POR CATEGORÍA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">Paros por categoría DTR</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-slate-500 mb-1">Tiempo de paro (min)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" />
                <YAxis />
                <Tooltip formatter={(v) => `${v} min`} />
                <Bar dataKey="duracion_min" name="Min">
                  {cats.map((c, i) =>
                    <Cell key={i} fill={CAT_COLORS[c.categoria] || '#6b7280'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Frecuencia (count)</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count_total" name="Count">
                  {cats.map((c, i) =>
                    <Cell key={i} fill={CAT_COLORS[c.categoria] || '#6b7280'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Tabla resumen */}
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-left text-slate-600 border-b">
              <th className="py-1 px-2">Categoría</th>
              <th className="px-2">Descripción</th>
              <th className="px-2 text-right">Frecuencia</th>
              <th className="px-2 text-right">Min</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => (
              <tr key={c.categoria} className="border-b">
                <td className="py-1 px-2 font-medium" style={{color: CAT_COLORS[c.categoria]}}>
                  {c.categoria}
                </td>
                <td className="px-2 text-slate-600">{c.descripcion}</td>
                <td className="px-2 text-right">{c.count_total}</td>
                <td className="px-2 text-right">{c.duracion_min.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TENDENCIA DIARIA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">Tendencia diaria de paros</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={tendencia}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fecha" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="duracion_min"
                  name="Min totales" stroke="#dc2626" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="count_total"
                  name="Frecuencia" stroke="#2563eb" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* TOP ALARMAS POR DURACIÓN */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">Top alarmas por duración</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, topDurChart.length * 28)}>
          <BarChart data={topDurChart} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="label" width={300} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v) => `${v} min`} />
            <Bar dataKey="duracion_min" name="Min">
              {topDurChart.map((c, i) =>
                <Cell key={i} fill={CAT_COLORS[c.categoria] || '#6b7280'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TOP ALARMAS POR FRECUENCIA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">Top alarmas por frecuencia</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, topFreqChart.length * 28)}>
          <BarChart data={topFreqChart} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="label" width={300} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="count" name="Count">
              {topFreqChart.map((c, i) =>
                <Cell key={i} fill={CAT_COLORS[c.categoria] || '#6b7280'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* PDFs CARGADOS */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-slate-800 mb-2 text-sm">
          PDFs cargados ({imports.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600 border-b">
                <th className="py-1 px-2">Fecha</th>
                <th className="px-2">Turno</th>
                <th className="px-2">Línea</th>
                <th className="px-2">Sub área</th>
                <th className="px-2">Hora</th>
                <th className="px-2 text-right">Alarmas</th>
                <th className="px-2 text-right">Min</th>
                <th className="px-2"></th>
              </tr>
            </thead>
            <tbody>
              {imports.map(i => (
                <tr key={i.id} className="border-b hover:bg-slate-50">
                  <td className="py-1 px-2">{i.fecha}</td>
                  <td className="px-2">{i.turno}</td>
                  <td className="px-2">{i.linea_nombre}</td>
                  <td className="px-2">{i.sub_area}</td>
                  <td className="px-2">{i.start_time}-{i.end_time}</td>
                  <td className="px-2 text-right">{i.alarmas_total}</td>
                  <td className="px-2 text-right">{i.duracion_total_min.toFixed(1)}</td>
                  <td className="px-2 text-right">
                    <button onClick={() => borrarImport(i.id)}
                            className="text-red-600 hover:underline">Borrar</button>
                  </td>
                </tr>
              ))}
              {imports.length === 0 && (
                <tr><td colSpan={8} className="py-3 text-center text-slate-400">
                  Sin PDFs en el rango seleccionado
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
