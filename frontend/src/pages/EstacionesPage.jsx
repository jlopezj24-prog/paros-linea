import { useEffect, useMemo, useState } from 'react'
import api from '../api.js'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, LineChart, Line, Cell,
} from 'recharts'

const CAT_COLORS = {
  FPS: '#dc2626',
  Andon: '#f59e0b',
  PF: '#0ea5e9',
  MF: '#2563eb',
  TFS: '#a855f7',
  TFIB: '#ec4899',
  Otros: '#6b7280',
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

export default function EstacionesPage() {
  const [lineas, setLineas] = useState([])
  const [imports, setImports] = useState([])
  const [data, setData] = useState(null)

  const [fechaDesde, setFechaDesde] = useState(fechaHaceDias(7))
  const [fechaHasta, setFechaHasta] = useState(fechaLocal())
  const [lineaFiltro, setLineaFiltro] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [estacionFiltro, setEstacionFiltro] = useState('')
  const [topN, setTopN] = useState(15)

  const [archivo, setArchivo] = useState(null)
  const [cargaFecha, setCargaFecha] = useState(fechaLocal())
  const [cargaTurno, setCargaTurno] = useState('dia')
  const [cargaLinea, setCargaLinea] = useState('')
  const [cargando, setCargando] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data))
  }, [])

  function paramsFiltro() {
    const p = { top_n: topN }
    if (fechaDesde) p.fecha_desde = fechaDesde
    if (fechaHasta) p.fecha_hasta = fechaHasta
    if (lineaFiltro) p.linea_id = lineaFiltro
    if (catFiltro) p.categoria = catFiltro
    if (estacionFiltro) p.estacion = estacionFiltro
    return p
  }

  async function cargar() {
    try {
      const params = paramsFiltro()
      const [d, l] = await Promise.all([
        api.get('/alarm-history/dashboard', { params }),
        api.get('/alarm-history/imports', { params: {
          fecha_desde: params.fecha_desde,
          fecha_hasta: params.fecha_hasta,
          linea_id: params.linea_id,
        }}),
      ])
      setData(d.data)
      setImports(l.data)
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message
      setMsg(`Error al cargar: ${det}`)
    }
  }

  useEffect(() => { cargar() }, [fechaDesde, fechaHasta, lineaFiltro, catFiltro, estacionFiltro, topN])

  async function subir() {
    if (!archivo) { alert('Selecciona PDF'); return }
    if (!cargaLinea) { alert('Selecciona línea'); return }
    setCargando(true)
    setMsg('Procesando PDF…')
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      const r = await api.post('/alarm-history/ingest', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params: {
          fecha: cargaFecha,
          turno: cargaTurno,
          linea_id: cargaLinea,
        },
      })
      setMsg(`✓ Importado: ${r.data.eventos_total} eventos · ${r.data.duracion_total_min} min · ${r.data.estaciones_distintas} estaciones`)
      setArchivo(null)
      const input = document.getElementById('ah-file-input')
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
    if (!confirm('¿Borrar este import?')) return
    try {
      await api.delete(`/alarm-history/imports/${id}`)
      cargar()
    } catch (e) {
      alert('Error al borrar')
    }
  }

  async function vistaPrevia() {
    if (!archivo) { alert('Selecciona PDF'); return }
    setCargando(true)
    setMsg('Analizando PDF (sin guardar)…')
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      const r = await api.post('/alarm-history/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(r.data)
      setMsg('')
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message
      alert(`Error: ${typeof det === 'string' ? det : JSON.stringify(det)}`)
    } finally {
      setCargando(false)
    }
  }

  const cats = data?.por_categoria || []
  const tendencia = data?.tendencia_diaria || []
  const horaria = data?.distribucion_horaria || []
  const topDur = data?.top_estaciones_duracion || []
  const topFreq = data?.top_estaciones_frecuencia || []
  const detalle = data?.detalle_estacion
  const resumen = data?.resumen || { total_eventos: 0, total_min: 0, estaciones: 0, total_imports: 0 }

  // Datos para barras horizontales
  const topDurChart = useMemo(() => topDur.map(t => ({
    estacion: t.estacion,
    duracion_min: t.duracion_min,
    count: t.count,
    color: CAT_COLORS[t.categoria_top] || CAT_COLORS.Otros,
  })), [topDur])
  const topFreqChart = useMemo(() => topFreq.map(t => ({
    estacion: t.estacion,
    count: t.count,
    duracion_min: t.duracion_min,
    color: CAT_COLORS[t.categoria_top] || CAT_COLORS.Otros,
  })), [topFreq])

  return (
    <div className="space-y-4">
      {/* CARGA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Cargar PDF Alarm History (eventos por estación con timestamp)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Sube el PDF "Alarm History Report" por línea/turno. Cada evento individual queda registrado con su hora exacta
          para análisis de mejora continua. La carga reemplaza la anterior con el mismo (fecha + turno + línea).
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
            <input id="ah-file-input" type="file" accept="application/pdf"
                   onChange={e => { setArchivo(e.target.files?.[0] || null); setPreview(null) }}
                   className="text-sm flex-1" />
            <button onClick={vistaPrevia} disabled={cargando || !archivo}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm px-3 py-2 rounded disabled:opacity-50">
              Vista previa
            </button>
            <button onClick={subir} disabled={cargando}
                    className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {cargando ? 'Procesando…' : 'Subir Alarm History'}
            </button>
          </div>
        </div>
        {msg && <div className="mt-2 text-sm text-slate-600">{msg}</div>}
        {preview && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-3 text-xs">
            <div className="font-semibold mb-2 text-slate-700">
              Diagnóstico parser · {preview.diagnostico.bloques_detectados} bloques · {preview.diagnostico.eventos_total} eventos · {preview.estaciones_distintas} estaciones distintas
              {preview.diagnostico.eventos_descartados > 0 && (
                <span className="text-amber-600"> · {preview.diagnostico.eventos_descartados} eventos descartados</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="font-medium mb-1">Top estaciones detectadas:</div>
                {preview.estaciones.length === 0
                  ? <div className="text-red-600">⚠ Ninguna estación detectada. Comparte las primeras líneas del PDF (panel derecho) para ajustar el parser.</div>
                  : (
                    <table className="w-full">
                      <thead><tr className="bg-slate-200"><th className="text-left p-1">Estación</th><th className="text-right p-1">Eventos</th><th className="text-right p-1">Min</th></tr></thead>
                      <tbody>
                        {preview.estaciones.map((e, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-1">{e.estacion}</td>
                            <td className="p-1 text-right">{e.count}</td>
                            <td className="p-1 text-right">{e.duracion_min}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                }
              </div>
              <div>
                <div className="font-medium mb-1">Primeros eventos (con estación + mensaje):</div>
                <div className="bg-white border border-slate-200 rounded p-2 max-h-48 overflow-auto font-mono text-[11px] space-y-1">
                  {preview.primeros_eventos.map((e, i) => (
                    <div key={i} className="border-b border-slate-100 pb-1">
                      <span className="font-bold text-slate-800">[{e.estacion}]</span>
                      <span className="text-slate-500"> {e.categoria_dtr} · {e.duracion_min}min · {e.start_time.slice(11, 19)}</span>
                      <div className="text-slate-600 truncate">{e.mensaje}</div>
                    </div>
                  ))}
                </div>
                <div className="font-medium mt-2 mb-1">Primeras líneas del PDF (texto crudo):</div>
                <pre className="bg-white border border-slate-200 rounded p-2 max-h-32 overflow-auto font-mono text-[10px] whitespace-pre-wrap">
{preview.primeras_lineas_pdf.join('\n')}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Filtros</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
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
          <div>
            <label className="block text-xs text-slate-500">Estación</label>
            <input type="text" placeholder="(todas)" value={estacionFiltro}
                   onChange={e => setEstacionFiltro(e.target.value)}
                   className="border rounded px-2 py-1 w-full" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Top N</label>
            <input type="number" min={1} max={100} value={topN}
                   onChange={e => setTopN(parseInt(e.target.value) || 15)}
                   className="border rounded px-2 py-1 w-full" />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Eventos totales</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.total_eventos}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Duración total</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.total_min} min</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Estaciones distintas</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.estaciones}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-xs text-slate-500">Imports incluidos</div>
          <div className="text-2xl font-bold text-slate-800">{resumen.total_imports}</div>
        </div>
      </div>

      {/* POR CATEGORÍA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Eventos y duración por categoría</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={cats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="categoria" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Eventos">
                {cats.map((c, i) => (
                  <Cell key={i} fill={CAT_COLORS[c.categoria] || CAT_COLORS.Otros} />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="duracion_min" name="Min">
                {cats.map((c, i) => (
                  <Cell key={i} fill={CAT_COLORS[c.categoria] || CAT_COLORS.Otros} fillOpacity={0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PARETO TOP ESTACIONES POR DURACIÓN */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Top estaciones por duración (mejora continua)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Click en una barra para ver detalle de la estación. Color por categoría dominante.
        </p>
        {topDurChart.length === 0
          ? <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Sin estaciones para mostrar con los filtros actuales. Sube un PDF con el botón <b>Vista previa</b> arriba para validar que el parser detecte las estaciones correctamente.
            </div>
          : (
            <div style={{ width: '100%', height: 30 + topDurChart.length * 28 }}>
              <ResponsiveContainer>
                <BarChart data={topDurChart} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="estacion" width={140} fontSize={11}
                         onClick={(d) => setEstacionFiltro(d.value)} cursor="pointer" />
                  <Tooltip formatter={(v, n) => n === 'duracion_min' ? `${v} min` : v} />
                  <Legend />
                  <Bar dataKey="duracion_min" name="Min" onClick={(d) => setEstacionFiltro(d.estacion)} cursor="pointer">
                    {topDurChart.map((t, i) => <Cell key={i} fill={t.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        }
      </div>

      {/* PARETO TOP ESTACIONES POR FRECUENCIA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Top estaciones por frecuencia (cantidad de paros)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Estaciones con más eventos individuales — útiles para detectar microparos.
        </p>
        <div style={{ width: '100%', height: 30 + topFreqChart.length * 28 }}>
          <ResponsiveContainer>
            <BarChart data={topFreqChart} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="estacion" width={140} fontSize={11}
                     onClick={(d) => setEstacionFiltro(d.value)} cursor="pointer" />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Eventos" onClick={(d) => setEstacionFiltro(d.estacion)} cursor="pointer">
                {topFreqChart.map((t, i) => <Cell key={i} fill={t.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DISTRIBUCIÓN HORARIA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Distribución por hora del día</h2>
        <p className="text-xs text-slate-500 mb-3">
          Patrón horario de los paros — útil para detectar horas de mayor incidencia (cambios de turno, fatiga, etc.).
        </p>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={horaria}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hora" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="Eventos" fill="#2563eb" />
              <Bar yAxisId="right" dataKey="duracion_min" name="Min" fill="#dc2626" fillOpacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TENDENCIA DIARIA */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Tendencia diaria</h2>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={tendencia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="count" name="Eventos" stroke="#2563eb" />
              <Line yAxisId="right" type="monotone" dataKey="duracion_min" name="Min" stroke="#dc2626" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* DETALLE ESTACIÓN */}
      {detalle && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Detalle estación: {detalle.estacion}</h2>
            <button onClick={() => setEstacionFiltro('')}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1 rounded">
              Quitar filtro
            </button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2">Mensaje</th>
                <th className="text-left p-2">Categoría</th>
                <th className="text-right p-2">Eventos</th>
                <th className="text-right p-2">Min</th>
              </tr>
            </thead>
            <tbody>
              {detalle.top_mensajes.map((m, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{m.mensaje}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded text-white text-xs"
                          style={{ background: CAT_COLORS[m.categoria] || CAT_COLORS.Otros }}>
                      {m.categoria}
                    </span>
                  </td>
                  <td className="p-2 text-right">{m.count}</td>
                  <td className="p-2 text-right">{m.duracion_min}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* IMPORTS LIST */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-3">Imports cargados (en el rango de filtros)</h2>
        {imports.length === 0
          ? <div className="text-sm text-slate-500">Sin imports en el rango.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Turno</th>
                    <th className="text-left p-2">Línea</th>
                    <th className="text-left p-2">Sub área</th>
                    <th className="text-left p-2">Archivo</th>
                    <th className="text-right p-2">Eventos</th>
                    <th className="text-right p-2">Min</th>
                    <th className="text-right p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map(i => (
                    <tr key={i.id} className="border-b">
                      <td className="p-2">{i.fecha}</td>
                      <td className="p-2">{i.turno}</td>
                      <td className="p-2">{i.linea_nombre}</td>
                      <td className="p-2">{i.sub_area || '—'}</td>
                      <td className="p-2 truncate max-w-[200px]" title={i.archivo_nombre}>
                        {i.archivo_nombre}
                      </td>
                      <td className="p-2 text-right">{i.eventos_total}</td>
                      <td className="p-2 text-right">{i.duracion_total_min}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => borrarImport(i.id)}
                                className="text-red-600 hover:underline">Borrar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    </div>
  )
}
