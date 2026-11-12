from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    # Where uploaded files are kept, and the largest file a person may upload
    upload_dir: str = "uploads"
    max_upload_mb: int = 20
    # The sentence-embedding model used for the expertise match. Downloaded automatically on first use.
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()