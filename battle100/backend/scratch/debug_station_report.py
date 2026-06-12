import asyncio
import sys
import os

sys.path.append(r"c:\APP\AI100\battle100\backend")

from app.database import AsyncSessionLocal
from app.models.user import User
from app.api.broadcast import create_station_report
from fastapi import UploadFile, BackgroundTasks
from io import BytesIO

async def main():
    async with AsyncSessionLocal() as db:
        # 1. 查找一个用户
        from sqlalchemy import select
        res = await db.execute(select(User).limit(1))
        user = res.scalar()
        if not user:
            print("找不到任何用户！")
            return
        print(f"模拟用户: {user.name} (ID: {user.id})")
        
        # 2. 模拟一个上传文件
        dummy_file_content = b"%PDF-1.4 dummy pdf content"
        upload_file = UploadFile(
            filename="广东省自然资源厅关于印发《广东省县城城市设计指南》的通知.pdf",
            file=BytesIO(dummy_file_content),
            size=len(dummy_file_content)
        )
        
        # 3. 模拟 BackgroundTasks
        bg_tasks = BackgroundTasks()
        
        # 4. 调用 create_station_report
        try:
            print("开始调用 create_station_report...")
            event = await create_station_report(
                station_category="policy",
                station_location="省级", # 对应驻点地点，截图里是“省级”？不对，截图里驻点地点填的是“省级”？
                title="粤自然资规划〔2026〕970号广东省自然资源厅关于印发《广东省县城城市设计指南》的通知",
                content="【政策层级】\n省级\n\n【核心要点】\n1. 业务机会：\n1.广东省县城城市设计方案启动编制\n2.已批复的县城城市设计方案可自动调整方案\n\n2. 风险点：\n我公司在编方案存在按新指南修改风险\n\n3. 其他要点：\n无",
                summary=None,
                is_urgent=False,
                push_channel="all",
                files=[upload_file],
                db=db,
                current_user=user,
                background_tasks=bg_tasks
            )
            print(f"成功创建事件，ID: {event.id}")
        except Exception as e:
            import traceback
            print("调用抛出异常！")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
