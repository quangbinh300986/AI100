"""
操作审计服务
提供统一的写操作日志生成和实体属性字典化序列化功能
"""

import logging
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger("battle100")


def to_dict(model_instance) -> dict | None:
    """
    将 SQLAlchemy ORM 模型实例转换为标准 Python 字典
    用于将其转换为 JSON 以存储到审计日志的 before_state/after_state 中
    """
    if model_instance is None:
        return None
    
    # 如果本身是个字典或列表，直接返回
    if isinstance(model_instance, (dict, list)):
        return model_instance
        
    try:
        res = {}
        # 遍历所有表列并提取属性值
        for col in model_instance.__table__.columns:
            val = getattr(model_instance, col.name)
            
            # 日期时间序列化
            if isinstance(val, (datetime, date)):
                res[col.name] = val.isoformat()
            # 枚举值序列化
            elif hasattr(val, "value"):
                res[col.name] = val.value
            else:
                res[col.name] = val
                
        # 安全性保障：剔除密码哈希字段
        res.pop("password_hash", None)
        return res
    except Exception as ex:
        logger.error(f"实体字典转换失败: {ex}")
        return {}


async def log_action(
    db: AsyncSession,
    user: User | None,
    action_type: str,
    target_module: str,
    target_id: str | None,
    description: str,
    before_state: dict | list | None = None,
    after_state: dict | list | None = None
) -> AuditLog | None:
    """
    保存一条操作审计日志到数据库
    """
    try:
        user_id = user.id if user else None
        user_name = user.name if user else "系统自动"
        
        # 统一转成标准的 dict 确保能完美 JSON 序列化
        if isinstance(before_state, dict):
            # 将字典浅拷贝以防修改原数据，并转换特殊属性
            before_state = {k: (v.isoformat() if isinstance(v, (datetime, date)) else (v.value if hasattr(v, "value") else v)) for k, v in before_state.items()}
        if isinstance(after_state, dict):
            after_state = {k: (v.isoformat() if isinstance(v, (datetime, date)) else (v.value if hasattr(v, "value") else v)) for k, v in after_state.items()}

        target_id_str = str(target_id) if target_id is not None else None
        log = AuditLog(
            user_id=user_id,
            user_name=user_name,
            action_type=action_type,
            target_module=target_module,
            target_id=target_id_str,
            description=description,
            before_state=before_state,
            after_state=after_state
        )
        db.add(log)
        logger.info(f"审计日志就绪: {description}")
        return log
    except Exception as ex:
        # 审计日志属于辅助功能，写入失败时不应破坏主业务逻辑执行，打印报错即可
        logger.error(f"准备操作日志失败: {ex}")
        return None
