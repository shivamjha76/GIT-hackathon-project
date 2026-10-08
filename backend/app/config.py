import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    APP_NAME: str = "SecretWatch"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./secretwatch.db")
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    DISCORD_WEBHOOK_URL: str = os.getenv("DISCORD_WEBHOOK_URL", "")
    SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")
    WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "secretwatch-dev-secret")
    POLL_INTERVAL_SECONDS: int = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))
    SALT_SECRET: str = os.getenv("SALT_SECRET", "secretwatch_salt_2026")

settings = Settings()
