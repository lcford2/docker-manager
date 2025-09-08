from fastapi import APIRouter, Form, HTTPException, status

from app.schemas.base import Token
from app.services.auth import authenticate_user, create_access_token

router = APIRouter()


@router.post("/api/auth/login", response_model=Token)
async def login(username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(user)
    return {"access_token": access_token, "token_type": "bearer"}
