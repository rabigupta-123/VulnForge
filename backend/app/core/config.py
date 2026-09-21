from typing import List, Union, Optional
from pydantic import AnyHttpUrl, BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing_extensions import Annotated


def parse_cors(v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, (list, str)):
        return v
    raise ValueError(v)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "CyberGuardian AI"
    ENVIRONMENT: str = "development"

    # Database & Cache settings
    DATABASE_URL: str = "sqlite:///./cyberguardian.db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "temporary-development-secret-key-replace-in-production!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    GEMINI_API_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    HIBP_API_KEY: Optional[str] = None

    # Strix AI Penetration Testing Agent Settings
    STRIX_ENABLED: bool = True
    STRIX_LLM: Optional[str] = "openrouter/z-ai/glm-5.3"
    STRIX_MAX_BUDGET: float = 10.0
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # SMTP Email Settings
    SMTP_HOST: Optional[str] = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: str = "no-reply@cyberguardian.ai"
    EMAILS_FROM_NAME: str = "CyberGuardian AI Verification"
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # CORS Origins
    BACKEND_CORS_ORIGINS: Annotated[
        List[str], BeforeValidator(parse_cors)
    ] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "https://localhost:3000",
        "https://localhost:8000",
        "https://cyberguardian.ai",
        "https://api.cyberguardian.ai",
    ]


settings = Settings()
