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
from app.api.llm_config import router as llm_config_router, start_cherry_sync_scheduler, stop_cherry_sync_scheduler

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("battle100")


from app.services.websocket import ws_manager


async def init_db():
    """初始化数据库表并预置幸福度标准及默认角色权限"""
    from sqlalchemy import text
    
    # 0. 外部自愈式非事务更新 detailtype 枚举值 (ALTER TYPE 不能在事务块中执行)
    try:
        async with engine.connect() as conn:
            await conn.execution_options(isolation_level="AUTOCOMMIT").execute(
                text("ALTER TYPE detailtype ADD VALUE IF NOT EXISTS 'POTENTIAL_LEAD';")
            )
            await conn.execution_options(isolation_level="AUTOCOMMIT").execute(
                text("ALTER TYPE detailtype ADD VALUE IF NOT EXISTS 'potential_lead';")
            )
    except Exception as e:
        logger.warning(f"自愈式升级 detailtype 枚举值失败或已存在: {e}")

    async with engine.begin() as conn:
        # 使用同步反射自动在PostgreSQL中创建表
        await conn.run_sync(Base.metadata.create_all)
        # 自愈式升级：自动在 report_details 和 broadcast_events 中补充 project_name 字段列
        await conn.execute(text("ALTER TABLE report_details ADD COLUMN IF NOT EXISTS project_name VARCHAR(200);"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS project_name VARCHAR(200);"))
        # 自愈式升级：自动在 broadcast_events 中补充驻点播报字段列
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS station_category VARCHAR(50);"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS station_location VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS summary TEXT;"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS attachment_urls JSON;"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS attachment_password VARCHAR(50);"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;"))
        # 自愈式升级：自动在 broadcast_events 中补充回收站软删除及备份相关的列
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;"))
        await conn.execute(text("ALTER TABLE broadcast_events ADD COLUMN IF NOT EXISTS allocations_backup JSONB DEFAULT NULL;"))
        # 自愈式升级：为 agent_routes 自动添加自定义名称描述及提示词系统/用户模板列
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS agent_description VARCHAR(500);"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS system_prompt TEXT;"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS user_prompt TEXT;"))
        # 自愈式升级：自动在 daily_reports 中补充 potential_leads_count 字段列
        await conn.execute(text("ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS potential_leads_count INT DEFAULT 0;"))
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

    # 异步预置默认大模型厂商数据
    from app.models.llm_config import LLMProvider
    async with AsyncSessionLocal() as db:
        try:
            # 检查是否有提供商记录
            from sqlalchemy import func
            count_res = await db.execute(select(func.count(LLMProvider.id)))
            if count_res.scalar() == 0:
                logger.info("未检测到大模型厂商配置，正在预置 13 家默认主流模型平台配置...")
                default_p_list = [
                    LLMProvider(id="deepseek", name="深度求索", type="openai", base_url="https://api.deepseek.com/v1", sort_order=1, website_official="https://www.deepseek.com", website_api_key="https://platform.deepseek.com/api_keys", website_docs="https://api-docs.deepseek.com", website_models="https://api-docs.deepseek.com/zh-cn/pricing"),
                    LLMProvider(id="zhipu", name="智谱开放平台", type="openai", base_url="https://open.bigmodel.cn/api/paas/v4/", sort_order=2, website_official="https://open.bigmodel.cn", website_api_key="https://open.bigmodel.cn/usercenter/apikeys", website_docs="https://open.bigmodel.cn/dev/api", website_models="https://open.bigmodel.cn/pricing"),
                    LLMProvider(id="dashscope", name="阿里云百炼", type="openai", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1/", sort_order=3, website_official="https://bailian.console.aliyun.com", website_api_key="https://bailian.console.aliyun.com", website_docs="https://help.aliyun.com/document_detail/2712194.html", website_models="https://help.aliyun.com/document_detail/2712194.html"),
                    LLMProvider(id="doubao", name="火山引擎", type="openai", base_url="https://ark.cn-beijing.volces.com/api/v3/", sort_order=4, website_official="https://www.volcengine.com", website_api_key="https://console.volcengine.com/ark", website_docs="https://www.volcengine.com/docs/82379", website_models="https://www.volcengine.com/docs/82379/1174242"),
                    LLMProvider(id="silicon", name="硅基流动", type="openai", base_url="https://api.siliconflow.cn", sort_order=5, website_official="https://siliconflow.cn", website_api_key="https://cloud.siliconflow.cn/account/ak", website_docs="https://docs.siliconflow.cn", website_models="https://siliconflow.cn/pricing"),
                    LLMProvider(id="moonshot", name="月之暗面", type="openai", base_url="https://api.moonshot.cn", sort_order=6, website_official="https://www.moonshot.cn", website_api_key="https://platform.moonshot.cn/console/api-keys", website_docs="https://platform.moonshot.cn/docs", website_models="https://platform.moonshot.cn/pricing"),
                    LLMProvider(id="minimax", name="MiniMax", type="openai", base_url="https://api.minimaxi.com/v1/", sort_order=7, website_official="https://www.minimaxi.com", website_api_key="https://platform.minimaxi.com/user-center/basic-information/api-key", website_docs="https://platform.minimaxi.com/document", website_models="https://platform.minimaxi.com/document"),
                    LLMProvider(id="openai", name="OpenAI", type="openai", base_url="https://api.openai.com", sort_order=8, website_official="https://openai.com", website_api_key="https://platform.openai.com/api-keys", website_docs="https://platform.openai.com/docs", website_models="https://openai.com/pricing"),
                    LLMProvider(id="gemini", name="Gemini", type="gemini", base_url="https://generativelanguage.googleapis.com", sort_order=9, website_official="https://deepmind.google/technologies/gemini", website_api_key="https://aistudio.google.com/app/apikey", website_docs="https://ai.google.dev/gemini-api/docs", website_models="https://ai.google.dev/gemini-api/pricing"),
                    LLMProvider(id="anthropic", name="Anthropic", type="openai", base_url="https://api.anthropic.com/v1", sort_order=10, website_official="https://www.anthropic.com", website_api_key="https://console.anthropic.com/settings/keys", website_docs="https://docs.anthropic.com", website_models="https://www.anthropic.com/pricing"),
                    LLMProvider(id="ollama", name="Ollama", type="ollama", base_url="http://localhost:11434/v1", sort_order=11, website_official="https://ollama.com", website_api_key="", website_docs="https://github.com/ollama/ollama", website_models=""),
                    LLMProvider(id="groq", name="Groq", type="openai", base_url="https://api.groq.com/openai", sort_order=12, website_official="https://groq.com", website_api_key="https://console.groq.com/keys", website_docs="https://console.groq.com/docs", website_models="https://groq.com/pricing"),
                    LLMProvider(id="openrouter", name="OpenRouter", type="openai", base_url="https://openrouter.ai/api/v1/", sort_order=13, website_official="https://openrouter.ai", website_api_key="https://openrouter.ai/keys", website_docs="https://openrouter.ai/docs", website_models="https://openrouter.ai/models"),
                ]
                db.add_all(default_p_list)
                await db.commit()
                logger.info("默认大模型厂商数据预置成功")
        except Exception as ex:
            logger.error(f"预置默认大模型厂商数据失败: {ex}")

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
        # 启动 Cherry 大模型自动拉取同步调度器
        start_cherry_sync_scheduler()
    except Exception as e:
        logger.error(f"数据库初始化、自动备份或大模型同步调度器启动失败: {e}")
    yield
    # 关闭时
    logger.info("系统正在关闭...")
    try:
        stop_cherry_sync_scheduler()
    except Exception as e:
        logger.error(f"停止大模型自动同步调度器失败: {e}")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    description="中地顾问百日奋战冲刺管理系统API后端",
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback
import os

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_dir = r"c:\APP\AI100\battle100\backend\scratch"
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "error.log")
    with open(log_path, "w", encoding="utf-8") as f:
        traceback.print_exc(file=f)
    
    logger.error(f"全局捕获到异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"服务器内部错误: {str(exc)}"}
    )


# CORS 配置，使用正则表达式允许所有 HTTP/HTTPS 域名的跨域请求与 WebSocket 连接，解决反向代理下的 403 问题
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
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
app.include_router(llm_config_router, prefix=settings.API_PREFIX)


@app.get("/")
def read_root():
    return {"message": f"欢迎使用{settings.APP_NAME}后端服务！", "version": settings.APP_VERSION}


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
