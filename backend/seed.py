"""Carga inicial de catálogos: líneas y categorías de paro."""
from database import SessionLocal, engine, Base
import models

LINEAS = [
    ("Vestiduras 1", "Vestiduras", 1),
    ("Vestiduras 2", "Vestiduras", 2),
    ("Vestiduras 3", "Vestiduras", 3),
    ("Vestiduras 4", "Vestiduras", 4),
    ("Puertas", "Vestiduras", 5),
    ("IP", "Vestiduras", 6),
    ("Chasis 1", "Chasis", 10),
    ("Chasis 2", "Chasis", 11),
    ("Chasis 3", "Chasis", 12),
    ("Linea Final", "Chasis", 13),
    ("Motores", "Chasis", 14),
    ("AGVS", "Chasis", 15),
]

# Líneas que se retiran del catálogo. Al arrancar el backend se eliminan
# (y todos sus registros / DTR imports asociados).
LINEAS_A_ELIMINAR = ["Toldos"]

CATEGORIAS = [
    ("Operaciones", "red", "#dc2626"),
    ("Mantenimiento", "blue", "#2563eb"),
    ("Materiales", "orange", "#ea580c"),
    ("Programados", "gray", "#6b7280"),
]


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1) Limpiar líneas marcadas para eliminar (cascada manual)
        for nombre in LINEAS_A_ELIMINAR:
            linea = db.query(models.Linea).filter_by(nombre=nombre).first()
            if not linea:
                continue
            # Borrar registros_hora de esa línea (cascada automática borra paros)
            db.query(models.RegistroHora).filter_by(linea_id=linea.id).delete(
                synchronize_session=False)
            # Borrar DTR imports de esa línea si existen (cascada borra alarmas)
            dtr_imps = db.query(models.DTRImport).filter_by(linea_id=linea.id).all()
            for imp in dtr_imps:
                db.delete(imp)
            db.flush()
            db.delete(linea)
            db.commit()
            print(f"Seed: línea '{nombre}' eliminada con sus registros y DTR")

        # 2) Crear líneas faltantes
        for nombre, area, orden in LINEAS:
            if not db.query(models.Linea).filter_by(nombre=nombre).first():
                db.add(models.Linea(nombre=nombre, area=area, orden=orden, activa=True))
        for nombre, color, hex_ in CATEGORIAS:
            if not db.query(models.CategoriaParo).filter_by(nombre=nombre).first():
                db.add(models.CategoriaParo(nombre=nombre, color=color, hex=hex_))
        db.commit()
        print("Seed OK")
    finally:
        db.close()


if __name__ == "__main__":
    run()
