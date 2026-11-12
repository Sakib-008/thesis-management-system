from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, InvalidInputError, NotFoundError
from app.models.supervision import Document, DocumentVersion
from app.models.user import User, UserRole
from app.schemas.supervision import DocumentOut, DocumentVersionOut
from app.services import file_storage
from app.services import meeting_service as access
from app.services.audit import log_audit
from app.services.milestone_service import _scope


# ---------------------------------------------------------------------- output
def _version_out(version: DocumentVersion) -> DocumentVersionOut:
    return DocumentVersionOut(
        id=version.id, version_no=version.version_no, original_name=version.original_name,
        size_bytes=version.size_bytes, content_type=version.content_type,
        uploaded_by_name=version.uploader.full_name if version.uploader else None,
        uploaded_at=version.uploaded_at, note=version.note,
    )


def _document_out(db: Session, document: Document) -> DocumentOut:
    versions = document.versions  # newest first
    return DocumentOut(
        id=document.id, thesis_id=document.thesis_id,
        student_names=[s.user.full_name for s in access.students_of_thesis(db, document.thesis_id)],
        title=document.title, type=document.type, uploaded_by_name=document.uploader.full_name,
        created_at=document.created_at, version_count=len(versions),
        latest=_version_out(versions[0]) if versions else None,
    )


# ----------------------------------------------------------------- who may do what
def _visible(db: Session, document_id: int, user: User) -> Document:
    document = db.get(Document, document_id)
    if document is None or not access.can_view_thesis(db, document.thesis_id, user):
        raise NotFoundError("Document not found")
    return document


def _can_upload(db: Session, thesis_id: int, user: User) -> bool:
    """The student of a thesis and its supervisor may add files. Staff can only read."""
    if user.role == UserRole.student:
        return access.own_thesis_id(db, user) == thesis_id
    return user.role == UserRole.supervisor and access.is_assigned_supervisor(db, thesis_id, user)


# ---------------------------------------------------------------------- reading
def list_documents(db: Session, user: User, thesis_id: int | None = None) -> list[DocumentOut]:
    stmt = _scope(select(Document), user, db, Document.thesis_id, thesis_id)
    return [_document_out(db, d) for d in db.scalars(stmt.order_by(Document.created_at.desc()))]


def get_document(db: Session, document_id: int, user: User) -> DocumentOut:
    return _document_out(db, _visible(db, document_id, user))


def list_versions(db: Session, document_id: int, user: User) -> list[DocumentVersionOut]:
    return [_version_out(v) for v in _visible(db, document_id, user).versions]


def download_version(db: Session, document_id: int, version_no: int, user: User) -> tuple[Path, str, str]:
    document = _visible(db, document_id, user)
    version = next((v for v in document.versions if v.version_no == version_no), None)
    if version is None:
        raise NotFoundError("Version not found")
    log_audit(db, user.id, "document.download", "document", document.id, {"version": version_no})
    return file_storage.path_of(version.file_path), version.original_name or "file", version.content_type


# ---------------------------------------------------------------------- writing
def _add_version(db: Session, document: Document, user: User, note: str, upload: UploadFile) -> DocumentVersion:
    stored = file_storage.store_upload(upload)
    try:
        latest = db.scalar(
            select(func.max(DocumentVersion.version_no)).where(DocumentVersion.document_id == document.id)
        ) or 0
        version = DocumentVersion(
            document_id=document.id, version_no=latest + 1, file_path=stored.path, original_name=stored.original_name,
            size_bytes=stored.size, content_type=stored.content_type, sha256=stored.sha256, uploaded_by=user.id,
            note=(note or "").strip(),
        )
        db.add(version)
        db.flush()
        db.refresh(document)  # so that document.versions now includes the new version
    except Exception:
        file_storage.delete_quietly(stored.path)
        raise
    return version


def create_document(
    db: Session, user: User, thesis_id: int | None, title: str, doc_type: str, note: str, upload: UploadFile | None
) -> Document:
    if user.role == UserRole.student:
        thesis_id = access.own_thesis_id(db, user)
        if thesis_id is None:
            raise ConflictError("Start your proposal first. Then you can upload documents")
    elif thesis_id is None or not _can_upload(db, thesis_id, user):
        raise NotFoundError("Thesis not found")
    title = (title or "").strip()
    if len(title) < 3 or len(title) > 200:
        raise InvalidInputError("Give the document a title of 3 to 200 characters")
    if upload is None or not upload.filename:
        raise InvalidInputError("Choose a file to upload")

    document = Document(thesis_id=thesis_id, type=doc_type, title=title, uploaded_by=user.id)
    db.add(document)
    db.flush()
    _add_version(db, document, user, note, upload)
    log_audit(db, user.id, "document.create", "document", document.id, {"title": title})
    return document


def add_version(db: Session, document_id: int, user: User, note: str, upload: UploadFile | None) -> Document:
    document = db.get(Document, document_id)
    if document is None or not _can_upload(db, document.thesis_id, user):
        raise NotFoundError("Document not found")
    if upload is None or not upload.filename:
        raise InvalidInputError("Choose a file to upload")
    version = _add_version(db, document, user, note, upload)
    log_audit(db, user.id, "document.version", "document", document.id, {"version": version.version_no})
    return document