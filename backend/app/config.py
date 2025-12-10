"""Configuration management for Meeting Simulator SaaS"""
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # App
    APP_NAME: str = "Meeting Simulator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # API
    API_PREFIX: str = "/api/v1"
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # Database
    DATABASE_URL: str = "sqlite:///./meeting_simulator.db"
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_TEMPERATURE: float = 0.3
    
    # LLM Settings
    RECURSION_LIMIT: int = 100
    MAX_ITERATIONS: int = 50
    TIMEOUT_SECONDS: int = 300
    
    # Auth
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours (was 7 days - reduced for security)
    
    # Firebase (for future migration)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Validate critical settings on import
settings = get_settings()

# Fall back to OS environment variable if not set in .env
import os
if not settings.OPENAI_API_KEY:
    settings.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

if not settings.OPENAI_API_KEY:
    import warnings
    warnings.warn("OPENAI_API_KEY not set. Please configure .env file or set environment variable.")

if not settings.SECRET_KEY:
    if not settings.DEBUG:
        raise ValueError(
            "SECRET_KEY must be set in production. "
            "Add SECRET_KEY to your .env file or set as environment variable. "
            "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
        )
    else:
        import warnings
        warnings.warn("SECRET_KEY not set. Using insecure default for development only.")
        settings.SECRET_KEY = "dev-secret-key-CHANGE-IN-PRODUCTION"
