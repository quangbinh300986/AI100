"""
操作审计日志接口
提供日志列表的分页和多维度条件筛选查询
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListResponse
from app.api.deps import require_permission

router = APIRouter(prefix="/audit-logs", tags=["审计日志"])


@router.get("", response_model=AuditLogListResponse, summary="获取系统操作审计日志列表")
async def list_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=200, description="每页数量"),
    action_type: str | None = Query(None, description="操作类型（CREATE/UPDATE/DELETE/IMPORT）"),
    target_module: str | None = Query(None, description="模块筛选"),
    keyword: str | None = Query(None, description="搜索操作人姓名"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("view_settings"))
):
    """
    分页拉取所有系统操作日志（按时间倒序排列）
    只有具备“系统设置”查看权限（view_settings）的角色可以访问
    """
    conditions = []
    
    if action_type:
        conditions.append(AuditLog.action_type == action_type)
    if target_module:
        conditions.append(AuditLog.target_module == target_module)
    if keyword:
        conditions.append(AuditLog.user_name.contains(keyword))
        
    # 计算总数
    count_query = select(func.count()).select_from(AuditLog)
    for cond in conditions:
        count_query = count_query.where(cond)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 倒序查询
    query = select(AuditLog)
    for cond in conditions:
        query = query.where(cond)
    query = query.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    return AuditLogListResponse(total=total, items=items)
