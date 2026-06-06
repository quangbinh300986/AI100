"""
数据库迁移与拷贝脚本
用于从源 postgres 数据库拷贝 llm_providers, llm_models, agent_routes 配置数据至当前的 AI100 数据库。
如果源表不存在或为空，则自动加载默认的 13 家大模型配置。
"""

import asyncio
import os
import sys
from pathlib import Path
import asyncpg
from dotenv import load_dotenv

# 确保 app 能被正确导入
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from app.models.base import Base
from app.models.llm_config import LLMProvider, LLMModel, AgentRoute

# 加载 .env
load_dotenv(Path(__file__).parent / ".env")

async def init_tables():
    print("Initializing LLM database tables in destination (AI100)...")
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 自愈式升级：为 agent_routes 自动添加自定义名称描述及提示词系统/用户模板列
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS agent_name VARCHAR(100);"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS agent_description VARCHAR(500);"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS system_prompt TEXT;"))
        await conn.execute(text("ALTER TABLE agent_routes ADD COLUMN IF NOT EXISTS user_prompt TEXT;"))
    print("Tables initialized successfully.")


# 默认的大模型提供商定义
DEFAULT_PROVIDERS = [
    ("deepseek",   "深度求索",       "openai", "https://api.deepseek.com/v1",                              1, "https://www.deepseek.com", "https://platform.deepseek.com/api_keys", "https://api-docs.deepseek.com", "https://api-docs.deepseek.com/zh-cn/pricing"),
    ("zhipu",      "智谱开放平台",    "openai", "https://open.bigmodel.cn/api/paas/v4/",                    2, "https://open.bigmodel.cn", "https://open.bigmodel.cn/usercenter/apikeys", "https://open.bigmodel.cn/dev/api", "https://open.bigmodel.cn/pricing"),
    ("dashscope",  "阿里云百炼",      "openai", "https://dashscope.aliyuncs.com/compatible-mode/v1/",       3, "https://bailian.console.aliyun.com", "https://bailian.console.aliyun.com", "https://help.aliyun.com/document_detail/2712194.html", "https://help.aliyun.com/document_detail/2712194.html"),
    ("doubao",     "火山引擎",       "openai", "https://ark.cn-beijing.volces.com/api/v3/",                4, "https://www.volcengine.com", "https://console.volcengine.com/ark", "https://www.volcengine.com/docs/82379", "https://www.volcengine.com/docs/82379/1174242"),
    ("silicon",    "硅基流动",       "openai", "https://api.siliconflow.cn",                               5, "https://siliconflow.cn", "https://cloud.siliconflow.cn/account/ak", "https://docs.siliconflow.cn", "https://siliconflow.cn/pricing"),
    ("moonshot",   "月之暗面",       "openai", "https://api.moonshot.cn",                                  6, "https://www.moonshot.cn", "https://platform.moonshot.cn/console/api-keys", "https://platform.moonshot.cn/docs", "https://platform.moonshot.cn/pricing"),
    ("minimax",    "MiniMax",        "openai", "https://api.minimaxi.com/v1/",                             7, "https://www.minimaxi.com", "https://platform.minimaxi.com/user-center/basic-information/api-key", "https://platform.minimaxi.com/document", "https://platform.minimaxi.com/document"),
    ("openai",     "OpenAI",         "openai", "https://api.openai.com",                                   8, "https://openai.com", "https://platform.openai.com/api-keys", "https://platform.openai.com/docs", "https://openai.com/pricing"),
    ("gemini",     "Gemini",         "gemini", "https://generativelanguage.googleapis.com",                 9, "https://deepmind.google/technologies/gemini", "https://aistudio.google.com/app/apikey", "https://ai.google.dev/gemini-api/docs", "https://ai.google.dev/gemini-api/pricing"),
    ("anthropic",  "Anthropic",      "openai", "https://api.anthropic.com/v1",                             10, "https://www.anthropic.com", "https://console.anthropic.com/settings/keys", "https://docs.anthropic.com", "https://www.anthropic.com/pricing"),
    ("ollama",     "Ollama",         "ollama", "http://localhost:11434/v1",                                11, "https://ollama.com", "", "https://github.com/ollama/ollama", ""),
    ("groq",       "Groq",           "openai", "https://api.groq.com/openai",                             12, "https://groq.com", "https://console.groq.com/keys", "https://console.groq.com/docs", "https://groq.com/pricing"),
    ("openrouter", "OpenRouter",     "openai", "https://openrouter.ai/api/v1/",                           13, "https://openrouter.ai", "https://openrouter.ai/keys", "https://openrouter.ai/docs", "https://openrouter.ai/models"),
]


