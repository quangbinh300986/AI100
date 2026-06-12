import asyncio
import re
import pymysql
from datetime import datetime, timedelta
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User as DbUser

async def main():
    print("=== 开始诊断项斌强 ID 588 的查重细节 ===")
    
    # 1. 查本地播报
    async with AsyncSessionLocal() as db:
        stmt = select(BroadcastEvent, DbUser.name.label("user_real_name"))\
            .outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
            .where(BroadcastEvent.id == 588)
        res = await db.execute(stmt)
        row = res.fetchone()
        if not row:
            print("未在本地找到 588 播报！")
            return
        event, user_real_name = row
        
    print(f"本地播报 - ID: {event.id}")
    print(f"  UserRealName: {user_real_name}")
    print(f"  CreatedAt: {event.created_at}")
    print(f"  Content: {event.content}")
    
    # 解析提取
    employee_name = user_real_name or "项斌强"
    belong_date = event.created_at.strftime("%Y-%m-%d")
    
    customer_name = None
    cust_match = re.search(r"在【([^】]+)】开展售前铁三角联动", event.content)
    if cust_match:
        customer_name = cust_match.group(1).strip()
        
    print(f"解析参数:")
    print(f"  employee_name: {employee_name}")
    print(f"  belong_date: {belong_date}")
    print(f"  customer_name: {customer_name}")
    
    # 2. 连 CRM MySQL
    conn = pymysql.connect(
        host="10.40.0.56",
        port=3307,
        user="gzzdpm_read",
        password="cf6jx529KQ",
        database="gzzdpm",
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with conn.cursor() as cursor:
            # 查用户
            cursor.execute("SELECT user_code, user_name FROM js_sys_user WHERE user_name = %s AND status = '0'", (employee_name,))
            user_row = cursor.fetchone()
            print(f"CRM 用户匹配: {user_row}")
            if not user_row:
                return
            user_code = user_row["user_code"]
            
            # 单步查工作时间记录 (没有客户名称限制)
            start_dt = f"{belong_date} 00:00:00"
            end_dt = (datetime.strptime(belong_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
            
            print(f"查时间段: {start_dt} 至 {end_dt}")
            
            cursor.execute("""
                SELECT * FROM zdcrm_visit_work_hour_record 
                WHERE user_id = %s 
                  AND start_time >= %s 
                  AND start_time < %s
                  AND is_del = '0'
            """, (user_code, start_dt, end_dt))
            work_hours = cursor.fetchall()
            print(f"找到工时主记录共: {len(work_hours)} 条")
            for wh in work_hours:
                print(f"  WorkHourId: {wh['id']}, Title: {wh['title']}, StartTime: {wh['start_time']}")
                
                # 查该工时对应的事项明细
                cursor.execute("""
                    SELECT * FROM zdcrm_visit_customer_record 
                    WHERE work_hour_id = %s 
                      AND is_del = '0'
                """, (wh['id'],))
                details = cursor.fetchall()
                print(f"  对应事项明细共: {len(details)} 条")
                for d in details:
                    print(f"    DetailId: {d['id']}, CustomerName: '{d['customer_name']}'")
                    # 做直接的对比
                    print(f"    与 '{customer_name}' 字符串比对结果: {d['customer_name'] == customer_name}")
                    print(f"    字节表示: {d['customer_name'].encode('utf-8')} vs {customer_name.encode('utf-8')}")
                    
    finally:
        conn.close()

if __name__ == "__main__":
    asyncio.run(main())
