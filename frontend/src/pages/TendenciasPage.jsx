import { useEffect, useMemo, useState } from 'react'
import api from '../api.js'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid, Cell,
  ComposedChart,
} from 'recharts'

// Paleta consistente para líneas (12+ colores)
const LINEA_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#a855f7', '#0ea5e9',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#ef4444',
  '#8b5cf6', '#06b6d4',
]

function fechaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fechaHaceDias(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return fechaLocal(d)
}
function primerDiaDelMes() {
  const d = new Date(); d.setDate(1); return fechaLocal(d)
}

// Color para heatmap según intensidad (0 = verde claro, max = rojo)
function colorHeatmap(valor, max) {
  if (!valor || valor <= 0) return '#f1f5f9'         // slate-100
  const pct = Math.min(1, valor / (max || 1))
  if (pct < 0.25) return '#bbf7d0'                   // green-200
  if (pct < 0.50) return '#fde68a'                   // amber-200
  if (pct < 0.75) return '#fdba74'                   // orange-300
  return '#fca5a5'                                    // red-300
}

export default function TendenciasPage() {
  const [lineas, setLineas] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [fechaDesde, setFechaDesde] = useState(fechaHaceDias(6)) // últimos 7 días por defecto
  const [fechaHasta, setFechaHasta] = useState(fechaLocal())
  const [areaFiltro, setAreaFiltro] = useState('')
  const [turnoFiltro, setTurnoFiltro] = useState('')
  const [lineaFiltro, setLineaFiltro] = useState('')
  const [metrica, setMetrica] = useState('min_paros')  // min_paros | eficiencia_pct | eventos

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data))
  }, [])

  async function cargar() {
    setLoading(true); setError('')
    try {
      const params = { fecha_desde: fechaDesde, fecha_hasta: fechaHasta }
      if (areaFiltro) params.area = areaFiltro
      if (turnoFiltro) params.turno = turnoFiltro
      if (lineaFiltro) params.linea_id = lineaFiltro
      const r = await api.get('/tendencias', { params })
      setData(r.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [fechaDesde, fechaHasta, areaFiltro, turnoFiltro, lineaFiltro])

  // Pivot serie diaria → [{ fecha, "Vestiduras 1": 12.5, "Chasis 1": 4, ... }]
  const seriePivot = useMemo(() => {
    if (!data) return []
    const byFecha = {}
    for (const item of data.serie_diaria_por_linea) {
      if (!byFecha[item.fecha]) byFecha[item.fecha] = { fecha: item.fecha }
      byFecha[item.fecha][item.linea_nombre] = item[metrica] ?? 0
    }
    return Object.values(byFecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [data, metrica])

  const lineasMostradas = useMemo(() => {
    if (!data) return []
    if (lineaFiltro) {
      const l = data.lineas.find(x => String(x.id) === String(lineaFiltro))
      return l ? [l] : []
    }
    return data.lineas
  }, [data, lineaFiltro])

  // Max para heatmap
  const heatmapMax = useMemo(() => {
    if (!data) return 0
    return Math.max(0, ...data.serie_diaria_por_linea.map(s => s.min_paros))
  }, [data])

  // Sparkline data por línea
  function sparklineData(lineaId) {
    if (!data) return []
    return data.serie_diaria_por_linea
      .filter(s => s.linea_id === lineaId)
      .map(s => ({ fecha: s.fecha.slice(5), min_paros: s.min_paros }))
  }

  const r = data?.resumen
  const peor = data?.comparativo_7_vs_7?.[0]
  const mejor = data?.comparativo_7_vs_7?.[data.comparativo_7_vs_7.length - 1]

  return (
    <div className="space-y-4">
      {/* FILTROS */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs text-slate-500">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
                   className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
                   className="border rounded px-2 py-1" />
          </div>
          <div className="flex gap-1">
            <button onClick={() => { setFechaDesde(fechaHaceDias(6)); setFechaHasta(fechaLocal()) }}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">7 días</button>
            <button onClick={() => { setFechaDesde(fechaHaceDias(13)); setFechaHasta(fechaLocal()) }}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">14 días</button>
            <button onClick={() => { setFechaDesde(fechaHaceDias(29)); setFechaHasta(fechaLocal()) }}
                    className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">30 días</button>
            <button onClick={() => { setFechaDesde(primerDiaDelMes()); setFechaHasta(fechaLocal()) }}
                    className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded">Mes actual</button>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Área</label>
            <select value={areaFiltro} onChange={e => setAreaFiltro(e.target.value)}
                    className="border rounded px-2 py-1">
              <option value="">Todas</option>
              <option value="Vestiduras">Vestiduras</option>
              <option value="Chasis">Chasis</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Turno</label>
            <select value={turnoFiltro} onChange={e => setTurnoFiltro(e.target.value)}
                    className="border rounded px-2 py-1">
              <option value="">Ambos</option>
              <option value="dia">Día</option>
              <option value="noche">Noche</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">Línea (opcional)</label>
            <select value={lineaFiltro} onChange={e => setLineaFiltro(e.target.value)}
                    className="border rounded px-2 py-1">
              <option value="">Todas</option>
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
          {loading && <span className="text-xs text-slate-500">Cargando…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>

      {/* KPIs */}
      {r && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-slate-500">Min totales paros</div>
            <div className="text-2xl font-bold text-slate-800">{r.total_min_paros}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-slate-500">Promedio diario</div>
            <div className="text-2xl font-bold text-slate-800">{r.promedio_diario_min} min</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-slate-500">Eventos</div>
            <div className="text-2xl font-bold text-slate-800">{r.total_eventos}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-slate-500">Eficiencia prom.</div>
            <div className={`text-2xl font-bold ${r.eficiencia_promedio_pct >= 95 ? 'text-emerald-600' : r.eficiencia_promedio_pct >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
              {r.eficiencia_promedio_pct}%
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-slate-500">Días con datos</div>
            <div className="text-2xl font-bold text-slate-800">{r.dias_con_datos}/{r.dias_rango}</div>
          </div>
        </div>
      )}

      {/* ALERTA 7D vs 7D */}
      {data && data.comparativo_7_vs_7?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-3">🔔 Detector de empeoramiento (últimos 7 días vs 7 anteriores)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-2">Línea</th>
                  <th className="text-left p-2">Área</th>
                  <th className="text-right p-2">Min últimos 7d</th>
                  <th className="text-right p-2">Min anteriores 7d</th>
                  <th className="text-right p-2">Δ %</th>
                  <th className="text-left p-2 w-32">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.comparativo_7_vs_7.map(c => {
                  const empeorando = c.delta_pct > 15
                  const mejorando = c.delta_pct < -15
                  return (
                    <tr key={c.linea_id} className="border-b">
                      <td className="p-2 font-medium">{c.linea_nombre}</td>
                      <td className="p-2 text-slate-500">{c.area}</td>
                      <td className="p-2 text-right">{c.min_actual_7d}</td>
                      <td className="p-2 text-right">{c.min_anterior_7d}</td>
                      <td className={`p-2 text-right font-semibold ${empeorando ? 'text-red-600' : mejorando ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {c.delta_pct > 0 ? '+' : ''}{c.delta_pct}%
                      </td>
                      <td className="p-2">
                        {empeorando && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">🔴 Empeorando</span>}
                        {mejorando && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">🟢 Mejorando</span>}
                        {!empeorando && !mejorando && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Estable</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TENDENCIA MULTI-LÍNEA */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Tendencia por línea</h2>
          <div className="flex gap-1">
            {[
              ['min_paros', 'Min paros'],
              ['eficiencia_pct', 'Eficiencia %'],
              ['eventos', 'Eventos'],
            ].map(([k, lab]) => (
              <button key={k} onClick={() => setMetrica(k)}
                      className={`text-xs px-2 py-1 rounded ${metrica === k ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
                {lab}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={seriePivot}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {lineasMostradas.map((l, i) => (
                <Line key={l.id} type="monotone" dataKey={l.nombre}
                      stroke={LINEA_COLORS[i % LINEA_COLORS.length]}
                      strokeWidth={2} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* HEATMAP LÍNEA × DÍA */}
      {data && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-1">Heatmap línea × día (min de paros)</h2>
          <p className="text-xs text-slate-500 mb-3">Verde = pocos paros · Rojo = más paros. Detecta días negros puntuales.</p>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-2 py-1 text-left font-semibold border-b">Línea</th>
                  {data.fechas.map(f => (
                    <th key={f} className="px-1 py-1 text-center font-normal border-b text-slate-500">
                      {f.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.lineas.map(l => (
                  <tr key={l.id}>
                    <td className="sticky left-0 bg-white px-2 py-1 font-medium border-b whitespace-nowrap">
                      {l.nombre}
                    </td>
                    {data.fechas.map(f => {
                      const cell = data.serie_diaria_por_linea.find(
                        s => s.linea_id === l.id && s.fecha === f
                      )
                      const v = cell?.min_paros ?? 0
                      return (
                        <td key={f}
                            className="px-1 py-1 text-center border-b text-[10px]"
                            style={{ background: colorHeatmap(v, heatmapMax), minWidth: 36 }}
                            title={`${l.nombre} · ${f}: ${v} min · ${cell?.eventos || 0} eventos · ef ${cell?.eficiencia_pct || 0}%`}>
                          {v > 0 ? v : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PARETO CATEGORÍAS */}
      {data && data.pareto_categorias.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Pareto de categorías (80/20)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={data.pareto_categorias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" fontSize={11} />
                <YAxis yAxisId="left" label={{ value: 'Min', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: '% acum', angle: 90, position: 'insideRight', fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="min_paros" name="Min paros">
                  {data.pareto_categorias.map((c, i) => <Cell key={i} fill={c.hex || '#2563eb'} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="pct_acumulado" name="% acumulado" stroke="#0f172a" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SPARKLINES POR LÍNEA */}
      {data && lineasMostradas.length > 1 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Sparklines por línea (vista de águila)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {lineasMostradas.map((l, i) => {
              const datos = sparklineData(l.id)
              const total = datos.reduce((s, d) => s + d.min_paros, 0)
              return (
                <div key={l.id} className="border border-slate-200 rounded p-2">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 truncate">{l.nombre}</span>
                    <span className="text-[10px] text-slate-500">{total.toFixed(0)} min</span>
                  </div>
                  <div style={{ width: '100%', height: 60 }}>
                    <ResponsiveContainer>
                      <LineChart data={datos}>
                        <Line type="monotone" dataKey="min_paros"
                              stroke={LINEA_COLORS[i % LINEA_COLORS.length]}
                              strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* RANKING LÍNEAS */}
      {data && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Ranking de líneas (en el rango)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Línea</th>
                  <th className="text-left p-2">Área</th>
                  <th className="text-right p-2">Min paros</th>
                  <th className="text-right p-2">Prom. min/día</th>
                  <th className="text-right p-2">Eventos</th>
                  <th className="text-right p-2">Producción</th>
                  <th className="text-right p-2">Meta</th>
                  <th className="text-right p-2">Eficiencia</th>
                  <th className="text-right p-2">Días captura</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking_lineas.map((row, i) => (
                  <tr key={row.linea_id} className="border-b">
                    <td className="p-2 text-slate-500">{i + 1}</td>
                    <td className="p-2 font-medium">{row.linea_nombre}</td>
                    <td className="p-2 text-slate-500">{row.area}</td>
                    <td className="p-2 text-right">{row.min_paros}</td>
                    <td className="p-2 text-right">{row.promedio_min_dia}</td>
                    <td className="p-2 text-right">{row.eventos}</td>
                    <td className="p-2 text-right">{row.produccion}</td>
                    <td className="p-2 text-right">{row.meta}</td>
                    <td className={`p-2 text-right font-semibold ${row.eficiencia_pct >= 95 ? 'text-emerald-600' : row.eficiencia_pct >= 85 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.eficiencia_pct}%
                    </td>
                    <td className="p-2 text-right text-slate-500">{row.dias_con_captura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TOP DESCRIPCIONES */}
      {data && data.top_descripciones.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-slate-800 mb-1">Top descripciones recurrentes</h2>
          <p className="text-xs text-slate-500 mb-3">Frases que el operador escribe varias veces — candidatos para acciones de mejora continua.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-left p-2">Categoría</th>
                  <th className="text-right p-2">Eventos</th>
                  <th className="text-right p-2">Min totales</th>
                  <th className="text-left p-2">Líneas</th>
                </tr>
              </thead>
              <tbody>
                {data.top_descripciones.map((d, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{d.descripcion}</td>
                    <td className="p-2 text-slate-600">{d.categoria}</td>
                    <td className="p-2 text-right font-semibold">{d.eventos}</td>
                    <td className="p-2 text-right">{d.min_paros}</td>
                    <td className="p-2 text-xs text-slate-500">{d.lineas.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
