from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Linea(Base):
    __tablename__ = "lineas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False)
    area = Column(String(40), nullable=False)  # Vestiduras / Chasis
    orden = Column(Integer, default=0)
    activa = Column(Boolean, default=True)


class CategoriaParo(Base):
    __tablename__ = "categorias_paro"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(40), unique=True, nullable=False)
    color = Column(String(20), nullable=False)  # tailwind key: red / blue / orange / gray
    hex = Column(String(10), nullable=False)


class RegistroHora(Base):
    """Captura de una hora productiva por línea/turno."""
    __tablename__ = "registros_hora"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True)
    turno = Column(String(10), nullable=False, index=True)  # dia | noche
    linea_id = Column(Integer, ForeignKey("lineas.id"), nullable=False)
    hora = Column(Integer, nullable=False)  # 1..12 (hora del turno)
    hora_label = Column(String(80), nullable=False)  # "06:00-07:00" o "02:30-03:45 (incl. snack ...)"
    meta_jph = Column(Integer, default=62)
    produccion = Column(Integer, default=0)
    minutos_disponibles = Column(Integer, default=60)  # 60 o 45/30 si hay break
    observaciones = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    linea = relationship("Linea")
    paros = relationship("Paro", back_populates="registro", cascade="all, delete-orphan")


class Paro(Base):
    __tablename__ = "paros"
    id = Column(Integer, primary_key=True, index=True)
    registro_id = Column(Integer, ForeignKey("registros_hora.id", ondelete="CASCADE"), nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias_paro.id"), nullable=False)
    duracion_min = Column(Float, nullable=False)
    descripcion = Column(Text, default="")
    excluido_gerencial = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    registro = relationship("RegistroHora", back_populates="paros")
    categoria = relationship("CategoriaParo")


class DTRImport(Base):
    """Carga de un PDF DTR (Top Alarms) por línea + turno + fecha.

    Se acumula en BD para construir un dashboard histórico.
    Único por (fecha, turno, linea_id) — un nuevo upload reemplaza el anterior.
    """
    __tablename__ = "dtr_imports"
    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(Date, nullable=False, index=True)
    turno = Column(String(10), nullable=False, index=True)  # dia | noche
    linea_id = Column(Integer, ForeignKey("lineas.id"), nullable=False, index=True)
    sub_area = Column(String(40), default="")
    start_time = Column(String(10), default="")
    end_time = Column(String(10), default="")
    archivo_nombre = Column(String(200), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    linea = relationship("Linea")
    alarmas = relationship("DTRAlarma", back_populates="dtr_import",
                           cascade="all, delete-orphan")


class DTRAlarma(Base):
    """Cada fila de alarma del PDF DTR clasificada por su categoría DTR.

    Categorías DTR (independientes de CategoriaParo):
      FPS   = STOPPED@FPS (Error Proofing)
      Andon = Team Member Help Call Fault
      PF    = Over travel
      MF    = Fallas de mantenimiento
      TFS   = Vacíos (starvation)
      TFIB  = Bloqueos (blocking)
      Otros = no clasificada
    """
    __tablename__ = "dtr_alarmas"
    id = Column(Integer, primary_key=True, index=True)
    import_id = Column(Integer, ForeignKey("dtr_imports.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    resource = Column(String(80), default="")
    mensaje = Column(Text, default="")
    categoria_dtr = Column(String(10), nullable=False, index=True)
    count = Column(Integer, default=0)
    duracion_min = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    dtr_import = relationship("DTRImport", back_populates="alarmas")

