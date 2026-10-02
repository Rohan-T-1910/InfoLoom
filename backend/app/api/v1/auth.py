from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import ValidationError
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
    """Create a new user account with unique email address and immediately return authentication token."""
    user = auth_service.register(db, user_in)
    token = auth_service.create_token_for_user(user)
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
        access_token=token.access_token,
        token_type=token.token_type,
    )

@router.post(
    "/login",
    response_model=Token,
    summary="User login with email and password (JSON or Form body)",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "schema": UserLogin.model_json_schema()
                }
            },
            "required": True,
        }
    }
)
async def login_json(
    request: Request,
    db: Annotated[Session, Depends(get_db)]
):
    """Authenticate with email and password via JSON payload or form data and receive JWT access token."""
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid JSON payload",
            )
        if not isinstance(body, dict):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Payload must be a JSON object",
            )
        try:
            validated = UserLogin(**body)
            email = validated.email
            password = validated.password
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors(),
            )
    elif "form" in content_type or "urlencoded" in content_type:
        form = await request.form()
        raw_email = form.get("email") or form.get("username")
        raw_password = form.get("password")
        try:
            validated = UserLogin(email=raw_email, password=raw_password)
            email = validated.email
            password = validated.password
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors(),
            )
    else:
        # Default attempt to parse JSON
        try:
            body = await request.json()
            validated = UserLogin(**body)
            email = validated.email
            password = validated.password
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors(),
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Email and password required",
            )

    user = auth_service.authenticate(db, email=email, password=password)
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
