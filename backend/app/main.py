from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.api.v1 import auth, health, reference, students, supervisors, users

app = FastAPI(title="AI-Assisted University Thesis Management System", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_handler(status_code: int):
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=status_code, content={"detail": str(exc)})
    return handler


# Services raise plain exceptions; this is the one place that turns them into HTTP responses.
app.add_exception_handler(NotFoundError, _error_handler(404))
app.add_exception_handler(ConflictError, _error_handler(409))
app.add_exception_handler(InvalidInputError, _error_handler(400))

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(reference.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(supervisors.router, prefix="/api/v1")
# Alias so the frontend landing page can probe /health directly
app.include_router(health.router)