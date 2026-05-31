"""
操作审计日志 Schema
定义审计日志接口输出结构
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class AuditLogResponse(BaseModel):
    """审计日志详情响应"""
    id: int
    user_id: Optional[int] = Field(None, description="操作人ID")
    user_name: Optional[str] = Field(None, description="操作人姓名")
    action_type: str = Field(..., description="操作类型（CREATE, UPDATE, DELETE, IMPORT）")
    target_module: str = Field(..., description="操作模块")
    target_id: Optional[str] = Field(None, description="被操作对象ID")
    description: str = Field(..., description="详细描述")
    before_state: Optional[Any] = Field(None, description="更改前状态")
    after_state: Optional[Any] = Field(None, description="更改后状态")
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """审计日志列表响应"""
    total: int = Field(..., description="总数")
    items: list[AuditLogResponse] = Field(..., description="日志列表")
