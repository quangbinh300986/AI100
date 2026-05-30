"""
百日奋战管理系统后端入口
负责配置FastAPI实例、挂载路由、启动定时任务、管理Lifespan生命周期以及实现WebSocket实时推送
"""

import logging
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import settings
from app.database import engine
from app.models.base import Base
from app.models.happiness import HappinessStandard

# 导入所有 API 路由
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.reports import router as reports_router
from app.api.goals import router as goals_router
from app.api.dashboard import router as dashboard_router
from app.api.ranking import router as ranking_router
from app.api.broadcast import router as broadcast_router
from app.api.import_export import router as import_export_router

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("battle100")


from app.services.websocket import ws_manager


async def init_db():
    """初始化数据库表并预置幸福度标准"""
    async with engine.begin() as conn:
        # 使用同步反射自动在PostgreSQL中创建表
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表结构初始化成功")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理系统生命周期事件"""
    # 启动时
    logger.info("系统正在启动...")
    try:
        await init_db()
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
    yield
    # 关闭时
    logger.info("系统正在关闭...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    description="中地顾问百日奋战冲刺管理系统API后端",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(users_router, prefix=settings.API_PREFIX)
app.include_router(reports_router, prefix=settings.API_PREFIX)
app.include_router(goals_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)
app.include_router(ranking_router, prefix=settings.API_PREFIX)
app.include_router(broadcast_router, prefix=settings.API_PREFIX)
app.include_router(import_export_router, prefix=settings.API_PREFIX)
app.include_router(import_export_router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": f"欢迎使用{settings.APP_NAME}后端服务", "version": settings.APP_VERSION}


@app.websocket("/ws/screen")
async def websocket_endpoint(websocket: WebSocket):
    """大屏实时数据推送 WebSocket 端点"""
    await ws_manager.connect(websocket)
    try:
        while True:
            # 维持心跳与等待接收消息
            data = await websocket.receive_text()
            # 收到任何数据直接原样返回（Ping-Pong 心跳检测）
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket 异常断开: {e}")
        ws_manager.disconnect(websocket)
