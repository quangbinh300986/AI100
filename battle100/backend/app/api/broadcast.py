"""
播报接口
提供播报事件的查询和手动创建API
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.models.user import User, UserRole
from app.models.broadcast import BroadcastEvent, EventType, PushStatus
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/broadcast", tags=["播报"])


class BroadcastCreate(BaseModel):
    """创建播报请求"""
    event_type: str = Field(..., description="事件类型")
    team_id: Optional[int] = Field(None, description="关联战队ID")
    content: str = Field(..., description="播报内容")
    push_channel: str = Field(default="dingtalk", description="推送渠道")


class BroadcastResponse(BaseModel):
    """播报响应"""
    id: int
    event_type: str
    user_id: Optional[int] = None
    team_id: Optional[int] = None
    content: Optional[str] = None
    push_status: str
    push_channel: str
    event_time: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[BroadcastResponse], summary="获取播报列表")
async def list_broadcasts(
    event_type: str | None = Query(None, description="事件类型筛选"),
    limit: int = Query(50, ge=1, le=200, description="返回数量"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取最近播报事件列表"""
    query = select(BroadcastEvent).order_by(BroadcastEvent.created_at.desc())

    if event_type:
        query = query.where(BroadcastEvent.event_type == event_type)

    query = query.limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=BroadcastResponse, status_code=201, summary="创建播报")
async def create_broadcast(
    broadcast_in: BroadcastCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_roles(UserRole.ADMIN, UserRole.TARGET_OFFICER)
    ),
):
    """
    手动创建播报事件（仅管理员和目标官可用）
    自动播报由后台任务触发
    """
    event = BroadcastEvent(
        event_type=broadcast_in.event_type,
        user_id=current_user.id,
        team_id=broadcast_in.team_id,
        content=broadcast_in.content,
        push_status=PushStatus.PENDING,
        push_channel=broadcast_in.push_channel,
        event_time=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)

    # TODO: 触发实际推送（钉钉/系统通知）

    return event
