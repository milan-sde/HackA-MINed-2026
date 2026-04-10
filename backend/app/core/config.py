from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    app_name: str = "SmartContainer Risk Engine"
    app_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = int(os.getenv("PORT", "8000"))


settings = Settings()
