"""
大模型及路由配置中心 — API 路由
提供商管理 / 模型管理 / Agent 路由 / 连通性检测 / Cherry Studio 同步
"""
import logging
import asyncio
import re
import json
import os
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy import select, update, delete, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.llm_config import LLMProvider, LLMModel, AgentRoute

logger = logging.getLogger("battle100.llm_config")
router = APIRouter(prefix="/llm", tags=["LLM 配置中心"], dependencies=[Depends(get_current_user)])


# ==================== Pydantic 模型 ====================

class ProviderCreate(BaseModel):
    """创建自定义提供商请求体"""
    id: Optional[str] = None
    name: str
    type: str = "openai"
    base_url: str = ""
    api_key: str = ""
    enabled: bool = True


class ProviderUpdate(BaseModel):
    """更新提供商配置请求体"""
    name: Optional[str] = None
    type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class ModelCreate(BaseModel):
    """添加模型请求体"""
    provider_id: str
    model_id: str
    name: str
    group_name: Optional[str] = None
    enabled: bool = True
    capabilities: Optional[List[str]] = None


class ModelUpdate(BaseModel):
    """更新模型请求体"""
    name: Optional[str] = None
    group_name: Optional[str] = None
    enabled: Optional[bool] = None
    capabilities: Optional[List[str]] = None


class AgentRouteItem(BaseModel):
    """单个 Agent 路由"""
    agent_role: str
    provider_id: str
    model_id: str
    agent_name: Optional[str] = None
    agent_description: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None


class AgentRoutesUpdate(BaseModel):
    """批量更新 Agent 路由"""
    routes: List[AgentRouteItem]


class ModelCheckRequest(BaseModel):
    """按模型探测 API Key"""
    provider_id: str
    model_id: str
    api_keys: List[str]


class CheckApiRequest(BaseModel):
    """连通性检测请求"""
    model: Optional[str] = None


# ==================== 模型能力推断 (从 Cherry Studio 移植) ====================

VISION_ALLOWED = [
    'llava', 'moondream', 'minicpm', 'gemini-1\\.5', 'gemini-2\\.0', 'gemini-2\\.5',
    'gemini-3(?:\\.\\d)?-(?:flash|pro)(?:-preview)?', 'gemini-(flash|pro|flash-lite)-latest',
    'gemini-exp', 'claude-3', 'claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4', 'vision',
    'glm-4(?:\\.\\d+)?v(?:-[\\w-]+)?', 'qwen-vl', 'qwen2-vl', 'qwen2.5-vl', 'qwen3-vl',
    'qwen3\\.[5-9](?:-[\\w-]+)?', 'qwen2.5-omni', 'qwen3-omni(?:-[\\w-]+)?', 'qvq', 'internvl2',
    'grok-vision-beta', 'grok-4(?:-[\\w-]+)?', 'pixtral', 'gpt-4(?:-[\\w-]+)', 'gpt-4.1(?:-[\\w-]+)?',
    'gpt-4o(?:-[\\w-]+)?', 'gpt-4.5(?:-[\\w-]+)', 'gpt-5(?:-[\\w-]+)?', 'chatgpt-4o(?:-[\\w-]+)?',
    'o1(?:-[\\w-]+)?', 'o3(?:-[\\w-]+)?', 'o4(?:-[\\w-]+)?', 'deepseek-vl(?:[\\w-]+)?', 'kimi-k2.5',
    'kimi-latest', 'gemma-?[3-4](?:[-.\\w]+)?', 'doubao-seed-1[.-][68](?:-[\\w-]+)?',
    'doubao-seed-2[.-]0(?:-[\\w-]+)?', 'doubao-seed-code(?:-[\\w-]+)?', 'kimi-thinking-preview',
    'gemma3(?:[-:\\w]+)?', 'kimi-vl-a3b-thinking(?:-[\\w-]+)?', 'llama-guard-4(?:-[\\w-]+)?',
    'llama-4(?:-[\\w-]+)?', 'step-1o(?:.*vision)?', 'step-1v(?:-[\\w-]+)?', 'qwen-omni(?:-[\\w-]+)?',
    'mistral-large-(2512|latest)', 'mistral-medium-(2508|latest)', 'mistral-small-(2506|latest)',
    'mimo-v2-omni(?:-[\\w-]+)?', 'glm-5v-turbo'
]
VISION_EXCLUDED = ['gpt-4-\\d+-preview', 'gpt-4-turbo-preview', 'gpt-4-32k', 'gpt-4-\\d+', 'o1-mini', 'o3-mini', 'o1-preview', 'AIDC-AI/Marco-o1']

TOOL_MODELS = [
    'gemini-1\\.5', 'gemini-2\\.0', 'gemini-2\\.5', 'gemini-3(?:\\.\\d)?-(?:flash|pro)(?:-preview)?',
    'gemini-(flash|pro|flash-lite)-latest', 'gemini-exp', 'claude-3', 'claude-haiku-4', 'claude-sonnet-4',
    'claude-opus-4', 'gpt-3\\.5-turbo(?:-1106|-0125)?', 'gpt-4', 'gpt-4(?:.1)?(?:-|-)(?:[\\w-]+)?',
    'gpt-4o(?:-[\\w-]+)?', 'gpt-4.5(?:-[\\w-]+)?', 'gpt-5(?:-[\\w-]+)?', 'chatgpt-4o(?:-[\\w-]+)?',
    'o1(?:-[\\w-]+)?', 'o3(?:-[\\w-]+)?', 'o4(?:-[\\w-]+)?', 'qwen2\\.5(?:-plus|-max|-turbo)?',
    'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3(?:-[\\w-]+)?', 'mistral-large', 'mistral-small',
    'mistral-(?:nemo|embed)(?:-[\\w-]+)?', 'ministral-(?:3b|8b)(?:-[\\w-]+)?', 'grok-2', 'grok-3',
    'grok-4', 'glm-4(?:-plus|-air(?:-x)?|-flash(?:-x)?)?', 'yi-large', 'yi-lightning',
    'moonshot-v1(?:-[\\w-]+)?', 'kimi-(?:latest|k2.5)', 'doubao-(?:lite|pro)(?:-[\\w-]+)?',
    'deepseek-chat', 'Llama-3\\.(?:1|2|3)(?:-[\\w-]+)?', 'llama-4(?:-[\\w-]+)?', 'step-1o(?:.*vision)?',
    'step-(?:1v|1-plus|2-16k)(?:-[\\w-]+)?', 'gemma-?[3-4](?:[-.\\w]+)?',
    'mimo-v[1-9](?:-omni|-x|-nano)?(?:-[\\w-]+)?'
]

