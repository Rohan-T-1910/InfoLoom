from typing import Annotated
from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account"
)
def register(
    user_in: UserCreate,
    db: Annotated[Session, Depends(get_db)]
):
    """Create a new user account with unique email address."""
    return auth_service.register(db, user_in)

@router.post(
    "/login",
    response_model=Token,
    summary="User login with email and password (JSON body)"
)
def login_json(
    credentials: UserLogin,
    db: Annotated[Session, Depends(get_db)]
):
    """Authenticate with email and password via JSON payload and receive JWT access token."""
    user = auth_service.authenticate(db, email=credentials.email, password=credentials.password)
    return auth_service.create_token_for_user(user)

@router.post(
    "/token",
    response_model=Token,
    summary="OAuth2 compatible token login for Swagger UI documentation"
)
def login_form(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)]
):
    """OAuth2 form authentication endpoint (used by Swagger Docs authorize modal)."""
    user = auth_service.authenticate(db, email=form_data.username, password=form_data.password)
    return auth_service.create_token_for_user(user)

@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile"
)
def get_me(
    current_user: Annotated[User, Depends(get_current_user)]
):
    """Fetch details of currently authenticated user."""
    return current_user
