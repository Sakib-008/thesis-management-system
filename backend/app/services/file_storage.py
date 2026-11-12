"""Safe storage of uploaded files. Used for milestone submissions and for documents.

What makes it safe:
  - the name on disk is random, so the visitor's file name never becomes part of a path;
  - only a short list of file types is accepted, and the first bytes must really look like that type;
  - the size limit is enforced while the file is read, and empty files are refused;
  - files are never served as web pages: the API sends them as downloads, after a permission check."""
import hashlib
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import InvalidInputError, NotFoundError

OLE = b"\xd0\xcf\x11\xe0"  # the signature of the older Word and PowerPoint formats
ZIP = b"PK\x03\x04"  # the signature of zip files, and of the newer Office formats

# extension -> (content type, accepted first bytes; None means a plain text file)
ALLOWED: dict[str, tuple[str, tuple[bytes, ...] | None]] = {
    ".pdf": ("application/pdf", (b"%PDF-",)),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", (ZIP,)),
    ".pptx": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", (ZIP,)),
    ".xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", (ZIP,)),
    ".zip": ("application/zip", (ZIP,)),
    ".doc": ("application/msword", (OLE,)),
    ".ppt": ("application/vnd.ms-powerpoint", (OLE,)),
    ".png": ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    ".jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".txt": ("text/plain", None),
    ".md": ("text/markdown", None),
    ".csv": ("text/csv", None),
}
CHUNK = 1024 * 1024


@dataclass
class StoredFile:
    path: str  # relative to the upload folder, for example 2026/9f2c...e1.pdf
    original_name: str  # cleaned up, for showing to people only
    size: int
    content_type: str
    sha256: str


def upload_root() -> Path:
    root = Path(settings.upload_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def clean_name(name: str | None) -> str:
    """The visitor's file name, made safe to show and to send back as a download name."""
    base = os.path.basename((name or "").replace("\\", "/"))  # drops any folder part, such as ../../
    base = re.sub(r"[^A-Za-z0-9._ ()\-]", "_", base).strip(" .")[:150]
    return base or "file"


def allowed_list() -> str:
    return ", ".join(sorted(e.lstrip(".") for e in ALLOWED))


def store_bytes(data: bytes, filename: str | None) -> StoredFile:
    """Check the content, then save it under a random name."""
    name = clean_name(filename)
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED:
        raise InvalidInputError(f"This type of file is not allowed. Allowed types: {allowed_list()}")
    if len(data) == 0:
        raise InvalidInputError("The file is empty")
    limit = settings.max_upload_mb * 1024 * 1024
    if len(data) > limit:
        raise InvalidInputError(f"The file is larger than {settings.max_upload_mb} MB")

    content_type, signatures = ALLOWED[ext]
    if signatures is not None:
        if not any(data.startswith(s) for s in signatures):
            raise InvalidInputError(f"The content of the file does not match its type ({ext})")
    else:  # a text file: no binary content
        try:
            if b"\x00" in data:
                raise ValueError("binary")
            data.decode("utf-8")
        except ValueError:
            raise InvalidInputError(f"The file is not a valid text file ({ext})") from None

    relative = f"{datetime.now(timezone.utc).year}/{uuid.uuid4().hex}{ext}"
    target = upload_root() / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "xb") as out:
        out.write(data)
    return StoredFile(relative, name, len(data), content_type, hashlib.sha256(data).hexdigest())


def store_upload(upload: UploadFile) -> StoredFile:
    """Read an upload without ever holding more than the limit (plus one chunk) in memory."""
    limit = settings.max_upload_mb * 1024 * 1024
    chunks, total = [], 0
    while True:
        chunk = upload.file.read(CHUNK)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise InvalidInputError(f"The file is larger than {settings.max_upload_mb} MB")
        chunks.append(chunk)
    return store_bytes(b"".join(chunks), upload.filename)


def path_of(relative: str) -> Path:
    """The file on disk. Refuses anything that would point outside the upload folder."""
    root = upload_root()
    target = (root / relative).resolve()
    if root not in target.parents or not target.is_file():
        raise NotFoundError("The file is no longer available")
    return target


def delete_quietly(relative: str | None) -> None:
    """Remove a stored file, for example when saving to the database failed."""
    if not relative:
        return
    try:
        path_of(relative).unlink()
    except (NotFoundError, OSError):
        pass