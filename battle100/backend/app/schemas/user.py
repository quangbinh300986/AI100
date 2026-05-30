"""
用户相关Schema
定义用户CRUD操作的数据结构
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """用户基础字段"""
    name: str = Field(..., description="用户姓名")
    phone: str = Field(..., description="手机号码")
    position: Optional[str] = Field(None, description="岗位名称")
    position_type: Optional[str] = Field(None, description="岗位类型")
    third_class_bar: Optional[str] = Field(None, description="三级巴/三级部门名称")
    team_id: Optional[int] = Field(None, description="所属战队ID")
    role: str = Field(default="staff", description="用户角色")


class UserCreate(UserBase):
    """创建用户"""
    password: str = Field(..., min_length=6, description="密码")
    dingtalk_id: Optional[str] = Field(None, description="钉钉用户ID")
    crm_user_id: Optional[str] = Field(None, description="CRM系统用户ID")


class UserUpdate(BaseModel):
    """更新用户"""
    name: Optional[str] = Field(None, description="用户姓名")
    phone: Optional[str] = Field(None, description="手机号码")
    position: Optional[str] = Field(None, description="岗位名称")
    position_type: Optional[str] = Field(None, description="岗位类型")
    third_class_bar: Optional[str] = Field(None, description="三级巴/三级部门名称")
    team_id: Optional[int] = Field(None, description="所属战队ID")
    role: Optional[str] = Field(None, description="用户角色")
    is_active: Optional[bool] = Field(None, description="是否激活")
    dingtalk_id: Optional[str] = Field(None, description="钉钉用户ID")
    crm_user_id: Optional[str] = Field(None, description="CRM系统用户ID")


class UserResponse(UserBase):
    """用户响应"""
    id: int
    dingtalk_id: Optional[str] = None
    crm_user_id: Optional[str] = None
    is_active: bool = True
    team_name: Optional[str] = Field(None, description="所属战队名称")
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """用户列表响应"""
    total: int = Field(..., description="总数")
    items: list[UserResponse] = Field(..., description="用户列表")


class BatchDeleteRequest(BaseModel):
    user_ids: list[int] = Field(..., description="需要删除的用户ID列表")


class BatchAssignTeamRequest(BaseModel):
    user_ids: list[int] = Field(..., description="需要分配的用户ID列表")
    team_id: Optional[int] = Field(..., description="目标战队ID，传null则清空归属")


class BatchAssignRoleRequest(BaseModel):
    user_ids: list[int] = Field(..., description="需要分配的用户ID列表")
    role: str = Field(..., description="目标角色名称")


class BatchAssignPositionTypeRequest(BaseModel):
    user_ids: list[int] = Field(..., description="需要分配的用户ID列表")
    position_type: str = Field(..., description="目标岗位类别")
