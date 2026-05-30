import { useEffect, useState } from 'react'
import api from '../api.js'

function fechaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ImportarDTRPage() {
  const [lineas, setLineas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [horasDia, setHorasDia] = useState([])
  const [horasNoche, setHorasNoche] = useState([])

  const [archivo, setArchivo] = useState(null)
  const [parseando, setParseando] = useState(false)
  const [meta, setMeta] = useState(null) // resultado del parser
  const [paros, setParos] = useState([])

  // Campos del registro a guardar
  const [fecha, setFecha] = useState(fechaLocal())
  const [turno, setTurno] = useState('dia')
  const [lineaId, setLineaId] = useState(null)
  const [hora, setHora] = useState(null)
  const [produccion, setProduccion] = useState(0)
  const [metaJph, setMetaJph] = useState(62)
  const [observaciones, setObservaciones] = useState('')
  const [msg, setMsg] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get('/lineas').then(r => setLineas(r.data))
    api.get('/categorias').then(r => setCategorias(r.data))
    api.get('/horas/dia').then(r => setHorasDia(r.data))
    api.get('/horas/noche').then(r => setHorasNoche(r.data))
  }, [])

  const horas = turno === 'dia' ? horasDia : horasNoche
  const bloqueProd = horas.filter(h => h.tipo === 'prod')

  async function procesar() {
    if (!archivo) {
      alert('Selecciona un PDF primero')
      return
    }
    setParseando(true)
    setMsg('Procesando PDF…')
    try {
      const fd = new FormData()
      fd.append('file', archivo)
      const r = await api.post('/dtr/parse', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const m = r.data.meta
      setMeta(m)
      setParos(r.data.paros || [])
      if (m.fecha) setFecha(m.fecha)
      if (m.turno_sugerido) setTurno(m.turno_sugerido)
      if (m.linea_sugerida_id) setLineaId(m.linea_sugerida_id)
      if (m.hora_sugerida) setHora(m.hora_sugerida)
      // Si el bloque tiene override, ajustar metaJph default
      if (m.minutos_bloque && m.hora_sugerida) {
        // Se setea más abajo cuando cambien horas
      }
      setMsg(`Detectados ${r.data.paros?.length || 0} paros · ${m.start_time || ''}-${m.end_time || ''} · ${m.sub_area || ''}`)
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message || 'Error'
      setMsg('')
      alert(`Error al parsear PDF:\n${det}`)
    } finally {
      setParseando(false)
    }
  }

  function setParo(idx, key, value) {
    setParos(ps => ps.map((p, i) => i === idx ? { ...p, [key]: value } : p))
  }
  function delParo(idx) {
    setParos(ps => ps.filter((_, i) => i !== idx))
  }
  function addParoVacio() {
    setParos(ps => [...ps, {
      categoria_id: categorias[0]?.id, descripcion: '', duracion_min: 1,
    }])
  }

  const totalMin = paros.reduce((s, p) => s + (Number(p.duracion_min) || 0), 0)

  async function guardar() {
    if (!lineaId) { alert('Selecciona una línea'); return }
    if (!hora) { alert('Selecciona la hora del bloque'); return }
    setGuardando(true)
    setMsg('Guardando registro…')
    try {
      await api.post('/registros', {
        fecha, turno, linea_id: Number(lineaId), hora: Number(hora),
        meta_jph: Number(metaJph),
        produccion: Number(produccion),
        observaciones,
        paros: paros.map(p => ({
          categoria_id: Number(p.categoria_id),
          duracion_min: Number(p.duracion_min),
          descripcion: p.descripcion || '',
        })),
      })
      setMsg('Registro importado ✓')
      setTimeout(() => setMsg(''), 2500)
    } catch (e) {
      const det = e?.response?.data?.detail || e?.message || 'Error'
      const status = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
      setMsg('')
      alert(`No se pudo guardar${status}:\n${typeof det === 'string' ? det : JSON.stringify(det)}`)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-slate-800 mb-1">Importar DTR (PDF Top Alarms)</h2>
        <p className="text-xs text-slate-500 mb-3">
          Sube el PDF "Top 50 Alarms" generado del DTR. El sistema detectará la fecha,
          turno, hora del bloque, línea y los paros con su duración. Revisa y ajusta
          antes de confirmar.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept="application/pdf"
                 onChange={e => setArchivo(e.target.files?.[0] || null)} />
          <button onClick={procesar} disabled={!archivo || parseando}
                  className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
            {parseando ? 'Procesando…' : 'Procesar PDF'}
          </button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </div>

      {meta && (
        <div className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                     className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Turno</label>
              <select value={turno} onChange={e => setTurno(e.target.value)}
                      className="border rounded px-2 py-1 w-full">
                <option value="dia">Día (06-18)</option>
                <option value="noche">Noche (18-06)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Línea</label>
              <select value={lineaId || ''} onChange={e => setLineaId(Number(e.target.value) || null)}
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
            <div>
              <label className="block text-xs text-slate-500">Bloque</label>
              <select value={hora || ''} onChange={e => setHora(Number(e.target.value) || null)}
                      className="border rounded px-2 py-1 w-full">
                <option value="">— Seleccionar —</option>
                {bloqueProd.map(h =>
                  <option key={h.hora} value={h.hora}>{h.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <label className="block text-xs text-slate-500">Meta JPH</label>
              <input type="number" value={metaJph} onChange={e => setMetaJph(e.target.value)}
                     className="border rounded px-2 py-1 w-full" />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Producción real</label>
              <input type="number" value={produccion} onChange={e => setProduccion(e.target.value)}
                     className="border rounded px-2 py-1 w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500">Observaciones</label>
              <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
                     className="border rounded px-2 py-1 w-full" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-700 text-sm">
                Paros detectados ({paros.length}) · Total {totalMin.toFixed(1)} min
              </h3>
              <button onClick={addParoVacio}
                      className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded">
                + Agregar paro
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-1 px-2">Categoría</th>
                    <th className="px-2">Descripción (Alarm Message)</th>
                    <th className="px-2 w-20">Min</th>
                    <th className="px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {paros.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-1 px-2">
                        <select value={p.categoria_id || ''}
                                onChange={e => setParo(i, 'categoria_id', Number(e.target.value))}
                                className="border rounded px-1 py-0.5 w-full">
                          {categorias.map(c =>
                            <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-2">
                        <input value={p.descripcion || ''}
                               onChange={e => setParo(i, 'descripcion', e.target.value)}
                               className="border rounded px-1 py-0.5 w-full" />
                      </td>
                      <td className="px-2">
                        <input type="number" step="0.01" value={p.duracion_min}
                               onChange={e => setParo(i, 'duracion_min', e.target.value)}
                               className="border rounded px-1 py-0.5 w-full" />
                      </td>
                      <td className="px-2 text-right">
                        <button onClick={() => delParo(i)}
                                className="text-red-600 hover:underline">×</button>
                      </td>
                    </tr>
                  ))}
                  {paros.length === 0 && (
                    <tr><td colSpan={4} className="py-3 text-center text-slate-400">
                      No se detectaron paros. Puedes agregar manualmente.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={guardar} disabled={guardando}
                    className="bg-emerald-600 text-white text-sm px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Confirmar e importar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