REASONING_MODELS = [
    'reasoning', 'think', 'o1', 'o1-(?:mini|preview)(?:-[\\w-]+)?', 'o3(?:-[\\w-]+)?', 'o4(?:-[\\w-]+)?',
    'deepseek-reasoner', 'deepseek-r1(?:-[\\w-]+)?', 'qwq(?:-[\\w-]+)?', 'qvq(?:-[\\w-]+)?', 'kimi-k2.5',
    'kimi-latest', 'kimi-thinking-preview', 'kimi-vl-a3b-thinking(?:-[\\w-]+)?', 'moonshot-v1-auto',
    'step-1o(?:.*vision)?', 'claude-3-7-sonnet(?:-[\\w-]+)?'
]

WEB_MODELS = ['search', 'online', 'net', 'web', 'glm-4', 'moonshot', 'kimi', 'doubao', 'qwen-max']
EMBED_REGEX = re.compile(r"text-embedding|embed|bge-|nomic-|text-representation", re.I)
RERANK_REGEX = re.compile(r"rerank|roberta|bge-reranker", re.I)

def infer_capabilities(model_id: str) -> List[str]:
    """基于模型名称/ID正则推断模型拥有的能力特征"""
    if not model_id:
        return []
    
    mid = model_id.lower()
    caps = []
    
    # 1. 视觉能力校验
    ex_pattern = "|".join(VISION_EXCLUDED)
    al_pattern = "|".join(VISION_ALLOWED)
    # 正则规则匹配
    if re.search(rf"\b(?!({ex_pattern})\b)({al_pattern})\b", mid):
        caps.append("vision")
    
    # 2. 函数/工具调用能力
    tool_pattern = "|".join(TOOL_MODELS)
    if re.search(rf"\b({tool_pattern})\b", mid):
        caps.append("tool")
        
    # 3. 推理思维能力
    reasoning_pattern = "|".join(REASONING_MODELS)
    if re.search(rf"\b({reasoning_pattern})\b", mid) or "reasoner" in mid:
        caps.append("reasoning")
        
    # 4. 联网搜索能力
    web_pattern = "|".join(WEB_MODELS)
    if re.search(rf"\b({web_pattern})\b", mid):
        caps.append("web")
        
    # 5. 嵌入与重排
    if EMBED_REGEX.search(mid):
        caps.append("embedding")
    if RERANK_REGEX.search(mid):
        caps.append("rerank")
        
    return caps


# ==================== 提供商 CRUD 接口 ====================

