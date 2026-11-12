from typing import Any

from fastapi import APIRouter, Depends, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.api.v1.milestones import uploaded
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.supervision import DocumentOut, DocumentType, DocumentVersionOut
from app.services import document_service as svc

router = APIRouter(prefix="/documents", tags=["documents"])

uploaders = require_roles(UserRole.student, UserRole.supervisor)
DOWNLOAD_HEADERS = {"X-Content-Type-Options": "nosniff"}


@router.get("", response_model=list[DocumentOut])
def list_documents(
    thesis_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """A student sees their own documents, a supervisor those of their students, staff see all."""
    return svc.list_documents(db, user, thesis_id)


@router.post("", response_model=DocumentOut)
def create_document(
    title: str = Form(...),
    doc_type: DocumentType = Form(default="other", alias="type"),
    note: str = Form(default=""),
    thesis_id: int | None = Form(default=None),
    file: Any = File(default=None),
    user: User = Depends(uploaders),
    db: Session = Depends(get_db),
):
    """Upload a new document (version 1). A student's document goes to their own thesis."""
    document = svc.create_document(db, user, thesis_id, title, doc_type, note, uploaded(file))
    db.commit()
    return svc.get_document(db, document.id, user)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_document(db, document_id, user)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionOut])
def list_versions(document_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_versions(db, document_id, user)


@router.post("/{document_id}/versions", response_model=DocumentOut)
def add_version(
    document_id: int,
    note: str = Form(default=""),
    file: Any = File(default=None),
    user: User = Depends(uploaders),
    db: Session = Depends(get_db),
):
    """Upload a new version of an existing document."""
    svc.add_version(db, document_id, user, note, uploaded(file))
    db.commit()
    return svc.get_document(db, document_id, user)


@router.get("/{document_id}/versions/{version_no}/download")
def download_version(
    document_id: int, version_no: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    path, name, content_type = svc.download_version(db, document_id, version_no, user)
    db.commit()  # the download is written to the audit log
    return FileResponse(path, media_type=content_type, filename=name, headers=DOWNLOAD_HEADERS)