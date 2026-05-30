"""
钉钉集成模块
提供钉钉消息推送、用户认证等功能
钉钉AppKey: dingcdmb2imuqdcoqrdf
钉钉CorpId: dingdaec913f1d2b741235c2f4657eb6378f
"""

import httpx
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.config import settings


class DingTalkClient:
    """钉钉API客户端"""

    # 钉钉开放平台API地址
    BASE_URL = "https://oapi.dingtalk.com"
    NEW_API_URL = "https://api.dingtalk.com"

    def __init__(self):
        self.app_key = settings.DINGTALK_APP_KEY
        self.app_secret = settings.DINGTALK_APP_SECRET
        self.corp_id = settings.DINGTALK_CORP_ID
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self.timeout = httpx.Timeout(30.0)

    async def _get_access_token(self) -> str:
        """
        获取钉钉接口访问令牌
        令牌有效期为2小时，过期前自动刷新
        :return: access_token字符串
        """
        # 检查缓存的token是否有效
        now = datetime.now(timezone.utc)
        if self._access_token and self._token_expires_at and now < self._token_expires_at:
            return self._access_token

        # 请求新token
        url = f"{self.BASE_URL}/gettoken"
        params = {
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params)
            data = response.json()

        if data.get("errcode") == 0:
            self._access_token = data["access_token"]
            # 提前5分钟刷新
            self._token_expires_at = now + timedelta(seconds=data.get("expires_in", 7200) - 300)
            return self._access_token
        else:
            raise Exception(f"获取钉钉access_token失败: {data.get('errmsg')}")

    async def get_user_info_by_code(self, auth_code: str) -> Optional[dict]:
        """
        通过授权码获取用户信息（免登场景）
        :param auth_code: 前端传来的授权码
        :return: 用户信息字典
        """
        # TODO: 实现钉钉免登获取用户信息
        # 步骤：1. 获取access_token 2. 通过code获取userid 3. 获取用户详情
        return None

    async def send_work_notification(
        self,
        user_id_list: list[str],
        content: str,
        title: str = "百日奋战播报",
    ) -> Optional[str]:
        """
        发送工作通知消息
        :param user_id_list: 钉钉用户ID列表
        :param content: 消息内容（支持Markdown）
        :param title: 消息标题
        :return: 钉钉消息ID
        """
        # TODO: 实现钉钉工作通知推送
        return None

    async def send_group_message(
        self,
        chat_id: str,
        content: str,
        msg_type: str = "markdown",
    ) -> Optional[str]:
        """
        发送群消息
        :param chat_id: 群会话ID
        :param content: 消息内容
        :param msg_type: 消息类型（text/markdown/action_card等）
        :return: 消息ID
        """
        # TODO: 实现钉钉群消息推送
        return None

    async def get_department_users(self, dept_id: int = 1) -> list[dict]:
        """
        获取部门用户列表
        :param dept_id: 部门ID，默认根部门
        :return: 用户列表
        """
        # TODO: 实现获取部门成员列表
        return []


# 全局钉钉客户端单例
dingtalk_client = DingTalkClient()
