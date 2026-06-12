import asyncio
import re
import logging
from datetime import datetime, time
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User
from app.api.broadcast import push_broadcast_to_crm_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("battle100_sync_today")

async def sync_today():
    logger.info("=== 开始补推今天的所有播报到CRM工时事项 ===")
    
    # 获取今天（2026-06-09）开始的时刻
    today_start = datetime.combine(datetime.now().date(), time.min)
    
    async with AsyncSessionLocal() as db:
        # 查询今天所有未软删除的播报记录，连表查出播报人的本地系统姓名
        stmt = select(BroadcastEvent, User.name.label("user_real_name"))\
            .outerjoin(User, BroadcastEvent.user_id == User.id)\
            .where(
                BroadcastEvent.created_at >= today_start,
                BroadcastEvent.is_deleted == False
            )
        res = await db.execute(stmt)
        rows = res.all()
        
        logger.info(f"今天共有 {len(rows)} 条播报记录待检索。")
        
        success_count = 0
        skip_count = 0
        
        for row in rows:
            event, user_real_name = row
            event_type = event.event_type
            
            # 我们只处理铁三角联动、客户幸福动作、营销内部播报
            if event_type not in ["triangle", "happiness", "marketing_report"]:
                skip_count += 1
                continue
                
            logger.info(f"正在处理播报记录 - ID: {event.id}, 类型: {event_type}")
            
            # 1. 还原播报人姓名 employee_name
            employee_name = user_real_name
            if not employee_name and event.content:
                emp_match = re.search(r"我司【([^】]+)】", event.content)
                if emp_match:
                    employee_name = emp_match.group(1).strip()
            if not employee_name:
                employee_name = "未知用户"
                
            # 2. 还原业主单位 customer_name
            customer_name = None
            if event_type == "triangle" and event.content:
                cust_match = re.search(r"在【([^】]+)】开展售前铁三角联动", event.content)
                if cust_match:
                    customer_name = cust_match.group(1).strip()
            elif event_type == "happiness" and event.content:
                cust_match = re.search(r"对象为【([^】]+)】", event.content)
                if cust_match:
                    customer_name = cust_match.group(1).strip()
            elif event_type == "marketing_report" and event.content:
                cust_match = re.search(r"\*\*\s*业主单位\s*\*\*\s*：\s*([^\n]+)", event.content)
                if cust_match:
                    customer_name = cust_match.group(1).strip()
                    if customer_name == "未指定":
                        customer_name = None
            
            # 3. 还原动作描述 action_description
            action_description = None
            if event_type == "triangle" and event.content:
                desc_match = re.search(r"联动动作：([^\n]+)", event.content)
                if desc_match:
                    action_description = desc_match.group(1).strip()
            elif event_type == "happiness" and event.content:
                desc_match = re.search(r"动作描述：([^\n]+)", event.content)
                if desc_match:
                    action_description = desc_match.group(1).strip()
                    
            # 4. 还原营销联动人 marketing_copartners
            marketing_copartners = []
            if event_type == "triangle" and event.content:
                m_match = re.search(r"营销人员\(([^)]+)\)", event.content)
                if m_match:
                    copartners_str = m_match.group(1).strip()
                    if copartners_str and copartners_str != "无":
                        marketing_copartners = [name.strip() for name in re.split(r"[,，、\s]+", copartners_str) if name.strip()]
                        
            logger.info(f"提取参数成功：播报人: {employee_name}, 客户: {customer_name}, 联动动作: {action_description}, 营销联动人: {marketing_copartners}")
            
            # 5. 直接调用我们已经实现的后台任务进行上报打卡 (它将负责岗位过滤、剔除本人、多次触发和 httpx 调用)
            # 在脚本中我们直接使用 await 执行它，以保证同步顺序进行并观察结果
            try:
                await push_broadcast_to_crm_task(
                    broadcast_id=event.id,
                    action_type=event_type, # 传 event_type 作为 action_type 同样被识别
                    event_type=event_type,
                    customer_name=customer_name,
                    employee_name=employee_name,
                    action_description=action_description,
                    content=event.content,
                    crm_opportunity_id=event.crm_opportunity_id,
                    project_name=event.project_name,
                    marketing_copartners=marketing_copartners
                )
                success_count += 1
            except Exception as push_err:
                logger.error(f"补推战报ID {event.id} 异常: {push_err}")
                
        logger.info(f"=== 补推完成！共处理: {success_count} 条，跳过非营销/无关播报: {skip_count} 条 ===")

if __name__ == "__main__":
    asyncio.run(sync_today())