async def migrate():
    # 0. 初始化目标数据库表结构
    await init_tables()

    # 1. 建立当前目标库连接 (AI100)
    db_host = os.getenv("DB_HOST", "192.168.101.206")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "AI100")
    
    dest_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    print(f"Connecting to destination database: {db_host}:{db_port}/{db_name} ...")
    
    try:
        dest_conn = await asyncpg.connect(dest_url)
    except Exception as e:
        print(f"Error connecting to destination database: {e}")
        return

    # 2. 建立源库连接 (postgres)
    # zdztb 在其配置文件中使用的是 DB_NAME=postgres
    src_db_name = "postgres"
    src_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{src_db_name}"
    print(f"Connecting to source database: {db_host}:{db_port}/{src_db_name} ...")
    
    src_conn = None
    try:
        src_conn = await asyncpg.connect(src_url)
    except Exception as e:
        print(f"Warning: Could not connect to source database postgres: {e}.")
        print("Will fallback to default initialization.")

    try:
        # ========== 1. 拷贝 llm_providers 数据 ==========
        src_providers = []
        if src_conn:
            try:
                # 检查源库是否存在 llm_providers 表
                table_exists = await src_conn.fetchval(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'llm_providers')"
                )
                if table_exists:
                    src_providers = await src_conn.fetch("SELECT * FROM llm_providers")
                    print(f"Found {len(src_providers)} providers in source database.")
            except Exception as e:
                print(f"Error reading providers from source: {e}")

        # 将数据同步到目标库
        if src_providers:
            inserted, updated = 0, 0
            for p in src_providers:
                # 检查目标库是否已经有该记录
                exists = await dest_conn.fetchrow("SELECT id FROM llm_providers WHERE id = $1", p["id"])
                if exists:
                    # 更新
                    await dest_conn.execute(
                        """UPDATE llm_providers 
                           SET name=$2, type=$3, base_url=$4, api_key=$5, enabled=$6, is_custom=$7, sort_order=$8,
                               website_official=$9, website_api_key=$10, website_docs=$11, website_models=$12, updated_at=now()
                           WHERE id=$1""",
                        p["id"], p["name"], p["type"], p["base_url"], p["api_key"], p["enabled"], p["is_custom"], p["sort_order"],
                        p.get("website_official", ""), p.get("website_api_key", ""), p.get("website_docs", ""), p.get("website_models", "")
                    )
                    updated += 1
                else:
                    # 插入
                    await dest_conn.execute(
                        """INSERT INTO llm_providers (
                            id, name, type, base_url, api_key, enabled, is_custom, sort_order, 
                            website_official, website_api_key, website_docs, website_models, created_at, updated_at
                           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())""",
                        p["id"], p["name"], p["type"], p["base_url"], p["api_key"], p["enabled"], p["is_custom"], p["sort_order"],
                        p.get("website_official", ""), p.get("website_api_key", ""), p.get("website_docs", ""), p.get("website_models", "")
                    )
                    inserted += 1
            print(f"Sync providers: inserted {inserted}, updated {updated}")
        else:
            # 插入默认配置
            inserted = 0
            for row in DEFAULT_PROVIDERS:
                exists = await dest_conn.fetchrow("SELECT id FROM llm_providers WHERE id = $1", row[0])
                if not exists:
                    await dest_conn.execute(
                        """INSERT INTO llm_providers (
                            id, name, type, base_url, api_key, enabled, is_custom, sort_order,
                            website_official, website_api_key, website_docs, website_models, created_at, updated_at
                           ) VALUES ($1, $2, $3, $4, '', false, false, $5, $6, $7, $8, $9, now(), now())""",
                        row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8]
                    )
                    inserted += 1
            print(f"Initialized default providers: inserted {inserted}")

        # ========== 2. 拷贝 llm_models 数据 ==========
        src_models = []
        if src_conn:
            try:
                table_exists = await src_conn.fetchval(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'llm_models')"
                )
                if table_exists:
                    src_models = await src_conn.fetch("SELECT * FROM llm_models")
                    print(f"Found {len(src_models)} models in source database.")
            except Exception as e:
                print(f"Error reading models from source: {e}")

        if src_models:
            inserted, updated = 0, 0
            for m in src_models:
                exists = await dest_conn.fetchrow("SELECT id FROM llm_models WHERE id = $1", m["id"])
                # 检查关联的外键是否存在，如果不存在则跳过，防止报错
                provider_exists = await dest_conn.fetchrow("SELECT id FROM llm_providers WHERE id = $1", m["provider_id"])
                if not provider_exists:
                    continue
                
                # 读取 capabilities 原始数据，asyncpg 会自动解析 jsonb
                caps = m.get("capabilities", "[]")
                import json
                if isinstance(caps, str):
                    try:
                        caps_json = json.loads(caps)
                    except:
                        caps_json = []
                else:
                    caps_json = caps

                if exists:
                    await dest_conn.execute(
                        """UPDATE llm_models 
                           SET provider_id=$2, model_id=$3, name=$4, group_name=$5, enabled=$6, capabilities=$7::jsonb
                           WHERE id=$1""",
                        m["id"], m["provider_id"], m["model_id"], m["name"], m["group_name"], m["enabled"], json.dumps(caps_json)
                    )
                    updated += 1
                else:
                    await dest_conn.execute(
                        """INSERT INTO llm_models (id, provider_id, model_id, name, group_name, enabled, capabilities, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())""",
                        m["id"], m["provider_id"], m["model_id"], m["name"], m["group_name"], m["enabled"], json.dumps(caps_json)
                    )
                    inserted += 1
            print(f"Sync models: inserted {inserted}, updated {updated}")

        # ========== 3. 拷贝 agent_routes 数据 ==========
        src_routes = []
        if src_conn:
            try:
                table_exists = await src_conn.fetchval(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'agent_routes')"
                )
                if table_exists:
                    src_routes = await src_conn.fetch("SELECT * FROM agent_routes")
                    print(f"Found {len(src_routes)} agent routes in source database.")
            except Exception as e:
                print(f"Error reading agent routes from source: {e}")

        if src_routes:
            inserted, updated = 0, 0
            for r in src_routes:
                exists = await dest_conn.fetchrow("SELECT agent_role FROM agent_routes WHERE agent_role = $1", r["agent_role"])
                
                # 兼容旧版本源数据库可能没有这 4 个字段的情形
                r_dict = dict(r)
                agent_name = r_dict.get("agent_name")
                agent_description = r_dict.get("agent_description")
                system_prompt = r_dict.get("system_prompt")
                user_prompt = r_dict.get("user_prompt")
                
                if exists:
                    await dest_conn.execute(
                        """UPDATE agent_routes 
                           SET provider_id=$2, model_id=$3, agent_name=$4, agent_description=$5, 
                               system_prompt=$6, user_prompt=$7, updated_at=now() 
                           WHERE agent_role=$1""",
                        r["agent_role"], r["provider_id"], r["model_id"],
                        agent_name, agent_description, system_prompt, user_prompt
                    )
                    updated += 1
                else:
                    await dest_conn.execute(
                        """INSERT INTO agent_routes (
                            agent_role, provider_id, model_id, agent_name, agent_description, 
                            system_prompt, user_prompt, updated_at
                           ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())""",
                        r["agent_role"], r["provider_id"], r["model_id"],
                        agent_name, agent_description, system_prompt, user_prompt
                    )
                    inserted += 1
            print(f"Sync agent routes: inserted {inserted}, updated {updated}")


        print("Database migration and copying completed successfully!")

    finally:
        await dest_conn.close()
        if src_conn:
            await src_conn.close()


if __name__ == "__main__":
    asyncio.run(migrate())
