import { useEffect, useMemo, useState } from 'react'
import api from '../api.js'

// Fecha local en formato YYYY-MM-DD (NO usar toISOString, que devuelve UTC)
function fechaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// "Fecha del turno": para turno noche, si ya pasó medianoche pero aún no son
// las 6 AM, el turno empezó AYER, así que la fecha sigue siendo la del día anterior.
function fechaTurnoActual() {
  const ahora = new Date()
  const h = ahora.getHours()
  if (h < 6) {
    // Madrugada: pertenece al turno noche que empezó ayer
    const ayer = new Date(ahora)
    ayer.setDate(ayer.getDate() - 1)
    return { fecha: fechaLocal(ayer), turno: 'noche' }
  }
  if (h >= 18) {
    // Tarde-noche: turno noche que empieza HOY
    return { fecha: fechaLocal(ahora), turno: 'noche' }
  }
  return { fecha: fechaLocal(ahora), turno: 'dia' }
}

export default function CapturaPage() {
  const inicial = fechaTurnoActual()
  const [fecha, setFecha] = useState(inicial.fecha)
  const [turno, setTurno] = useState(inicial.turno)
  const [lineas, setLineas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [horas, setHoras] = useState([])
  const [lineaSel, setLineaSel] = useState(null)
  const [registros, setRegistros] = useState([])
  const [editando, setEditando] = useState(null) // {hora, label, minutos}
  const [form, setForm] = useState({ produccion: 0, observaciones: '', paros: [] })
  const [meta, setMeta] = useState(62)
  const [savingMsg, setSavingMsg] = useState('')

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data))
    api.get('/categorias').then(r => setCategorias(r.data))
  }, [])
  useEffect(() => { api.get(`/horas/${turno}`).then(r => setHoras(r.data)) }, [turno])
  useEffect(() => { cargarRegistros() }, [fecha, turno, lineaSel])

  function cargarRegistros() {
    if (!lineaSel) { setRegistros([]); return }
    api.get('/registros', { params: { fecha, turno, linea_id: lineaSel } })
      .then(r => setRegistros(r.data))
  }

  const regMap = useMemo(() => {
    const m = {}
    registros.forEach(r => { m[r.hora] = r })
    return m
  }, [registros])

  function abrirEditor(h) {
    const existing = regMap[h.hora]
    setEditando(h)
    if (existing) {
      setMeta(existing.meta_jph)
      setForm({
        produccion: existing.produccion,
        observaciones: existing.observaciones || '',
        paros: existing.paros.map(p => ({
          categoria_id: p.categoria_id, duracion_min: p.duracion_min,
          descripcion: p.descripcion || '',
        })),
      })
    } else {
      // Bloques con override (último de 75 min) usan JPH 76; resto, 62
      const jphDefault = h.meta_override != null
        ? Math.round(h.meta_override * 60 / h.minutos)
        : 62
      setMeta(jphDefault)
      setForm({ produccion: 0, observaciones: '', paros: [] })
    }
  }

  function addParo() {
    setForm(f => ({
      ...f,
      paros: [...f.paros, { categoria_id: categorias[0]?.id, duracion_min: 1, descripcion: '' }],
    }))
  }
  function setParo(i, k, v) {
    setForm(f => ({ ...f, paros: f.paros.map((p, idx) => idx === i ? { ...p, [k]: v } : p) }))
  }
  function delParo(i) {
    setForm(f => ({ ...f, paros: f.paros.filter((_, idx) => idx !== i) }))
  }

  async function guardar() {
    if (!editando || !lineaSel) return
    setSavingMsg('Guardando…')
    try {
      await api.post('/registros', {
        fecha, turno, linea_id: lineaSel, hora: editando.hora,
        meta_jph: Number(meta), produccion: Number(form.produccion),
        observaciones: form.observaciones,
        paros: form.paros.map(p => ({
          categoria_id: Number(p.categoria_id),
          duracion_min: Number(p.duracion_min),
          descripcion: p.descripcion,
        })),
      })
      setSavingMsg('Guardado ✓')
      setTimeout(() => setSavingMsg(''), 1500)
      setEditando(null)
      cargarRegistros()
    } catch (e) {
      const detalle = e?.response?.data?.detail || e?.message || 'Error desconocido'
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
      setSavingMsg('')
      alert(`No se pudo guardar${status}:\n${detalle}`)
    }
  }

  function colorCategoria(id) {
    return categorias.find(c => c.id === id)?.hex || '#94a3b8'
  }

  const lineaActual = lineas.find(l => l.id === lineaSel)
  const totales = registros.reduce(
    (a, r) => {
      a.prod += r.produccion
      a.meta += r.meta
      a.minParos += r.paros.reduce((s, p) => s + p.duracion_min, 0)
      return a
    }, { prod: 0, meta: 0, minParos: 0 }
  )
  const efTurno = totales.meta ? (totales.prod / totales.meta * 100) : 0

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
            <option value="dia">Día (06-18)</option>
            <option value="noche">Noche (18-06)</option>
          </select>
        </div>
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-slate-500">Línea</label>
          <select value={lineaSel || ''} onChange={e => setLineaSel(Number(e.target.value) || null)}
                  className="border rounded px-2 py-1 w-full">
            <option value="">— Seleccionar línea —</option>
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
        <a className="bg-emerald-600 text-white text-sm px-3 py-2 rounded hover:bg-emerald-700"
           href={`/api/export/excel?fecha=${fecha}&turno=${turno}`} target="_blank" rel="noreferrer">
          Exportar Excel
        </a>
      </div>

      {lineaActual && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-slate-800">{lineaActual.nombre}</h2>
              <p className="text-xs text-slate-500">{lineaActual.area} · {fecha} · {turno}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <div><span className="text-slate-500">Producción:</span> <b>{totales.prod}</b></div>
              <div><span className="text-slate-500">Meta:</span> <b>{Math.round(totales.meta)}</b></div>
              <div><span className="text-slate-500">Eficiencia:</span>{' '}
                <b className={efTurno >= 95 ? 'text-emerald-600' : efTurno >= 85 ? 'text-amber-600' : 'text-red-600'}>
                  {efTurno.toFixed(1)}%
                </b></div>
              <div><span className="text-slate-500">Paros:</span> <b>{totales.minParos.toFixed(1)} min</b></div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600 border-b">
                  <th className="py-2 px-2">Hora</th>
                  <th className="px-2">Min</th>
                  <th className="px-2">Meta</th>
                  <th className="px-2">Prod.</th>
                  <th className="px-2">Ef.%</th>
                  <th className="px-2">Paros</th>
                  <th className="px-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {horas.map(h => {
                  if (h.tipo === 'break') {
                    return (
                      <tr key={`br-${h.label}`} className="bg-slate-200 text-slate-600 italic">
                        <td className="py-2 px-2 font-medium" colSpan={7}>
                          🍴 {h.label}
                        </td>
                      </tr>
                    )
                  }
                  const r = regMap[h.hora]
                  const metaH = h.meta_override != null
                    ? h.meta_override
                    : (r?.meta_jph || 62) * (h.minutos / 60)
                  const ef = r ? (r.produccion / metaH * 100) : null
                  return (
                    <tr key={h.hora} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-2 font-medium">{h.label}</td>
                      <td className="px-2">{h.minutos}</td>
                      <td className="px-2">{Math.round(metaH)}</td>
                      <td className="px-2">{r?.produccion ?? '—'}</td>
                      <td className="px-2">
                        {ef !== null ? (
                          <span className={ef >= 95 ? 'text-emerald-600' : ef >= 85 ? 'text-amber-600' : 'text-red-600'}>
                            {ef.toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-2">
                        <div className="flex flex-wrap gap-1">
                          {r?.paros.map(p => (
                            <span key={p.id} title={`${p.categoria_nombre}: ${p.descripcion}`}
                                  className="text-xs text-white px-2 py-0.5 rounded"
                                  style={{ backgroundColor: p.hex }}>
                              {p.categoria_nombre[0]} · {p.duracion_min}m
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 text-right">
                        <button onClick={() => abrirEditor(h)}
                                className="text-blue-600 hover:underline">
                          {r ? 'Editar' : 'Capturar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">{lineaActual.nombre} · {editando.label}
                <span className="text-xs text-slate-500 ml-2">({editando.minutos} min)</span>
              </h3>
              <button onClick={() => setEditando(null)} className="text-slate-500 hover:text-slate-800">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500">Meta JPH</label>
                  <input type="number" value={meta} onChange={e => setMeta(e.target.value)}
                         className="border rounded px-2 py-1 w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">Producción real</label>
                  <input type="number" value={form.produccion}
                         onChange={e => setForm(f => ({ ...f, produccion: e.target.value }))}
                         className="border rounded px-2 py-1 w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500">Observaciones</label>
                <textarea value={form.observaciones}
                          onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                          className="border rounded px-2 py-1 w-full" rows={2} />
              </div>

              <div className="border-t pt-3">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">Paros</h4>
                  <button onClick={addParo}
                          className="text-sm bg-slate-800 text-white px-3 py-1 rounded">
                    + Agregar paro
                  </button>
                </div>
                <div className="space-y-2">
                  {form.paros.length === 0 && (
                    <p className="text-xs text-slate-500">Sin paros en esta hora.</p>
                  )}
                  {form.paros.map((p, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center p-2 rounded"
                         style={{ borderLeft: `4px solid ${colorCategoria(p.categoria_id)}`, background: '#f8fafc' }}>
                      <select value={p.categoria_id} onChange={e => setParo(i, 'categoria_id', e.target.value)}
                              className="border rounded px-2 py-1 text-sm">
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <input type="number" step="0.5" min="0.1" value={p.duracion_min}
                             onChange={e => setParo(i, 'duracion_min', e.target.value)}
                             className="border rounded px-2 py-1 w-20 text-sm" />
                      <span className="text-xs text-slate-500">min</span>
                      <input type="text" placeholder="Descripción" value={p.descripcion}
                             onChange={e => setParo(i, 'descripcion', e.target.value)}
                             className="border rounded px-2 py-1 flex-1 min-w-[150px] text-sm" />
                      <button onClick={() => delParo(i)}
                              className="text-red-600 text-xs">Eliminar</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="text-xs text-slate-500 flex gap-3 flex-wrap">
                  {categorias.map(c => (
                    <span key={c.id} className="flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded" style={{ background: c.hex }}></span>
                      {c.nombre}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-emerald-600">{savingMsg}</span>
                  <button onClick={() => setEditando(null)}
                          className="px-3 py-2 text-sm text-slate-600">Cancelar</button>
                  <button onClick={guardar}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
