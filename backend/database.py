import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DB_PATH = os.path.join(os.path.dirname(__file__), "paros.db")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")
# Esquema separado dentro de Postgres para no chocar con otros proyectos
DB_SCHEMA = os.environ.get("DB_SCHEMA", "paros")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    IS_POSTGRES = False
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    IS_POSTGRES = True

    # 1) PRIMERO registrar el listener: cada conexión nueva fija el search_path
    @event.listens_for(engine, "connect")
    def _set_search_path(dbapi_connection, _):
        with dbapi_connection.cursor() as cur:
            cur.execute(f'SET search_path TO "{DB_SCHEMA}", public')

    # 2) Crear el esquema si no existe (ya con el listener activo)
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{DB_SCHEMA}"'))

    # 3) Invalidar cualquier conexión previa del pool por si acaso
    engine.dispose()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
