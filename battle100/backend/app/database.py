"""
数据库模块
提供SQLAlchemy异步引擎、异步会话工厂，以及数据库会话依赖注入
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings

# 创建异步数据库引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # 调试模式下打印SQL语句
    pool_size=20,  # 连接池大小
    max_overflow=10,  # 最大溢出连接数
    pool_pre_ping=True,  # 连接前检测是否有效
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # 提交后不过期对象，避免懒加载问题
)


async def get_db() -> AsyncSession:
    """
    数据库会话依赖注入
    用于FastAPI的Depends，自动管理会话的生命周期
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
