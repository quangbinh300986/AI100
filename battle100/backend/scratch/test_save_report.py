import asyncio
import sys
import os

# 将 backend 根目录加入 path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.integrations.dingtalk import dingtalk_client
from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def main():
    print("===== 开始测试 dingtalk_client.save_report 自动分发群功能 =====")
    
    # 1. 从数据库中获取一个有 dingtalk_id 的用户
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.dingtalk_id.isnot(None), User.dingtalk_id != "").limit(5)
        res = await session.execute(stmt)
        users = res.scalars().all()
        if not users:
            print("未在数据库中找到任何有 dingtalk_id 的用户记录")
            return
        
        # 使用第一个有 dingtalk_id 的用户进行测试
        target_user = users[0]
        print(f"测试用户: {target_user.name}, 钉钉 ID: {target_user.dingtalk_id}")

        # 周报数据内容
        test_contents = [
            {"key": "本周目标计划", "value": "1. 诊断测试本周目标计划内容 (带群分发测试)"},
            {"key": "本周实际完成", "value": "1. 诊断测试本周实际完成内容 (带群分发测试)"},
            {"key": "达成情况", "value": "100%"},
            {"key": "本周亮点", "value": "测试通过"},
            {"key": "本周卡点", "value": "无"},
            {"key": "是否需要上级支持", "value": "否"},
            {"key": "下周目标", "value": "1. 诊断测试下周目标计划内容"}
        ]
        
        template_id = settings.DINGTALK_WEEKLY_REPORT_TEMPLATE_ID
        print(f"使用模板 ID: {template_id}")
        
        # 调用 save_report，它内部现在会动态获取 to_cids 并注入
        success, msg = await dingtalk_client.save_report(
            template_id=template_id,
            userid=target_user.dingtalk_id,
            contents=test_contents,
            to_userids=[]
        )
        
        print(f"调用 save_report 结果: {success}")
        print(f"调用返回消息: {msg}")

if __name__ == "__main__":
    asyncio.run(main())