@router.get("/providers", summary="获取全部大模型厂商配置")
async def list_providers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LLMProvider).order_by(LLMProvider.enabled.desc(), LLMProvider.sort_order.asc(), LLMProvider.created_at.asc())
    )
    providers = result.scalars().all()
    # 返回 dict 格式，方便前端匹配
    return [
        {
            "id": p.id,
            "name": p.name,
            "type": p.type,
            "base_url": p.base_url,
            "api_key": p.api_key,
            "enabled": p.enabled,
            "is_custom": p.is_custom,
            "sort_order": p.sort_order,
            "website_official": p.website_official,
            "website_api_key": p.website_api_key,
            "website_docs": p.website_docs,
            "website_models": p.website_models,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in providers
    ]


@router.post("/providers", summary="新建自定义厂商")
async def create_provider(body: ProviderCreate, db: AsyncSession = Depends(get_db)):
    import uuid
    provider_id = body.id or str(uuid.uuid4())[:8]

    # 校验ID是否已存在
    existing = await db.get(LLMProvider, provider_id)
    if existing:
        raise HTTPException(status_code=400, detail=f"厂商ID '{provider_id}' 已存在")

    # 获取最大的 sort_order
    max_res = await db.execute(select(func.max(LLMProvider.sort_order)))
    max_order = max_res.scalar() or 0

    new_p = LLMProvider(
        id=provider_id,
        name=body.name,
        type=body.type,
        base_url=body.base_url,
        api_key=body.api_key,
        enabled=body.enabled,
        is_custom=True,
        sort_order=max_order + 1
    )
    db.add(new_p)
    await db.commit()
    return {"id": provider_id, "message": "厂商创建成功"}


@router.put("/providers/{provider_id}", summary="修改大模型厂商")
async def update_provider(provider_id: str, body: ProviderUpdate, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="厂商配置不存在")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        return {"message": "无更新数据"}

    for key, val in update_data.items():
        setattr(provider, key, val)
    
    provider.updated_at = func.now()
    await db.commit()
    return {"message": "更新成功"}


@router.delete("/providers/{provider_id}", summary="删除自定义大模型厂商")
async def delete_provider(provider_id: str, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="厂商不存在")
    
    if not provider.is_custom:
        raise HTTPException(status_code=400, detail="内置大模型平台不允许删除，只可关闭禁用")

    await db.delete(provider)
    await db.commit()
    return {"message": "厂商配置已删除"}


# ==================== 大模型 API Key / 连通性测试 ====================

@router.post("/providers/{provider_id}/check", summary="API 密钥/连通性远程大模型拉取检测")
async def check_provider_api(provider_id: str, body: CheckApiRequest, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="提供商不存在")

    base_url = provider.base_url.rstrip("/")
    api_key = provider.api_key
    ptype = provider.type

    if not base_url:
        raise HTTPException(status_code=400, detail="API 服务端点地址为空")
    if not api_key and ptype != "ollama":
        raise HTTPException(status_code=400, detail="API 密钥 (Key) 为空")

    import httpx
    from pathlib import Path
    
    # 尝试加载本地硬编码模型作为回退机制
    # 获取硬编码文件绝对路径
    hardcoded_models_path = Path(__file__).parent.parent / "cherry_hardcoded_models.json"
    hardcoded_models = {}
    if hardcoded_models_path.exists():
        try:
            with open(hardcoded_models_path, "r", encoding="utf-8") as f:
                hardcoded_models = json.load(f)
        except Exception as ex:
            logger.warning(f"读取硬编码模型文件失败: {ex}")

    remote_error = None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if ptype == "ollama":
                resp = await client.get(
                    f"{base_url}/models",
                    headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
                )
            elif ptype == "gemini":
                resp = await client.get(
                    f"{base_url}/v1beta/models",
                    params={"key": api_key.split(",")[0].strip()},
                )
            else:
                # 兼容 re
                has_version = bool(re.search(r"/v\d+(?:alpha|beta)?(?:/|$)", base_url.lower()))
                if has_version or "/api" in base_url.lower():
                    url = f"{base_url.rstrip('/')}/models"
                else:
                    url = f"{base_url.rstrip('/')}/v1/models"
                
                headers = {"Authorization": f"Bearer {api_key.split(',')[0].strip()}"}
                if "volces.com" in base_url or provider_id == "doubao":
                    headers["X-Api-Key"] = api_key.split(',')[0].strip()

                resp = await client.get(url, headers=headers)

            if resp.status_code == 200:
                data = resp.json()
                models = []
                if isinstance(data, dict):
                    models = data.get("data", data.get("models", []))
                elif isinstance(data, list):
                    models = data

                model_names = []
                for m in models:
                    if isinstance(m, dict):
                        m_id = m.get("id") or m.get("name", "")
                        if m_id:
                            model_names.append(m_id)
                    elif isinstance(m, str):
                        model_names.append(m)

                if model_names:
                    return {
                        "status": "success",
                        "message": f"连接正常，成功从远程拉取到 {len(model_names)} 个可用模型",
                        "models": model_names,
                    }
                else:
                    remote_error = "远程返回的模型列表为空"
            else:
                remote_error = f"HTTP {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        remote_error = f"网络连接超时异常: {str(e)}"

    # 连通性测试失败，执行本能降级
    target_id = "doubao" if provider_id == "doubao" or "volc" in provider_id.lower() else provider_id
    if target_id in hardcoded_models:
        fallback_models = hardcoded_models[target_id]
        return {
            "status": "success",
            "message": f"远程测试未通过 ({remote_error})。已降级自动加载本地预置的 {len(fallback_models)} 个模型",
            "models": fallback_models,
        }

    return {"status": "failed", "message": f"API 连通性检测失败: {remote_error}"}


@router.post("/check-model-keys", summary="特定模型多密钥批量测试")
async def check_model_keys(body: ModelCheckRequest, db: AsyncSession = Depends(get_db)):
    provider = await db.get(LLMProvider, body.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="提供商配置不存在")

    base_url = provider.base_url.rstrip("/")
    ptype = provider.type
    
    import httpx
    
    async def check_single_key(api_key: str):
        try:
            is_embedding = "embed" in body.model_id.lower() or "embedding" in body.model_id.lower()
            async with httpx.AsyncClient(timeout=10) as client:
                if ptype == "gemini":
                    model_path = body.model_id if body.model_id.startswith("models/") else f"models/{body.model_id}"
                    if is_embedding:
                        resp = await client.post(
                            f"{base_url}/v1beta/{model_path}:embedContent",
                            params={"key": api_key.strip()},
                            json={"content": {"parts": [{"text": "hi"}]}}
                        )
                    else:
                        resp = await client.post(
                            f"{base_url}/v1beta/{model_path}:generateContent",
                            params={"key": api_key.strip()},
                            json={"contents": [{"role": "user", "parts": [{"text": "hi"}]}]}
                        )
                elif ptype == "ollama":
                    if is_embedding:
                        resp = await client.post(
                            f"{base_url}/api/embeddings",
                            json={"model": body.model_id, "prompt": "hi"}
                        )
                    else:
                        resp = await client.post(
                            f"{base_url}/api/chat",
                            json={"model": body.model_id, "messages": [{"role": "user", "content": "hi"}], "stream": False}
                        )
                else: 
                    has_version = bool(re.search(r"/v\d+(?:alpha|beta)?(?:/|$)", base_url.lower()))
                    if is_embedding:
                        if has_version or "/api" in base_url.lower():
                            url = f"{base_url.rstrip('/')}/embeddings"
                        else:
                            url = f"{base_url.rstrip('/')}/v1/embeddings"
                        
                        headers = {"Authorization": f"Bearer {api_key.strip()}"}
                        if "volces.com" in base_url or provider.id == "doubao":
                            headers["X-Api-Key"] = api_key.strip()

                        json_payload = {"model": body.model_id, "input": "hi"}
                        if "minimax" in provider.id.lower() or "minimax" in base_url.lower():
                            json_payload = {"model": body.model_id, "texts": ["hi"], "type": "db"}

                        resp = await client.post(url, headers=headers, json=json_payload)
                    else:
                        if has_version or "/api" in base_url.lower():
                            url = f"{base_url.rstrip('/')}/chat/completions"
                        else:
                            url = f"{base_url.rstrip('/')}/v1/chat/completions"
                            
                        headers = {"Authorization": f"Bearer {api_key.strip()}"}
                        if "volces.com" in base_url or provider.id == "doubao":
                            headers["X-Api-Key"] = api_key.strip()

                        resp = await client.post(
                            url,
                            headers=headers,
                            json={
                                "model": body.model_id, 
                                "messages": [{"role": "user", "content": "hi"}], 
                                "max_tokens": 5, 
                                "stream": False
                            }
                        )
                
                if resp.status_code == 200:
                    return api_key, {"success": True, "message": "OK"}
                else:
                    try:
                        err = resp.json()
                        err_msg = str(err.get('error', err.get('message', err)))
                    except:
                        err_msg = resp.text[:100]
                    return api_key, {"success": False, "message": f"HTTP {resp.status_code}: {err_msg}"}
        except Exception as e:
            return api_key, {"success": False, "message": str(e)}

    valid_keys = body.api_keys if body.api_keys else [""]
    tasks = [check_single_key(k) for k in valid_keys]
    results = await asyncio.gather(*tasks)
    
    return {k: res for k, res in results}


# ==================== 模型 CRUD 接口 ====================

@router.get("/models/{provider_id}", summary="获取特定厂商下的全部模型列表")
async def list_models(provider_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LLMModel).where(LLMModel.provider_id == provider_id).order_by(LLMModel.group_name.asc(), LLMModel.name.asc())
    )
    models = result.scalars().all()
    return [
        {
            "id": m.id,
            "provider_id": m.provider_id,
            "model_id": m.model_id,
            "name": m.name,
            "group_name": m.group_name,
            "enabled": m.enabled,
            "capabilities": m.capabilities,
            "created_at": m.created_at,
        }
        for m in models
    ]


