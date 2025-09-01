import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.docker_types import UserCreate
from app.models.user import User

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def authenticate_user(self, username: str, password: str) -> Optional[User]:
        """Authenticate user with username and password"""
        user = self.db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def create_user(self, user_create: UserCreate) -> User:
        """Create a new user"""
        hashed_password = get_password_hash(user_create.password)
        db_user = User(
            username=user_create.username,
            email=user_create.email,
            hashed_password=hashed_password,
            role=user_create.role,
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        return self.db.query(User).filter(User.username == username).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def create_access_token_for_user(self, user: User) -> str:
        """Create access token for user"""
        return create_access_token(subject=user.username)

    def check_permission(self, user: User, action: str) -> bool:
        """Check if user has permission for specific action"""
        permissions = {
            "admin": {
                "read",
                "write",
                "start",
                "stop",
                "restart",
                "remove",
                "create",
                "logs",
                "inspect",
                "stats",
                "system",
            },
            "operator": {
                "read",
                "start",
                "stop",
                "restart",
                "logs",
                "inspect",
                "stats",
            },
            "viewer": {"read", "logs", "inspect", "stats"},
        }

        user_permissions = permissions.get(user.role, set())
        return action in user_permissions

    def create_admin_user(self):
        """Create default admin user if it doesn't exist"""
        admin_user = self.get_user_by_email(settings.ADMIN_EMAIL)
        if not admin_user:
            admin_create = UserCreate(
                username="admin",
                email=settings.ADMIN_EMAIL,
                password=settings.ADMIN_PASSWORD,
                role="admin",
            )
            admin_user = self.create_user(admin_create)
            logger.info(f"Created admin user: {admin_user.username}")
        return admin_user
