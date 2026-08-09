from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, String

from app.database.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column( #"Mapped[int]" is python type annotation just like "age:int"
        Integer,
        primary_key=True
    )

    name: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True
    )

    password: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="User"
    )