@router.post("/models", summary="添加本地模型")
async def create_model(body: ModelCreate, db: AsyncSession = Depends(get_db)):
    model_id_full = f"{body.provider_id}:{body.model_id}"

    # 查重
    existing = await db.get(LLMModel, model_id_full)
    if existing:
        raise HTTPException(status_code=400, detail="该厂商下的此大模型已存在")

    caps = body.capabilities if body.capabilities is not None else infer_capabilities(body.model_id)

    new_m = LLMModel(
        id=model_id_full,
        provider_id=body.provider_id,
        model_id=body.model_id,
        name=body.name,
        group_name=body.group_name,
        enabled=body.enabled,
        capabilities=caps
    )
    db.add(new_m)
    await db.commit()
    return {"id": model_id_full, "message": "大模型添加成功"}


@router.put("/models/{model_id:path}", summary="更新修改已配置的模型信息")
async def update_model(model_id: str, body: ModelUpdate, db: AsyncSession = Depends(get_db)):
    model = await db.get(LLMModel, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="模型配置不存在")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        return {"message": "没有更新内容"}

    for key, val in update_data.items():
        setattr(model, key, val)
        
    await db.commit()
    return {"message": "更新配置成功"}


@router.delete("/models/{model_id:path}", summary="删除特定模型")
async def delete_model(model_id: str, db: AsyncSession = Depends(get_db)):
    model = await db.get(LLMModel, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="模型不存在")

    await db.delete(model)
    await db.commit()
    return {"message": "大模型配置已被清退删除"}


# ==================== Agent 路由接口 ====================

