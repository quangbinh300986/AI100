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
from app.api.audit_logs import router as audit_logs_router

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("battle100")


from app.services.websocket import ws_manager


async def init_db():
    """初始化数据库表并预置幸福度标准及默认角色权限"""
    async with engine.begin() as conn:
        # 使用同步反射自动在PostgreSQL中创建表
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表结构初始化成功")

    # 异步预置角色权限默认配置
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.user import RolePermission

    async with AsyncSessionLocal() as db:
        try:
            # 检查是否有权限记录
            count_res = await db.execute(select(RolePermission))
            if not count_res.scalars().first():
                logger.info("未检测到角色权限配置，开始预置默认权限数据...")
                default_perms = [
                    # admin 拥有全部 12 项权限
                    RolePermission(role="admin", menu_key="view_dashboard"),
                    RolePermission(role="admin", menu_key="drilldown_leads"),
                    RolePermission(role="admin", menu_key="view_reports"),
                    RolePermission(role="admin", menu_key="approve_report"),
                    RolePermission(role="admin", menu_key="reject_report"),
                    RolePermission(role="admin", menu_key="view_goals"),
                    RolePermission(role="admin", menu_key="manage_base_targets"),
                    RolePermission(role="admin", menu_key="import_weekly_targets"),
                    RolePermission(role="admin", menu_key="clear_targets"),
                    RolePermission(role="admin", menu_key="view_settings"),
                    RolePermission(role="admin", menu_key="manage_role_permissions"),
                    RolePermission(role="admin", menu_key="manage_user_roles"),
                    # target_officer (目标官)
                    RolePermission(role="target_officer", menu_key="view_dashboard"),
                    RolePermission(role="target_officer", menu_key="view_goals"),
                    RolePermission(role="target_officer", menu_key="manage_base_targets"),
                    RolePermission(role="target_officer", menu_key="import_weekly_targets"),
                    # digital_specialist (数字专员)
                    RolePermission(role="digital_specialist", menu_key="view_dashboard"),
                    RolePermission(role="digital_specialist", menu_key="view_goals"),
                    RolePermission(role="digital_specialist", menu_key="import_weekly_targets"),
                    # team_leader (战队长)
                    RolePermission(role="team_leader", menu_key="view_dashboard"),
                    RolePermission(role="team_leader", menu_key="view_reports"),
                    RolePermission(role="team_leader", menu_key="approve_report"),
                    RolePermission(role="team_leader", menu_key="reject_report"),
                ]
                db.add_all(default_perms)
                await db.commit()
                logger.info("默认角色权限数据预置成功")
        except Exception as ex:
            logger.error(f"预置默认角色权限数据失败: {ex}")

import asyncio
from app.services.backup import run_auto_backup

async def backup_scheduler():
    """后台数据库定期自动备份调度协程，每隔 12 小时备份一次"""
    logger.info("数据库自动备份调度器已启动")
    # 系统刚启动时，等待 30 秒再执行首次备份，防止并发数据库读写过高
    await asyncio.sleep(30)
    while True:
        try:
            logger.info("开始执行数据库周期性自动备份任务...")
            await run_auto_backup()
        except Exception as e:
            logger.error(f"数据库周期性自动备份任务出现异常: {e}")
        # 设定备份间隔为 12 小时 (12 * 3600 秒)
        await asyncio.sleep(12 * 3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """管理系统生命周期事件"""
    # 启动时
    logger.info("系统正在启动...")
    try:
        await init_db()
        # 挂载后台定期备份守护任务，使用 create_task 保证非阻塞主线程启动
        asyncio.create_task(backup_scheduler())
    except Exception as e:
        logger.error(f"数据库初始化或自动备份启动失败: {e}")
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
app.include_router(audit_logs_router, prefix=settings.API_PREFIX)


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
