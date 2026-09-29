from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import user_repository
from app.schemas.user import Token, UserCreate

class AuthService:
    def register(self, db: Session, user_in: UserCreate) -> User:
        existing_user = user_repository.get_by_email(db, user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered"
            )
        hashed_pw = hash_password(user_in.password)
        user = user_repository.create(db, user_in=user_in, hashed_password=hashed_pw)
        return user

    def authenticate(self, db: Session, email: str, password: str) -> User:
        user = user_repository.get_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    def create_token_for_user(self, user: User) -> Token:
        access_token = create_access_token(
            subject=user.id,
            extra_claims={"email": user.email, "role": user.role}
        )
        return Token(access_token=access_token, token_type="bearer")

auth_service = AuthService()