# 10 个核心业务 Agent 角色列表定义
AGENT_ROLES = [
    {
        "role": "parser",
        "name": "战绩播报员",
        "description": "从零散的项目数据、战报、活动数据中，识别核心业绩数据、战绩亮点、破零记录，自动生成战绩播报文本。",
        "icon": "🔍",
        "default_system_prompt": (
            "你是“百日奋战”项目管理系统中的【战绩播报员】。你的任务是分析各个战队和部门提交上来的零散文字汇报、战报和数据，从中提取核心战绩信息。"
            "你需要识别出：1. 哪个战报取得了破零（零的突破）；2. 取得了哪些核心数字（如拜访量、商机录入数、商机转化数、签约金额）；3. 战绩中的明星个人和优秀事迹。"
            "最终，你需要用激情洋溢、充满战斗力与鼓舞人心的风格，生成一段 100~200 字的战报播报文案，适合直接用于广播推送或大屏滚动。"
        ),
        "default_user_prompt": "请对以下提交上来的零散工作战报内容进行深度分析，并生成一段激情洋溢的播报文案：\n{text}"
    },
    {
        "role": "extractor",
        "name": "周报助手",
        "description": "分析并整理周报内容，对“本周实际完成”、“本周工作亮点”、“本周工作卡点/难点”、“需要支持协调”及“下周工作目标”进行智能润色与结构化整理优化。",
        "icon": "📝",
        "default_system_prompt": (
            "你是“百日奋战”系统中的【周报助手】。你的任务是帮助员工整理、优化和润色周报内容。\n"
            "系统已配置 256K 超长上下文（Context Length），能够完整接收员工所填报的海量项目数据、战报、预警信息和交付记录。你必须深度阅读并处理所有的细节，绝不允许以信息量过大为由进行粗暴的剪裁、删减或丢弃！\n"
            "员工会提供周报的“本周实际完成”、“本周工作亮点”、“本周工作卡点/难点”、“需要支持协调”以及“下周工作目标”。你需要对其进行智能润色，使语言更加结构化、条理清晰、专业，并纠正错别字。\n"
            "【核心信息保留与合并规则】：\n"
            "1. 务必完整保留原始文本中的项目名称、客户名称、协同搭档、业务动作和核心数据。可以合并同类项，但绝不能精简丢弃！\n"
            "2. 在处理项目卡点、交付难点、合同签订滞后预警和收欠款预警等零散预警与难点信息时，必须进行严密的归类合并，绝不能漏掉任何一个项目。合并必须使用以下格式，示例如下：\n"
            "   - 合并同类项目暂停或挂起风险：\n"
            "     【项目暂停风险】增城区朱村街山田村改造土地整备咨询项目（含拆旧复垦、土规修改、用地报批等4个子项目）及黄埔区九佛街道红卫村旧村改造项目、中新广州知识城五村七片项目均处于暂停或异常挂起状态，需明确项目类型更新及后续推进计划；\n"
            "   - 合并合同签订滞后预警：\n"
            "     【合同签订滞后】8个已立项超过1个月的项目（包括：碧桂园腾越总部片区前期策划、多个中地研究院技术营销及品牌宣传立项、顺德全域土地综合整治实施方案、广东省低效用地再开发试点评估与政策研究标书、信宜中山耕林标书等）仍未签订正式合同，需加快合同流程推进；\n"
            "   - 合并收欠款预警：\n"
            "     【收欠款预警】广州市黄埔区龙湖街旺村北改造土地整备咨询服务项目及顺德区永农正向优化、九佛街道建设用地统筹利用与城市更新策划方案等项目已开发票但尚未回款到账，需跟进回款进度；\n"
            "   - 合并开票滞后卡点（或交付卡点）：\n"
            "     【开票进度滞后】（或【交付卡点】）项目【东莞市历史已建加油站用地治理机制与政策研究】进度已达 90.1%（已达收付款触发节点 30.0%、50.0%、20.0%），但尚未开发票，需尽快推进发票开具；\n"
            "   - 独立特殊的卡点项目单独列出：\n"
            "     【清远龙塘项目暂停】清远市龙塘镇产业园区完善用地手续技术咨询服务项目处于暂停状态，需跟进处理。\n"
            "3. 如果分析或润色出来需要其他人或团队（不限于上级领导）支持协调的事项，请具体列出；如果没有发现需要支持的内容，该项直接返回空字符串 ''。\n"
            "4. 在分析并整理“本周实际完成（actual）”时，你必须着重依据【本周目标计划】、传入的【当前本周实际完成】中已包含的“上周实际完成内容”与“本周播报数据”来进行梳理分析。你必须严格按照用户所撰写的“上周实际完成的内容”的书写格式、句式结构、语气和行文风格，来输出本周实际完成的内容。如果有本周播报的数据，在融入时必须翻译和包装并完全统一转换成上周实际完成内容的那种行文格式，以保证整体呈现风格的绝对协调和顺畅连贯。\n\n"
            "分析优化后，必须以 JSON 格式输出，结构如下：\n"
            "{\n"
            "  \"actual\": \"润色优化后的本周实际完成（使用 1. 2. 3. 列表形式，突出战绩与数据。绝不能漏掉原输入中的项目名称与所做动作）\",\n"
            "  \"highlights\": \"润色优化后的本周工作亮点（使用 1. 2. 3. 列表形式，提炼核心亮点与突破）\",\n"
            "  \"blockers\": \"润色优化后的本周工作卡点/难点（根据【核心信息保留与合并规则】归类合并后的难点与预警列表。若无，请填写‘无’）\",\n"
            "  \"support\": \"从困难中分析或润色出的需要支持协调的事项（具体列出需要其他人或团队配合支持的内容；若无，请填写空字符串 ''。回填时系统会自动追加，无需担心覆盖原内容）\",\n"
            "  \"next_plan\": \"润色优化后的下周工作目标（使用 1. 2. 3. 列表形式，明确目标与交付节点）\"\n"
            "}"
        ),
        "default_user_prompt": (
            "请对以下周报内容进行整理与润色，并以 JSON 格式返回结果：\n"
            "【本周目标计划】：\n{target_plan}\n"
            "【当前本周实际完成（已包含上周完成的内容与本周播报数据）】：\n{actual}\n"
            "【当前本周工作亮点】：\n{highlights}\n"
            "【当前工作卡点/难点】：\n{blockers}\n"
            "【当前需要支持协调】：\n{support}\n"
            "【当前下周工作目标】：\n{next_plan}"
        )
    },
    {
        "role": "writer",
        "name": "幸福故事撰写助手",
        "description": "从员工日常记录、团队日志中提取个人突破与关怀等“幸福动作”，并据此撰写温馨、动人、充满正能量的“企业幸福故事”文案。",
        "icon": "✍️",
        "default_system_prompt": (
            "你是“百日奋战”关怀与企业文化建设中的【幸福故事撰写助手】。你的任务是首先从员工的日常分享、团队日志和打卡记录中，提取出能够体现团队温暖、人文关怀、拼搏互助或新人关怀的“幸福动作要素”（包括人物、时间、地点、幸福事件等）；"
            "随后，基于提取出的这些要素，撰写一篇 300~500 字的公司幸福故事。"
            "故事要求文笔细腻、感情真挚、接地气、能够展现团队并肩作战的战友情和公司的关怀温度。避开假大空的话，注重叙事细节，起到振奋人心、温暖人心的效果。"
        ),
        "default_user_prompt": "请分析以下这段员工打卡和日志内容，提取其中的幸福动作要素并撰写一篇充满温度的公司幸福故事：\n{text}"
    },
    {
        "role": "reviewer",
        "name": "PK对决分析裁判",
        "description": "对内部PK系统里的两个战队、个人或部门的各项指标进行深度对比、差距诊断并输出点评和催战批注。",
        "icon": "🔎",
        "default_system_prompt": (
            "你是“百日奋战”【PK对决分析裁判】。在激烈的战队PK与部门决斗中，你需要分析对决双方的各项核心战力指标（例如商机数、拜访量、签约额、周报按时提交率等数据），对两者的表现进行横向对比。"
            "你需要：1. 诊断出落后方的主要卡点和差距所在；2. 识别出领先方的核心竞争优势；3. 撰写一段带有竞争激情、略带催战和挑衅色彩、但又富有建设性的裁判点评。语气要具有强烈的战斗激情、幽默感，能够激发出团队的荣誉感与求胜欲。"
        ),
        "default_user_prompt": "针对以下 PK 对决双方的数据与最近表现，请做出裁判判定、差距分析与催战点评：\n【战队A（领先方）】: {team_a_data}\n【战队B（落后方）】: {team_b_data}"
    },
    {
        "role": "vision",
        "name": "视觉识别",
        "description": "解析图片、扫描件等非文字资料",
        "icon": "👁️",
        "default_system_prompt": "你是一个专业的视觉图像与扫描件文档识别专家。请提取分析图片或扫描文档中的核心文字及数据，并回答用户的提问。",
        "default_user_prompt": "请对该图像或文档进行识别，并提取所有可见内容："
    },
    {
        "role": "chat",
        "name": "对话助手",
        "description": "通用 AI 问答交互",
        "icon": "💬",
        "default_system_prompt": "你是一个全能的 AI 问答交互助手。请用专业、友善、清晰和符合逻辑的语言回答用户的提问。",
        "default_user_prompt": "{text}"
    },
    {
        "role": "spider",
        "name": "爬虫模型",
        "description": "网页智能结构化与内容清洗提取",
        "icon": "🕷️",
        "default_system_prompt": "你是一个网页数据提取与结构化清洗专家。请将给定的网页 HTML 文本提取为干净的结构化正文，并剔除无关广告和导航条。",
        "default_user_prompt": "请对以下 HTML 网页数据进行结构化内容提取：\n{html_content}"
    },
    {
        "role": "embedder",
        "name": "战战匹配与黄金铁三角推荐模型",
        "description": "将商机要素、战报和员工能力特征向量化，用于自动推荐最适宜攻坚的战队、最匹配的“黄金铁三角”人选，以及匹配相似案例。",
        "icon": "🌌",
        "default_system_prompt": (
            "你是“百日奋战”系统中的【战战匹配与黄金铁三角推荐模型】。你的任务是提取文本中的业务特征和人才战力特征，将其转化为高维向量表示。"
            "具体包含：1. 提取商机的业务属性、技术难点与客户背景特征；2. 提取员工的销售历史、交付大单、技术专长及战斗日志中的打法风格。"
            "该表示能够用于度量商机与人才、商机与战队之间的战力契合度，从而在向量空间中进行精确匹配，智能推荐攻坚战队、最适宜挂帅出征的“黄金铁三角（销售、交付、服务）”人选，或匹配历史最相似的制胜案例。"
        ),
        "default_user_prompt": "请提取以下文本中的核心业务与能力特征，并将其转化为适宜进行高维向量空间比对的特征表示：\n{text}"
    },
    {
        "role": "lead_scorer",
        "name": "商机战力评估师",
        "description": "对录入到的商机数据进行商业价值与PK战力评分，结合大单倾向为商机分发及PK得分系数智能定级。",
        "icon": "🎯",
        "default_system_prompt": (
            "你是“百日奋战”商机流转中心的【商机战力评估师】。百日奋战强调效率与精准，你需要评估录入的商机或客户意向数据，给出商机对当前战局的价值定级。"
            "你需要根据以下维度评估：1. 预算规模与毛利空间；2. 转化胜率与周期（是否适合在百日内实现回款）；3. 是否符合核心业务规划（如空间规划、全域整治大单）。"
            "最终给出一个 0~100 的商机战力分，并分发定级：S级（战局战略级大单）、A级（核心冲刺级大单）、B级（常规辅助单）、C级（暂无实际价值单），并为本商机设定一个PK得分系数。"
        ),
        "default_user_prompt": "请对以下录入的商机与客户沟通纪要进行深度评估，并输出战力评分与价值定级：\n{lead_info}"
    },
    {
        "role": "reports",
        "name": "战报及铁三角联动分析师",
        "description": "分析战报数据、流转记录与“销售-交付-服务”铁三角的协作链路，生成奋战周报并诊断协作联动卡点。",
        "icon": "📊",
        "default_system_prompt": (
            "你是“百日奋战”战队及三级巴整体复盘的【战报及铁三角联动分析师】。\n"
            "你的任务是根据提供的团队多维汇总数据（包括营销新签、交付新签、中标数、幸福动作、铁三角联动、CRM 产值、CRM 到账回款）以及每个成员的个人周报/日报工作流水，撰写并整理出一份精美、专业、条理清晰的【团队整体周报】。\n"
            "要求：\n"
            "1. 整体周报采用 Markdown 格式输出。内容必须切合数据，严禁虚构、夸大事实，突出团队的签约、回款以及里程碑交付成果。\n"
            "2. 语言风格要充满战斗激情、逻辑严密，并提出下阶段重点攻坚建议。\n"
            "3. 报告必须包含以下板块：\n"
            "   - **一、团队本周核心业绩看板**（用 Markdown 表格展示提供给你的所有汇总指标快照，包括产值、回款、签约等）；\n"
            "   - **二、本周工作主要战果与亮点**（结合个人周报/日报及 CRM 沟通纪要，细致描述具体项目的推进、突破、大额签约或回款情况，提及具体负责人）；\n"
            "   - **三、交付卡点与重大业务预警**（分析团队面临的暂停/延期项目，特别是‘已到节点未开票’和‘已开票未回款’的项目，并给出分析）；\n"
            "   - **四、下周重点攻坚方向与计划**（结合个人下周目标给出团队攻坚计划）；\n"
            "   - **五、需要协调与支持的事项**（明确指出当前阻碍交付或签约、回款的卡点，并点明需要上级或跨部门支持的具体事项）。\n"
            "4. 你必须在 Markdown 文本的最后，用专门的一行渲染 `【本周未填报人员】：xxx`（xxx 替换为传入的未填报人员名单）。"
        ),
        "default_user_prompt": "请为我们战队/三级巴撰写本周的整体分析周报，以下是团队的各项业绩指标和全员本周记录详情：\n\n{report_data}"
    }
]


