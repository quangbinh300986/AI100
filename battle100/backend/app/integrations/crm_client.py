"""
CRM系统API客户端
用于对接CRM后端系统（Java Spring Boot），获取商机、客户等数据
CRM后端地址：http://10.50.0.137:9294
"""

import httpx
from typing import Optional, Any
from app.config import settings


class CRMClient:
    """CRM API客户端"""

    def __init__(self):
        self.base_url = settings.CRM_BASE_URL
        self.timeout = httpx.Timeout(30.0)  # 30秒超时

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        发送HTTP请求到CRM系统
        :param method: HTTP方法
        :param path: 接口路径
        :param params: 查询参数
        :param json_data: 请求体JSON数据
        :return: 响应数据
        """
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
            )
            response.raise_for_status()
            return response.json()

    async def get_opportunities(
        self,
        dept_code: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> list[dict]:
        """
        获取商机列表（占位实现）
        :param dept_code: 部门编码
        :param start_date: 开始日期
        :param end_date: 结束日期
        :return: 商机列表
        """
        # TODO: 对接实际CRM接口
        params = {}
        if dept_code:
            params["deptCode"] = dept_code
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        return []

    async def get_contracts(
        self,
        dept_code: Optional[str] = None,
        month: Optional[str] = None,
    ) -> list[dict]:
        """
        获取签约合同列表（占位实现）
        :param dept_code: 部门编码
        :param month: 月份
        :return: 合同列表
        """
        # TODO: 对接实际CRM接口
        return []

    async def get_customer_info(self, customer_id: str) -> Optional[dict]:
        """
        获取客户详情（占位实现）
        :param customer_id: 客户ID
        :return: 客户信息
        """
        # TODO: 对接实际CRM接口
        return None

    async def sync_user_data(self, crm_user_id: str) -> Optional[dict]:
        """
        同步CRM用户数据（占位实现）
        :param crm_user_id: CRM用户ID
        :return: 用户数据
        """
        # TODO: 对接实际CRM接口
        return None


# 全局CRM客户端单例
crm_client = CRMClient()
