"""
目标相关Schema
定义个人目标、战队目标、周度目标等数据结构
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


# ===== 个人目标 =====

class PersonalGoalCreate(BaseModel):
    """创建个人目标"""
    goal_type: str = Field(..., description="目标类型")
    base_target: float = Field(default=0, description="保底目标值")
    challenge_target: float = Field(default=0, description="挑战目标值")
    unit: Optional[str] = Field(None, description="单位")
    period: Optional[str] = Field(None, description="目标周期")


class PersonalGoalResponse(PersonalGoalCreate):
    """个人目标响应"""
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== 战队目标 =====

class TeamGoalCreate(BaseModel):
    """创建战队目标"""
    team_id: int = Field(..., description="战队ID")
    category: str = Field(..., description="目标类别")
    base_target: float = Field(default=0, description="保底目标值")
    red_line_target: float = Field(default=0, description="红线目标值")
    gap: float = Field(default=0, description="目标缺口")
    original_plan: Optional[str] = Field(None, description="原始计划描述")


class TeamGoalResponse(TeamGoalCreate):
    """战队目标响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ===== 周度目标 =====

class WeeklyTargetCreate(BaseModel):
    """创建周度目标"""
    team_id: int = Field(..., description="战队ID")
    week_number: int = Field(..., description="周次编号")
    week_start: date = Field(..., description="周开始日期")
    week_end: date = Field(..., description="周结束日期")
    marketing_target: float = Field(default=0, description="营销目标值")
    delivery_target: float = Field(default=0, description="交付目标值")


class WeeklyTargetUpdate(BaseModel):
    """更新周度目标（填入实际值）"""
    marketing_actual: Optional[float] = Field(None, description="营销实际值")
    delivery_actual: Optional[float] = Field(None, description="交付实际值")


class WeeklyTargetResponse(BaseModel):
    """周度目标响应"""
    id: int
    team_id: int
    week_number: int
    week_start: date
    week_end: date
    marketing_target: float
    delivery_target: float
    marketing_base_target: float
    marketing_challenge_target: float
    delivery_base_target: float
    delivery_challenge_target: float
    marketing_actual: float
    delivery_actual: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
