from datetime import datetime
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    type: str
    text: str
    href: str | None
    actor_name: str | None
    read: bool
    created_at: datetime


class UnreadOut(BaseModel):
    unread: int
