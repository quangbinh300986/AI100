# -*- coding: utf-8 -*-
import asyncio
import logging
import sys
import os

# 将 backend 根目录加入 path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent, PushStatus
from app.api.broadcast import trigger_broadcast_push
from sqlalchemy import select

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("restore_password")

async def main():
    logger.info("正在将 1172 播报事件的密码恢复为原始密码 q2@PE2EmnaKx...")
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent).where(BroadcastEvent.id == 1172)
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if not event:
            logger.error("数据库中未找到 ID 为 1172 的政策播报事件！")
            return
            
        event.attachment_password = "q2@PE2EmnaKx"
        event.push_status = PushStatus.PENDING
        db.add(event)
        await db.commit()
        logger.info("成功恢复密码，并且已重置状态为 PENDING")
        
        logger.info("正在触发重推送，测试在带原密码特殊字符时，新增的一键复制密码按钮功能...")
        await trigger_broadcast_push(event.id)
        logger.info("重推送成功闭环！")

if __name__ == "__main__":
    asyncio.run(main())
