# -*- coding: utf-8 -*-
"""
真实钉钉 ActionCard 推送并打印返回响应以调试“发送失败”状态的脚本
"""

import asyncio
import sys
import os

# 将当前工作路径添加到系统路径中以允许正常导入 app 包
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.integrations.dingtalk import dingtalk_client
from app.config import settings
import httpx

async def main():
    print("正在使用真实的配置调试钉钉 ActionCard 发送...")
    print(f"当前 DINGTALK_WEBHOOK_URL (前50字): {settings.DINGTALK_WEBHOOK_URL[:50] if settings.DINGTALK_WEBHOOK_URL else '未配置'}")
    print(f"当前 DINGTALK_WEBHOOK_SECRET: {settings.DINGTALK_WEBHOOK_SECRET[:10] if settings.DINGTALK_WEBHOOK_SECRET else '未配置'}...")

    # 我们通过代理真实的 httpx 发送并打印出 Response，从而观察究竟钉钉返回了什么
    original_post = httpx.AsyncClient.post

    async def debug_httpx_post(self, url, *args, **kwargs):
        print(f"\n[HTTP POST] 发起请求 -> URL: {url[:100]}...")
        # 打印 Payload
        json_data = kwargs.get("json")
        if json_data:
            print("Payload JSON 数据:")
            import json
            print(json.dumps(json_data, ensure_ascii=True, indent=2))
        
        # 调用真实请求
        resp = await original_post(self, url, *args, **kwargs)
        
        print(f"[HTTP Response] 状态码: {resp.status_code}")
        try:
            resp_json = resp.json()
            print(f"返回 JSON 数据: {resp_json}")
        except Exception:
            print(f"返回文本内容: {resp.text}")
        return resp

    httpx.AsyncClient.post = debug_httpx_post

    # 真实的触发一次发送
    res = await dingtalk_client.send_station_report_actioncard(
        title="重大会议部署测试",
        category="deployment",
        location="测试地点",
        summary="这是一条用来测试钉钉返回JSON结构的会议部署测试信息。",
        download_url=None,
        password=None,
        is_urgent=False,
        detail_url=None,
        attachment_urls=None
    )

    print(f"\n方法返回的 msg_id: {res}")
    if res == "webhook_success":
        print("发送结果判定：发送成功")
    else:
        print("发送结果判定：发送失败")

if __name__ == "__main__":
    asyncio.run(main())
