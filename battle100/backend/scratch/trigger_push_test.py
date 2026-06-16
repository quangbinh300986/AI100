# -*- coding: utf-8 -*-
import asyncio
import logging
import sys
from sqlalchemy import select

# 将 backend 根目录加入 path
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent, PushStatus
from app.api.broadcast import trigger_broadcast_push

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("trigger_push_test")

async def main():
    logger.info("正在连接数据库并查找最新的政策文件播报...")
    async with AsyncSessionLocal() as db:
        # 查询最新的一条类型为 station_report 且分类为 policy 的播报
        stmt = (
            select(BroadcastEvent)
            .where(
                BroadcastEvent.event_type == "station_report",
                BroadcastEvent.station_category == "policy"
            )
            .order_by(BroadcastEvent.id.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        event = res.scalar_one_or_none()
        
        if not event:
            logger.error("数据库中未找到符合条件的政策文件播报事件！")
            return
            
        logger.info(f"成功找到播报事件：ID={event.id}, 标题={event.project_name}, 密码={event.attachment_password}")
        
        # 强制将状态重置为 PENDING 以便 trigger_broadcast_push 发送它
        event.push_status = PushStatus.PENDING
        db.add(event)
        await db.commit()
        logger.info(f"已将播报 ID={event.id} 的推送状态重置为 PENDING")
        
        # 调用后端异步推送引擎发送消息
        logger.info("正在调用钉钉推送接口...")
        await trigger_broadcast_push(event.id)
        logger.info("推送指令已成功闭环！请在钉钉群内检查最新卡片展示效果。")

if __name__ == "__main__":
    asyncio.run(main())
