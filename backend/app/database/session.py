from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=True
)

SessionLocal = sessionmaker(
    bind=engine, #this tells every session to use this engine
    autocommit=False, #if someone tells to delete something from the database, we don't want sqlalchemy to directly save the deletion, later we'll write "db.commit" explicitly 
    autoflush=False #means don't automatically push the changes.
)

def get_db():
    """Dependency that provides a SQLAlchemy database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()