@router.get("/agents", summary="获取所有 Agent 路由分配详情")
async def get_agent_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentRoute))
    routes = result.scalars().all()
    route_map = {r.agent_role: r for r in routes}

    res = []
    for role_def in AGENT_ROLES:
        role_id = role_def["role"]
        route = route_map.get(role_id)
        res.append({
            **role_def,
            "provider_id": route.provider_id if route else None,
            "model_id": route.model_id if route else None,
            "agent_name": route.agent_name if route and route.agent_name else None,
            "agent_description": route.agent_description if route and route.agent_description else None,
            "system_prompt": route.system_prompt if route and route.system_prompt else None,
            "user_prompt": route.user_prompt if route and route.user_prompt else None,
            "default_system_prompt": role_def.get("default_system_prompt"),
            "default_user_prompt": role_def.get("default_user_prompt"),
        })
    return res



@router.put("/agents", summary="批量保存 Agent 路由分配")
async def update_agent_routes(body: AgentRoutesUpdate, db: AsyncSession = Depends(get_db)):
    for item in body.routes:
        # 使用原生 on_conflict 或 select-then-update，在 SQLAlchemy 下 select-then-update 更加安全兼容 sqlite/pg
        route = await db.get(AgentRoute, item.agent_role)
        if route:
            route.provider_id = item.provider_id
            route.model_id = item.model_id
            route.agent_name = item.agent_name
            route.agent_description = item.agent_description
            route.system_prompt = item.system_prompt
            route.user_prompt = item.user_prompt
            route.updated_at = func.now()
        else:
            new_route = AgentRoute(
                agent_role=item.agent_role,
                provider_id=item.provider_id,
                model_id=item.model_id,
                agent_name=item.agent_name,
                agent_description=item.agent_description,
                system_prompt=item.system_prompt,
                user_prompt=item.user_prompt
            )
            db.add(new_route)
            
    await db.commit()
    return {"message": f"已成功保存并下发 {len(body.routes)} 条 Agent 路由映射配置"}


