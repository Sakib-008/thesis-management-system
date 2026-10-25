from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.profile import UserBrief


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    entity: str
    entity_id: int | None
    meta: dict | None
    timestamp: datetime
    user: UserBrief | None