# -*- coding: utf-8 -*-
"""
验证钉钉推送消息中图片缩略图拼接的脚本
"""

import asyncio
import sys
import os

# 将当前工作路径添加到系统路径中以允许正常导入 app 包
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.integrations.dingtalk import dingtalk_client
from app.config import settings

async def main():
    print("开始测试钉钉推送图片缩略图功能...")

    # 1. 模拟驻点人员播报（含有图片附件）
    print("\n--- 模拟驻点人员播报 ---")
    mock_station_attachments = [
        {"name": "test_image1.png", "url": "https://supabase.local/storage/v1/object/public/photos/test1.png"},
        {"name": "readme.txt", "url": "https://supabase.local/storage/v1/object/public/photos/readme.txt"},
        {"name": "test_image2.jpg", "url": "https://supabase.local/storage/v1/object/public/photos/test2.jpg"}
    ]
    
    # 临时覆盖配置以便观察替换效果
    settings.EXTERNAL_SUPABASE_URL = "https://supabase.external.com"
    settings.SUPABASE_URL = "https://supabase.local"

    # 我们通过修改 httpx.AsyncClient 的 post 方法来拦截实际的网络发送，或者只是手动拦截并输出 markdown 内容。
    # 为简单起见，我们可以临时 monkeypatch send_webhook_message 和 httpx 发送。
    
    original_post = dingtalk_client.send_webhook_message
    
    # 拦截 send_webhook_message 打印组装的 text
    async def mock_send_webhook_message(content, title=""):
        print(f"【Webhook Markdown 内容】:\n{content}")
        return "mock_webhook_success"
        
    dingtalk_client.send_webhook_message = mock_send_webhook_message
    
    # 模拟 send_station_report_actioncard 的执行，由于它直接发起 HTTP POST 请求，我们可以临时修改 post 动作
    import httpx
    
    # 临时覆盖 httpx.AsyncClient.post
    original_client_post = httpx.AsyncClient.post
    
    async def mock_httpx_post(self, url, *args, **kwargs):
        json_data = kwargs.get("json", {})
        if "actionCard" in json_data:
            print("【ActionCard 消息内容】:")
            print(f"Title: {json_data['actionCard'].get('title')}")
            print(f"Text:\n{json_data['actionCard'].get('text')}")
            print("Btns:", json_data['actionCard'].get("btns"))
        return httpx.Response(200, json={"errcode": 0, "errmsg": "ok"})
        
    httpx.AsyncClient.post = mock_httpx_post

    # 执行驻点快报的推送验证
    await dingtalk_client.send_station_report_actioncard(
        title="测试项目快报",
        category="lead",
        location="广州天河",
        summary="我们在天河区发现了新的重要商机，需要跟进。",
        download_url="https://supabase.local/storage/v1/object/public/photos/all.zip",
        password="123",
        is_urgent=True,
        detail_url="https://frontend.local/admin",
        attachment_urls=mock_station_attachments
    )

    print("\n--- 模拟普通战报推送 ---")
    # 2. 模拟普通合同签订战报（含有图片附件）
    mock_broadcast_attachments = [
        "https://supabase.local/storage/v1/object/public/photos/contract_proof.png",
        "https://supabase.local/storage/v1/object/public/photos/doc.pdf"
    ]
    
    await dingtalk_client.push_broadcast_message(
        event_type="contract_signed",
        content="推进了某某合同签订，金额 120.5 万元！",
        user_name="张三",
        team_name="先锋队",
        dingtalk_users=["user123"],
        attachment_urls=mock_broadcast_attachments
    )

    print("\n测试完成。")

if __name__ == "__main__":
    asyncio.run(main())
