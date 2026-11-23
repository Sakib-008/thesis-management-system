"""Shared by the API tests that talk to a running server (docker compose up).
    BASE_URL=http://localhost:8000 python -m unittest discover -s tests -v   (from the backend folder)
"""
import json
import os
import urllib.error
import urllib.request
import uuid

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000")
PASSWORD = "Demo@12345"

ADMIN = "admin.demo@university.edu"
COORDINATOR = "coordinator@university.edu"
SUPERVISOR = "a.rahman@university.edu"  # supervises Rahim Hasan's thesis in the demo data
OTHER_SUPERVISOR = "k.islam@university.edu"
STUDENT = "rahim.hasan@university.edu"
OTHER_STUDENT = "zarin.tasnim@university.edu"

_tokens: dict[str, str] = {}


def request(method: str, path: str, token: str | None = None, data=None, headers: dict | None = None):
    """Returns (status code, parsed JSON body or raw bytes). Never raises on an HTTP error."""
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(BASE_URL + path, data=body, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    return _send(req)


def upload(
    path: str, token: str | None, fields: dict, filename: str, content: bytes, content_type: str, method="POST"
):
    """A multipart/form-data request with one file field named file."""
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    parts.append(
        (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
         f"Content-Type: {content_type}\r\n\r\n").encode() + content + b"\r\n"
    )
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE_URL + path, data=b"".join(parts), method=method)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return _send(req)


def _send(req):
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, _parse(resp.read(), resp.headers.get("Content-Type", ""))
    except urllib.error.HTTPError as e:
        return e.code, _parse(e.read(), e.headers.get("Content-Type", ""))


def _parse(raw: bytes, content_type: str):
    if "json" in content_type:
        return json.loads(raw.decode("utf-8")) if raw else {}
    return raw


def login(email: str, password: str = PASSWORD) -> str:
    """A token for a demo account, kept for the rest of the test run."""
    if email not in _tokens:
        code, body = request("POST", "/api/v1/auth/login", data={"email": email, "password": password})
        if code != 200:
            raise AssertionError(f"Cannot sign in as {email} ({code}). Run the demo seed scripts first.")
        _tokens[email] = body["access_token"]
    return _tokens[email]
