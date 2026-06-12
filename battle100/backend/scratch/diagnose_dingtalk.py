import asyncio
import sys
import os

# 将 backend 根目录加入 path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config import settings
from app.models.user import User
from app.integrations.dingtalk import dingtalk_client
from app.database import AsyncSessionLocal

async def main():
    print("===== 开始钉钉接口诊断 =====")
    print(f"DINGTALK_APP_KEY: {settings.DINGTALK_APP_KEY}")
    print(f"DINGTALK_CORP_ID: {settings.DINGTALK_CORP_ID}")
    print(f"DINGTALK_WEEKLY_REPORT_TEMPLATE_ID: {settings.DINGTALK_WEEKLY_REPORT_TEMPLATE_ID}")
    
    # 1. 尝试获取 Access Token
    try:
        token = await dingtalk_client._get_access_token()
        print(f"Access Token 获取成功: {token[:10]}... (长度 {len(token)})")
    except Exception as e:
        print(f"Access Token 获取失败: {e}")
        return

    # 2. 连接本地数据库获取用户信息
    async with AsyncSessionLocal() as session:
        stmt = select(User).limit(50)
        res = await session.execute(stmt)
        users = res.scalars().all()
        if not users:
            print("未在数据库中找到任何用户记录")
            return
            
        print(f"从数据库中找到 {len(users)} 个用户，开始诊断匹配：")
        target_user = None
        for u in users:
            print(f"- 用户姓名: {u.name}, 手机号: {u.phone}, 现有钉钉ID: {u.dingtalk_id}")
            # 尝试根据手机号拉取 userid，测试该接口权限是否开通
            if u.phone:
                try:
                    userid = await dingtalk_client.get_user_by_mobile(u.phone)
                    print(f"  -> 钉钉匹配 userid 结果: {userid}")
                    if userid:
                        target_user = u
                except Exception as e:
                    print(f"  -> 匹配 userid 异常: {e}")
        
        if not target_user:
            print("测试手机号匹配完毕，无匹配成功用户")
            return
            
        # 3. 对有 dingtalk_id 的用户进行填报日志模拟测试
        print(f"\n开始使用用户 [{target_user.name}] 的钉钉 ID [{target_user.dingtalk_id}] 模拟提交日志：")
        
        test_contents = [
            {"key": "本周目标计划", "content": "1. 诊断测试本周目标计划内容", "type": 1, "sort": 1, "content_type": "markdown"},
            {"key": "本周实际完成", "content": "1. 诊断测试本周实际完成内容", "type": 1, "sort": 2, "content_type": "markdown"},
            {"key": "达成情况", "content": "100%", "type": 1, "sort": 3, "content_type": "markdown"},
            {"key": "本周亮点", "content": "测试通过", "type": 1, "sort": 4, "content_type": "markdown"},
            {"key": "本周卡点", "content": "无", "type": 1, "sort": 5, "content_type": "markdown"},
            {"key": "是否需要上级支持", "content": "否", "type": 1, "sort": 6, "content_type": "markdown"},
            {"key": "下周目标", "content": "1. 诊断测试下周目标计划内容", "type": 1, "sort": 7, "content_type": "markdown"}
        ]
        
        # 直接发起 httpx post 并打印完整 JSON 响应，以便查看钉钉具体报错
        import httpx
        import json
        
        url = f"{dingtalk_client.BASE_URL}/topapi/report/create"
        params = {"access_token": token}
        json_data = {
            "create_report_param": {
                "template_id": settings.DINGTALK_WEEKLY_REPORT_TEMPLATE_ID,
                "userid": target_user.dingtalk_id,
                "contents": test_contents,
                "to_chat": False,
                "dd_from": "battle100"
            }
        }
        
        print(f"正在 POST {url} ...")
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, params=params, json=json_data)
            data = response.json()
            print(f"钉钉接口返回数据: {json.dumps(data, ensure_ascii=False, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