@router.get("/available-models", summary="获取已启用的模型扁平列表（路由下拉专用）")
async def get_available_models(db: AsyncSession = Depends(get_db)):
    # 查找启用厂商下的启用模型
    stmt = (
        select(LLMModel, LLMProvider.name.label("provider_name"))
        .join(LLMProvider, LLMModel.provider_id == LLMProvider.id)
        .where(LLMModel.enabled == True, LLMProvider.enabled == True)
        .order_by(LLMProvider.sort_order.asc(), LLMModel.group_name.asc(), LLMModel.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return [
        {
            "id": row.LLMModel.id,
            "provider_id": row.LLMModel.provider_id,
            "model_id": row.LLMModel.model_id,
            "name": row.LLMModel.name,
            "group_name": row.LLMModel.group_name,
            "capabilities": row.LLMModel.capabilities,
            "provider_name": row.provider_name
        }
        for row in rows
    ]


class AgentChatRequest(BaseModel):
    """特定 Agent 对话调用请求"""
    messages: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None
    text: Optional[str] = None
    response_format_json: bool = False


@router.post("/agents/{role}/chat", summary="特定 Agent 角色对话统一接口")
async def agent_chat(
    role: str,
    body: AgentChatRequest,
    db: AsyncSession = Depends(get_db)
):
    # 1. 查找内存中预设的 Agent 角色默认定义
    role_def = next((r for r in AGENT_ROLES if r["role"] == role), None)
    if not role_def:
        raise HTTPException(status_code=404, detail=f"未找到指定的 Agent 角色: {role}")

    # 2. 查询数据库中的 Agent 路由分配与自定义提示词
    route = await db.get(AgentRoute, role)

    # 3. 决定最终的 system_prompt 与 user_prompt 模板
    if role == "extractor" and route:
        is_updated = False
        if route.system_prompt and "上周实际完成内容" not in route.system_prompt:
            route.system_prompt = role_def.get("default_system_prompt")
            is_updated = True
        if route.user_prompt and "本周目标计划" not in route.user_prompt:
            route.user_prompt = role_def.get("default_user_prompt")
            is_updated = True
        
        if is_updated:
            db.add(route)
            await db.commit()
            await db.refresh(route)

    system_prompt = (route.system_prompt if route and route.system_prompt else role_def.get("default_system_prompt")) or ""
    user_prompt_tpl = (route.user_prompt if route and route.user_prompt else role_def.get("default_user_prompt")) or ""

    # 4. 获取对应的大模型驱动与模型 ID
    from app.llm.provider import get_provider_for_agent
    try:
        provider, model_id = await get_provider_for_agent(role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 5. 构建 messages 列表
    messages = []

    if body.variables is not None or body.text is not None:
        # 优先使用变量替换渲染用户提示词模板
        vars_dict = body.variables or {}
        if body.text is not None and "text" not in vars_dict:
            vars_dict["text"] = body.text

        # 正则提取模板中的所有占位符，兜底防 KeyError
        placeholders = re.findall(r"\{([a-zA-Z0-9_]+)\}", user_prompt_tpl)
        format_args = {}
        for ph in placeholders:
            format_args[ph] = vars_dict.get(ph, "")

        user_content = user_prompt_tpl.format(**format_args)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
    elif body.messages:
        # 使用直接传入的对话历史
        messages = list(body.messages)
        has_system = any(m.get("role") == "system" for m in messages)
        if not has_system and system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})
    else:
        raise HTTPException(status_code=400, detail="请求必须提供 messages, variables 或 text")

    # 6. 调用大模型驱动
    try:
        if body.response_format_json:
            result = await provider.chat_json(messages)
            return {"content": result}
        else:
            result = await provider.chat(messages)
            return {"content": result}
    except Exception as e:
        logger.error(f"Agent {role} 调用大模型失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"大模型调用失败: {str(e)}")


# ==================== Cherry Studio 自动同步服务 ====================

PROVIDER_ZH_NAMES = {
    "silicon": "硅基流动",
    "zhipu": "智谱开放平台",
    "deepseek": "深度求索",
    "lanyun": "蓝耘科技",
    "ppio": "PPIO 派欧云",
    "dashscope": "阿里云百炼",
    "moonshot": "月之暗面",
    "baichuan": "百川智能",
    "stepfun": "阶跃星辰",
    "yi": "零一万物",
    "hunyuan": "腾讯混元",
    "tencent-cloud-ti": "腾讯云 TI",
    "baidu-cloud": "百度千帆",
    "xirang": "天翼云息壤",
    "aionly": "唯一AI (AiOnly)",
    "alayanew": "Alaya NeW",
    "qiniu": "七牛云",
    "doubao": "火山引擎",
    "infini": "无界AI (Infini)",
    "modelscope": "魔搭社区 (ModelScope)",
}

PROVIDERS_TS_URL = "https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/src/renderer/src/config/providers.ts"
MODELS_TS_URL = "https://raw.githubusercontent.com/CherryHQ/cherry-studio/main/src/renderer/src/config/models/default.ts"


async def fetch_github_source(url: str) -> str:
    """从 GitHub 异步拉取 Raw 源码内容"""
    import httpx
    logger.info(f"拉取 Cherry Studio 配置文件: {url}")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": "battle100-sync/1.0"})
        resp.raise_for_status()
        return resp.text


def parse_providers_ts(source: str) -> List[Dict[str, Any]]:
    """正则解析 providers.ts 代码块"""
    start_match = re.search(r'export const SYSTEM_PROVIDERS_CONFIG.*?\s*=\s*\{', source)
    if not start_match:
        return []
    
    start_idx = start_match.end() - 1
    brace_count = 0
    end_idx = -1
    for i in range(start_idx, len(source)):
        if source[i] == '{':
            brace_count += 1
        elif source[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    
    if end_idx == -1:
        return []
    block = source[start_idx:end_idx]
    
    providers = []
    pattern = re.compile(r"(['\"]?[\w\-]+['\"]?)\s*:\s*\{")
    matches = list(pattern.finditer(block))
    
    for i, m in enumerate(matches):
        pid = m.group(1).strip("'\"")
        if pid in ("api", "websites", "models"):
            continue
        
        next_pos = matches[i+1].start() if i+1 < len(matches) else len(block)
        body = block[m.end():next_pos]
        
        cfg = {"id": pid}
        name_m = re.search(r"name:\s*['\"]([^'\"]+)['\"]", body)
        cfg["name"] = PROVIDER_ZH_NAMES.get(pid, name_m.group(1) if name_m else pid)
        
        type_m = re.search(r"type:\s*['\"]([^'\"]+)['\"]", body)
        cfg["type"] = type_m.group(1) if type_m else "openai"
        
        host_m = re.search(r"apiHost:\s*['\"]([^'\"]+)['\"]", body)
        cfg["base_url"] = host_m.group(1) if host_m else ""
        
        providers.append(cfg)
        
    return providers


def parse_models_ts(source: str) -> Dict[str, List[str]]:
    """正则解析 default.ts 代码块，并将其重构为硬编码缓存"""
    import json
    
    # 提取 qwenModel
    qwen_match = re.search(r'export const qwenModel: Model = ({.*?})', source, re.DOTALL)
    qwen_model_json = "{}"
    if qwen_match:
        q_str = qwen_match.group(1)
        q_str = re.sub(r'(\w+):', r'"\1":', q_str).replace("'", '"')
        q_str = re.sub(r',\s*([\]}])', r'\1', q_str)
        try:
            qwen_model_json = json.dumps(json.loads(q_str))
        except:
            pass

    start_match = re.search(r'export const SYSTEM_MODELS.*?\s*=\s*\{', source)
    if not start_match:
        return {}
    
    start_idx = start_match.end() - 1
    brace_count = 0
    end_idx = -1
    for i in range(start_idx, len(source)):
        if source[i] == '{':
            brace_count += 1
        elif source[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                end_idx = i + 1
                break
    
    if end_idx == -1:
        return {}
    models_str = source[start_idx:end_idx]
    
    models_str = re.sub(r'//.*', '', models_str)
    models_str = models_str.replace('qwenModel', qwen_model_json)
    models_str = re.sub(r'([\{\,]\s*)(\w+):', r'\1"\2":', models_str)
    models_str = re.sub(r"([\{\,]\s*)'([^']+)':", r'\1"\2":', models_str)
    models_str = re.sub(r"'([^']*)'", r'"\1"', models_str)
    models_str = re.sub(r',\s*([\]}])', r'\1', models_str)
    models_str = re.sub(r' as \w+', '', models_str)

    try:
        full_data = json.loads(models_str)
        models_map = {}
        for pid, m_list in full_data.items():
            if pid == "defaultModel":
                continue
            if isinstance(m_list, list):
                models_map[pid] = [m.get("id") for m in m_list if isinstance(m, dict) and m.get("id")]
        return models_map
    except Exception as e:
        logger.error(f"解析 Cherry Studio 模型 TS 失败: {e}")
        return {}


@router.post("/sync-from-cherry", summary="手动从 Cherry Studio 自动同步配置信息")
async def sync_from_cherry(db: AsyncSession = Depends(get_db)):
    """从 Cherry Studio 源码拉取同步最新的厂商配置以及硬编码大模型配置"""
    try:
        # 1. 同步提供商
        provider_src = await fetch_github_source(PROVIDERS_TS_URL)
        providers_list = parse_providers_ts(provider_src)
        
        inserted, updated = 0, 0
        if providers_list:
            for idx, p in enumerate(providers_list):
                provider = await db.get(LLMProvider, p["id"])
                if provider:
                    provider.name = p["name"]
                    provider.type = p["type"]
                    provider.base_url = p["base_url"]
                    provider.sort_order = idx + 1
                    provider.updated_at = func.now()
                    updated += 1
                else:
                    new_p = LLMProvider(
                        id=p["id"],
                        name=p["name"],
                        type=p["type"],
                        base_url=p["base_url"],
                        enabled=False,
                        is_custom=False,
                        sort_order=idx + 1
                    )
                    db.add(new_p)
                    inserted += 1
            await db.commit()
            
        # 2. 同步模型列表到本地 json 缓存
        models_src = await fetch_github_source(MODELS_TS_URL)
        models_map = parse_models_ts(models_src)
        
        if models_map:
            json_path = Path(__file__).parent.parent / "cherry_hardcoded_models.json"
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(models_map, f, ensure_ascii=False, indent=2)
            logger.info(f"Cherry Studio 预设大模型已在本地更新缓存: {json_path.name}")
            
        return {
            "status": "success",
            "message": "同步成功",
            "inserted": inserted,
            "updated": updated,
            "models_providers_count": len(models_map)
        }
    except Exception as e:
        logger.error("从 Cherry Studio 同步配置发生异常: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"同步 Cherry Studio 大模型及平台参数配置失败: {str(e)}"
        )


@router.get("/sync-status", summary="获取大模型定时同步状态")
async def get_sync_status(db: AsyncSession = Depends(get_db)):
    """获取厂商同步状态"""
    # 统计内置提供商数量及最近更新时间
    total_stmt = select(func.count(LLMProvider.id)).where(LLMProvider.is_custom == False)
    max_date_stmt = select(func.max(LLMProvider.updated_at)).where(LLMProvider.is_custom == False)
    
    total_res = await db.execute(total_stmt)
    max_date_res = await db.execute(max_date_stmt)
    
    total_val = total_res.scalar() or 0
    max_date_val = max_date_res.scalar()
    
    return {
        "total_providers": total_val,
        "last_sync": max_date_val.isoformat() if max_date_val else None,
        "scheduler_running": _scheduler_running,
    }


# ==================== 定时同步调度器 ====================

_scheduler_running = False
_scheduler = None

def start_cherry_sync_scheduler(interval_hours: int = 24):
    """启动定时同步调度器，每24小时自动拉取更新一次"""
    global _scheduler, _scheduler_running

    if _scheduler_running:
        logger.info("Cherry 大模型同步定时器已在运行中")
        return

    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
    except ImportError:
        logger.warning("apscheduler 未安装，定时大模型同步不可用")
        return

    async def _sync_job():
        logger.info("[大模型同步任务] 开始从 Cherry Studio 自动同步配置信息...")
        async with AsyncSessionLocal() as db:
            try:
                # 触发同步逻辑
                provider_src = await fetch_github_source(PROVIDERS_TS_URL)
                providers_list = parse_providers_ts(provider_src)
                
                if providers_list:
                    for idx, p in enumerate(providers_list):
                        provider = await db.get(LLMProvider, p["id"])
                        if provider:
                            provider.name = p["name"]
                            provider.type = p["type"]
                            provider.base_url = p["base_url"]
                            provider.sort_order = idx + 1
                            provider.updated_at = func.now()
                        else:
                            new_p = LLMProvider(
                                id=p["id"],
                                name=p["name"],
                                type=p["type"],
                                base_url=p["base_url"],
                                enabled=False,
                                is_custom=False,
                                sort_order=idx + 1
                            )
                            db.add(new_p)
                    await db.commit()
                
                models_src = await fetch_github_source(MODELS_TS_URL)
                models_map = parse_models_ts(models_src)
                if models_map:
                    json_path = Path(__file__).parent.parent / "cherry_hardcoded_models.json"
                    with open(json_path, "w", encoding="utf-8") as f:
                        json.dump(models_map, f, ensure_ascii=False, indent=2)
                
                logger.info("[大模型同步任务] 定时自动同步已成功闭环！")
            except Exception as ex:
                logger.error("[大模型同步任务] 自动同步过程中发生错误: %s", ex)

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _sync_job,
        trigger=IntervalTrigger(hours=interval_hours),
        id="cherry_sync",
        name="Cherry Studio 自动大模型数据拉取",
        replace_existing=True,
    )
    _scheduler.start()
    _scheduler_running = True
    logger.info("[调度器] Cherry 大模型定时自动同步任务已部署启动，间隔为 %d 小时", interval_hours)


def stop_cherry_sync_scheduler():
    """停止定时同步调度器"""
    global _scheduler, _scheduler_running
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        _scheduler_running = False
        logger.info("[调度器] Cherry 同步调度器已关闭注销")
