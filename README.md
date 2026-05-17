# Paros de Línea digital

Aplicación para capturar el reporte de producción **hora por hora** por línea, clasificar paros por categoría y generar un reporte gerencial filtrado.

## Reglas de negocio

- **Meta JPH**: 62 (editable por hora).
- **Operación**: Lunes a Sábado.
- **Turnos**: Día (06:00–18:00) y Noche (18:00–06:00).
- **Horas productivas**: 12 h − 45 min descanso (30 comedor + 15 snack) = **11 h 15 min**.
- **Categorías de paro** (con color):
  - 🔴 Operaciones (`#dc2626`)
  - 🔵 Mantenimiento (`#2563eb`)
  - 🟠 Materiales (`#ea580c`)
  - ⚫ Programados (`#6b7280`)
- **Reporte gerencial**: muestra solo paros > 2 min (configurable); el gerente puede excluir los que no requiera para su bitácora.

## Líneas

**Vestiduras**: Vestiduras 1, 2, 3, 4 · Puertas · IP · Toldos
**Chasis**: Chasis 1, 2, 3 · Línea Final · Motores · AGVS

## Arquitectura

```
backend/   FastAPI + SQLite (paros.db)
frontend/  React + Vite + Tailwind + Recharts
```

## Arranque local

Doble clic en `start.bat` (Windows). Se levantan:
- Backend: http://localhost:8001/docs
- Frontend: http://localhost:5173

Requiere Python 3.11+ y Node 18+.

## Variables de entorno

| Variable        | Default        | Descripción                          |
| --------------- | -------------- | ------------------------------------ |
| `GERENTE_PASS`  | `gerente123`   | Contraseña para vista gerencial.     |
| `DATABASE_URL`  | sqlite local   | Cadena Postgres opcional.            |

## Endpoints principales

- `GET  /api/lineas` · `GET /api/categorias` · `GET /api/horas/{turno}`
- `POST /api/registros` (upsert por fecha+turno+línea+hora)
- `GET  /api/registros?fecha&turno&linea_id`
- `GET  /api/reporte-gerencial?fecha&turno&password&umbral_min=2`
- `PATCH /api/paros/{id}/excluir` · `PATCH /api/paros/{id}/restaurar`
- `GET  /api/kpis?fecha&turno`
- `GET  /api/export/excel?fecha&turno`

## Próximos pasos sugeridos

- Login con roles (supervisor/gerente) en lugar de password compartido.
- Histórico semanal/mensual y comparativos por línea.
- Importación de catálogo de líneas desde Excel.
- Notificaciones cuando un paro supera X minutos.
