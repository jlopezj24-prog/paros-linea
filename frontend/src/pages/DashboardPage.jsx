import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import api from '../api.js'

function hoy() { return new Date().toISOString().slice(0, 10) }

export default function DashboardPage() {
  const [fecha, setFecha] = useState(hoy())
  const [turno, setTurno] = useState('dia')
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/kpis', { params: { fecha, turno } }).then(r => setData(r.data))
  }, [fecha, turno])

  if (!data) return <p className="text-slate-500">Cargando…</p>

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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
        <Card label="Cumplimiento del turno" value={`${data.cumplimiento_pct}%`}
              color={data.cumplimiento_pct >= 95 ? 'text-emerald-600' :
                     data.cumplimiento_pct >= 85 ? 'text-amber-600' : 'text-red-600'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Eficiencia por línea</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.por_linea}>
              <XAxis dataKey="linea" angle={-25} textAnchor="end" height={70} />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="eficiencia" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Paros por categoría (min)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.por_categoria} dataKey="minutos" nameKey="categoria"
                   outerRadius={100} label>
                {data.por_categoria.map((c, i) => <Cell key={i} fill={c.hex} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-2">Detalle por línea</h3>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-600 border-b">
            <tr>
              <th className="py-2">Estado</th><th>Línea</th><th>Área</th>
              <th>Producción</th><th>Meta</th><th>Eficiencia</th><th>Min paros</th>
              <th>Capturas</th>
            </tr>
          </thead>
          <tbody>
            {data.por_linea.map(l => {
              const sinCaptura = l.horas_capturadas === 0
              const incompleta = !sinCaptura && !l.completo
              return (
                <tr key={l.linea} className={`border-b ${sinCaptura ? 'bg-red-50' : incompleta ? 'bg-amber-50' : ''}`}>
                  <td className="py-2">
                    {sinCaptura ? (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                        ⚠ Sin captura
                      </span>
                    ) : incompleta ? (
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded">
                        Faltan {l.pendientes}
                      </span>
                    ) : (
                      <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded">
                        ✓ Completa
                      </span>
                    )}
                  </td>
                  <td className="font-medium">{l.linea}</td>
                  <td className="text-slate-600">{l.area}</td>
                  <td>{l.produccion}</td>
                  <td>{l.meta}</td>
                  <td className={l.eficiencia >= 95 ? 'text-emerald-600' :
                                l.eficiencia >= 85 ? 'text-amber-600' : 'text-red-600'}>
                    {l.eficiencia}%
                  </td>
                  <td>{l.paros_min.toFixed(1)}</td>
                  <td className="text-slate-600">{l.horas_capturadas}/{l.horas_esperadas}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({ label, value, color = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
