"""
LLM 多模型统一适配层
支持: DeepSeek V3 / Claude / 通义千问 / 智谱GLM / Ollama / 以及任意 OpenAI 兼容接口
基于 SQLAlchemy 异步查询进行数据库对接
"""
import logging
import httpx
import json
from abc import ABC, abstractmethod
from typing import Optional
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.llm_config import AgentRoute, LLMProvider as DBLLMProvider

logger = logging.getLogger(__name__)


class LLMProvider(ABC):
    """统一 LLM 调用接口"""

    def __init__(self, api_key: str = "", base_url: str = "", model: str = "", **kwargs):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.timeout = kwargs.get("timeout", 300)
        self.max_tokens = kwargs.get("max_tokens", 4096)
        self.temperature = kwargs.get("temperature", 0.7)

    @abstractmethod
    async def chat(self, messages: list[dict], **kwargs) -> str:
        """对话完成，返回文本"""
        pass

    @abstractmethod
    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        """对话完成，返回结构化 JSON"""
        pass

    def _extract_json(self, text: str) -> dict | list:
        """从大模型返回的文本中安全提取 JSON（支持 markdown 块和正则提取）"""
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # 兜底：查找第一个 { 或 [，利用 raw_decode 解析忽略后续杂质
            start_idx = text.find('[')
            start_obj = text.find('{')
            
            start = -1
            if start_idx != -1 and start_obj != -1:
                start = min(start_idx, start_obj)
            else:
                start = max(start_idx, start_obj)
                
            if start != -1:
                try:
                    decoder = json.JSONDecoder()
                    obj, _ = decoder.raw_decode(text[start:])
                    return obj
                except json.JSONDecodeError:
                    pass

            # 兜底2：使用 json_repair 修复严重残缺或格式错误的 JSON
            try:
                import json_repair
                repaired = json_repair.repair_json(text, return_objects=True)
                if repaired is not None:
                    return repaired
            except Exception:
                pass

            raise

    async def _openai_compatible_chat(self, messages: list[dict], **kwargs) -> str:
        """OpenAI 兼容 API 调用 (支持多模态)"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
        }
        
        body = {
            "model": kwargs.get("model", self.model),
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
            "temperature": kwargs.get("temperature", self.temperature),
        }
        
        extra_args = {k: v for k, v in kwargs.items() if k not in ("model", "max_tokens", "temperature")}
        body.update(extra_args)

        log_msg = []
        for m in messages:
            content = m.get("content", "")
            if isinstance(content, list):
                parts = [f"{p['type']}({len(p.get('text', p.get('image_url', {}).get('url', ''))) if p['type'] == 'image_url' else p.get('text', '')})" for p in content]
                log_msg.append(f"{m['role']}: [{', '.join(parts)}]")
            else:
                log_msg.append(f"{m['role']}: {str(content)[:100]}...")
        logger.info(f"发送 API 请求: {kwargs.get('model', self.model)} | 消息: {' | '.join(log_msg)}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url.rstrip('/')}/chat/completions",
                    json=body,
                    headers=headers,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as e:
                logger.error(f"API 请求失败 ({e.response.status_code}): {e.response.text[:500]}")
                raise
            except Exception as e:
                logger.error(f"API 请求异常: [{type(e).__name__}] {repr(e)}")
                raise


class _OpenAICompatProvider(LLMProvider):
    """通用 OpenAI 兼容 Provider（从数据库配置动态创建）"""

    async def chat(self, messages: list[dict], **kwargs) -> str:
        return await self._openai_compatible_chat(messages, **kwargs)

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        text = await self._openai_compatible_chat(messages, **kwargs)
        return self._extract_json(text)


class DeepSeekProvider(LLMProvider):
    async def chat(self, messages: list[dict], **kwargs) -> str:
        return await self._openai_compatible_chat(messages, **kwargs)

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        text = await self._openai_compatible_chat(messages, **kwargs)
        return self._extract_json(text)


class ClaudeProvider(LLMProvider):
    async def chat(self, messages: list[dict], **kwargs) -> str:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            system_msg = ""
            chat_msgs = []
            for m in messages:
                if m["role"] == "system":
                    system_msg += m["content"] + "\n"
                else:
                    chat_msgs.append(m)

            response = await client.post(
                f"{self.base_url.rstrip('/')}/messages",
                json={
                    "model": kwargs.get("model", self.model),
                    "max_tokens": kwargs.get("max_tokens", self.max_tokens),
                    "system": system_msg.strip(),
                    "messages": chat_msgs,
                },
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        text = await self.chat(messages, **kwargs)
        return self._extract_json(text)


class OllamaProvider(LLMProvider):
    async def chat(self, messages: list[dict], **kwargs) -> str:
        return await self._openai_compatible_chat(messages, **kwargs)

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        text = await self._openai_compatible_chat(messages, **kwargs)
        return self._extract_json(text)


class GeminiProvider(LLMProvider):
    """Google Gemini 官方 API (支持多模态)"""

    async def chat(self, messages: list[dict], **kwargs) -> str:
        model = kwargs.get("model", self.model)
        if not model.startswith("models/"):
            model = f"models/{model}"

        url = f"{self.base_url.rstrip('/')}/v1beta/{model}:generateContent?key={self.api_key}"
        
        contents = []
        for m in messages:
            role = "user" if m["role"] in ("user", "system") else "model"
            parts = []
            content = m.get("content", "")
            
            if isinstance(content, list):
                for p in content:
                    if p["type"] == "text":
                        parts.append({"text": p["text"]})
                    elif p["type"] == "image_url":
                        img_url = p["image_url"]["url"]
                        if img_url.startswith("data:"):
                            mime, b64 = img_url.split(";base64,")
                            mime = mime.replace("data:", "")
                            parts.append({"inline_data": {"mime_type": mime, "data": b64}})
            else:
                parts.append({"text": content})
            
            contents.append({"role": role, "parts": parts})

        logger.info(f"发送 Gemini 请求: {model} | 块数量: {len(contents)}")
        
        req_body = {
            "contents": contents
        }
        
        # 组装生成配置，映射 max_tokens 到 maxOutputTokens，所有注释必须使用中文
        gen_config = {}
        temp = kwargs.get("temperature", self.temperature)
        if temp is not None:
            gen_config["temperature"] = temp
            
        max_tok = kwargs.get("max_tokens", self.max_tokens)
        if max_tok is not None:
            gen_config["maxOutputTokens"] = max_tok
            
        if gen_config:
            req_body["generationConfig"] = gen_config
            
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, json=req_body)
            if response.status_code != 200:
                logger.error(f"Gemini 请求失败: {response.text}")
                response.raise_for_status()
            
            data = response.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                logger.error(f"Gemini 返回格式异常: {data}")
                return ""

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        text = await self.chat(messages, **kwargs)
        return self._extract_json(text)


class MiniMaxProvider(LLMProvider):
    """MiniMax 专用 Provider，继承自通用 LLM 适配器"""

    async def chat(self, messages: list[dict], **kwargs) -> str:
        # MiniMax 也支持标准 OpenAI 接口协议
        return await self._openai_compatible_chat(messages, **kwargs)

    async def chat_json(self, messages: list[dict], **kwargs) -> dict | list:
        # 模型隔离：仅针对推理模型（以 M3 或 MiniMax-M 开头）注入参数以控制思考时间并提高返回确定性
        if self.model and ("M3" in self.model or "MiniMax-M" in self.model):
            # 禁用 thinking 推理过程，减少响应时延（从 40 秒+压缩至 13 秒左右）
            if "thinking" not in kwargs:
                kwargs["thinking"] = {"type": "disabled"}
            # 降低 temperature 增加指令遵从度
            if "temperature" not in kwargs:
                kwargs["temperature"] = 0.1

        # 强约束：强制要求模型返回标准 JSON 结构
        if "response_format" not in kwargs:
            kwargs["response_format"] = {"type": "json_object"}

        text = await self._openai_compatible_chat(messages, **kwargs)
        return self._extract_json(text)


class ModelRouter:
    """智能路由: 根据配置分配模型"""
    PROVIDERS = {
        "deepseek": DeepSeekProvider,
        "claude": ClaudeProvider,
        "ollama": OllamaProvider,
        "gemini": GeminiProvider,
        "minimax": MiniMaxProvider,
    }

    @staticmethod
    def create_from_db(provider_row: dict, model: str = "") -> LLMProvider:
        ptype = provider_row.get("type", "openai")
        api_key = provider_row.get("api_key", "")
        base_url = provider_row.get("base_url", "")
        provider_id = provider_row.get("id", "")

        if "," in api_key:
            api_key = api_key.split(",")[0].strip()

        logger.info(f"正在创建 Provider: type={ptype}, model={model}, id={provider_id}")
        
        if ptype == "ollama":
            return OllamaProvider(api_key="ollama", base_url=base_url or "http://localhost:11434/v1", model=model)
        elif ptype == "gemini":
            return GeminiProvider(api_key=api_key, base_url=base_url or "https://generativelanguage.googleapis.com", model=model)
        elif ptype == "minimax" or provider_id in ("minimax", "minimax-global"):
            return MiniMaxProvider(api_key=api_key, base_url=base_url, model=model)
        else:
            return _OpenAICompatProvider(api_key=api_key, base_url=base_url, model=model)


async def get_provider_for_agent(agent_role: str) -> tuple[LLMProvider, str]:
    """通过 SQLAlchemy 异步获取某个 Agent 绑定的模型实例"""
    async with AsyncSessionLocal() as db:
        # 1. 查找路由分配
        route_result = await db.execute(
            select(AgentRoute).where(AgentRoute.agent_role == agent_role)
        )
        route = route_result.scalar_one_or_none()
        if not route:
            raise ValueError(f"Agent 角色 '{agent_role}' 未配置大模型路由")

        # 2. 查找对应的提供商
        provider_result = await db.execute(
            select(DBLLMProvider).where(DBLLMProvider.id == route.provider_id, DBLLMProvider.enabled == True)
        )
        provider_row = provider_result.scalar_one_or_none()
        if not provider_row:
            raise ValueError(f"提供商 '{route.provider_id}' 不存在或未启用")

        # 3. 创建驱动实例
        provider_dict = {
            "type": provider_row.type,
            "api_key": provider_row.api_key,
            "base_url": provider_row.base_url,
            "id": provider_row.id
        }
        provider = ModelRouter.create_from_db(provider_dict, model=route.model_id)
        return provider, route.model_id
