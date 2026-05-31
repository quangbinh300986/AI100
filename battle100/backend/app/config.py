"""
应用配置模块
使用 Pydantic Settings 管理所有配置项，支持从环境变量和 .env 文件加载
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用全局配置"""

    # ===== 应用基础配置 =====
    APP_NAME: str = "百日奋战管理系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    # ===== 数据库配置 =====
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "battle100"

    @property
    def DATABASE_URL(self) -> str:
        """异步数据库连接URL"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """同步数据库连接URL（用于Alembic迁移）"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # ===== Redis配置 =====
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    @property
    def REDIS_URL(self) -> str:
        """Redis连接URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # ===== JWT认证配置 =====
    JWT_SECRET_KEY: str = "battle100-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7  # 7天

    # ===== CORS跨域配置 =====
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3100", "http://localhost:5173", "http://localhost:8080"]

    # ===== CRM系统对接配置 =====
    CRM_BASE_URL: str = "http://10.50.0.137:9294"
    CRM_DB_HOST: str = "10.50.0.137"
    CRM_DB_PORT: int = 3306
    CRM_DB_NAME: str = "gzzdpm"
    CRM_DB_USER: str = ""
    CRM_DB_PASSWORD: str = ""

    # ===== 钉钉集成配置 =====
    DINGTALK_APP_KEY: str = "dingkbksgliafwkuhymm"
    DINGTALK_APP_SECRET: str = "4ix04ToPBsSafjLFdydEq2iYQoVu71czrXNSYIQOyRmA4secmgCbjgR-4mT7eH4d"
    DINGTALK_CORP_ID: str = "dingdaec913f1d2b741235c2f4657eb6378f"
    DINGTALK_AGENT_ID: Optional[str] = "4630403498"
    DINGTALK_WEBHOOK_URL: Optional[str] = None
    DINGTALK_WEBHOOK_SECRET: Optional[str] = None
    DINGTALK_CHAT_ID: Optional[str] = None

    # ===== Supabase 配置 =====
    SUPABASE_URL: str = "http://localhost:8000"
    SERVICE_ROLE_KEY: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


# 全局配置单例
settings = Settings()
