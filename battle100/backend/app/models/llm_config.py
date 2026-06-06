"""
大模型配置相关的数据库模型
定义了 llm_providers, llm_models, agent_routes 三张表
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy import String, Boolean, Integer, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class LLMProvider(Base, TimestampMixin):
    """大模型提供商配置表"""
    __tablename__ = "llm_providers"

    id: Mapped[str] = mapped_column(
        String(100), primary_key=True, comment="提供商唯一标识"
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="厂商显示名称"
    )
    type: Mapped[str] = mapped_column(
        String(50), server_default="openai", nullable=False, comment="厂商类型，如 openai, gemini, ollama"
    )
    base_url: Mapped[str] = mapped_column(
        String(255), server_default="", nullable=False, comment="API 接口端点地址"
    )
    api_key: Mapped[str] = mapped_column(
        String(1000), server_default="", nullable=False, comment="API 密钥（多密钥逗号分隔）"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False, comment="是否启用"
    )
    is_custom: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False, comment="是否为自定义提供商"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, server_default="0", default=0, nullable=False, comment="排序权重"
    )

    # 官方网站及辅助配置链接
    website_official: Mapped[str] = mapped_column(
        String(255), server_default="", nullable=False, comment="厂商官方主页"
    )
    website_api_key: Mapped[str] = mapped_column(
        String(255), server_default="", nullable=False, comment="密钥申请地址"
    )
    website_docs: Mapped[str] = mapped_column(
        String(255), server_default="", nullable=False, comment="官方开发文档"
    )
    website_models: Mapped[str] = mapped_column(
        String(255), server_default="", nullable=False, comment="模型定价与参考"
    )

    def __repr__(self) -> str:
        return f"<LLMProvider(id={self.id}, name={self.name}, enabled={self.enabled})>"


class LLMModel(Base):
    """已启用/添加的模型列表表"""
    __tablename__ = "llm_models"

    id: Mapped[str] = mapped_column(
        String(200), primary_key=True, comment="模型在系统内的唯一标识，格式为 provider_id:model_id"
    )
    provider_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("llm_providers.id", ondelete="CASCADE"), nullable=False, comment="关联的提供商ID"
    )
    model_id: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="底层原始大模型ID"
    )
    name: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="模型显示名称"
    )
    group_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="分组名称"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False, comment="是否启用"
    )
    capabilities: Mapped[List[str]] = mapped_column(
        JSON, server_default="[]", default=list, nullable=False, comment="模型能力列表 (如 vision, web, reasoning, tool)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), comment="添加时间"
    )

    def __repr__(self) -> str:
        return f"<LLMModel(id={self.id}, name={self.name}, enabled={self.enabled})>"


class AgentRoute(Base):
    """Agent 角色路由分配表"""
    __tablename__ = "agent_routes"

    agent_role: Mapped[str] = mapped_column(
        String(100), primary_key=True, comment="Agent 角色标识 (如 parser, extractor)"
    )
    provider_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="绑定的提供商ID"
    )
    model_id: Mapped[str] = mapped_column(
        String(200), nullable=False, comment="绑定的底层大模型ID"
    )
    agent_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="自定义智能体名称"
    )
    agent_description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="自定义智能体描述"
    )
    system_prompt: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, comment="自定义系统提示词"
    )
    user_prompt: Mapped[Optional[str]] = mapped_column(
        String, nullable=True, comment="自定义用户提示词/模板"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), comment="更新时间"
    )

    def __repr__(self) -> str:
        return f"<AgentRoute(role={self.agent_role}, target={self.provider_id}:{self.model_id})>"
