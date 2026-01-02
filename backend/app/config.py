from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Stripe
    stripe_secret_key: str
    stripe_webhook_secret: str

    # AWS
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-east-1"
    s3_bucket_name: str

    # OpenAI
    openai_api_key: str

    # Google Cloud
    google_application_credentials: str | None = None

    # App Config
    grid_width: int = 1000
    grid_height: int = 1000
    min_block_size: int = 10
    default_price_per_pixel: float = 1.00
    max_image_size_mb: int = 5
    frontend_url: str = "http://localhost:3000"

    # Testing
    test_mode_enabled: bool = True
    test_mode_ips: list[str] = ["127.0.0.1", "::1", "localhost"]

    # Email
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    from_email: str | None = None

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
