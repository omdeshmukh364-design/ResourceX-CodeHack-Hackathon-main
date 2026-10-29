from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    COLLEGE_EMAIL_DOMAINS: str = "pcu.edu.in"
    FIREBASE_PROJECT_ID: str = "resourcex-hackathon"
    FIREBASE_CREDENTIALS_PATH: str = ""
    ENABLE_ADMIN_BOOTSTRAP: bool = False
    ADMIN_BOOTSTRAP_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ENVIRONMENT: str = "development"
    REQUIRE_EMAIL_VERIFICATION: bool = True
    TIMEZONE: str = "UTC"

    model_config = SettingsConfigDict(
        env_file=str(__import__("pathlib").Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def allowed_domains(self) -> List[str]:
        return [
            d.strip().lower()
            for d in self.COLLEGE_EMAIL_DOMAINS.split(",")
            if d.strip()
        ]

    @property
    def cors_origin_list(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
