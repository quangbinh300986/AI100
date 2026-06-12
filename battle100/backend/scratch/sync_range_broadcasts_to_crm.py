import asyncio
import re
import logging
import pymysql
import httpx
from datetime import datetime, time, timedelta
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.broadcast import BroadcastEvent
from app.models.user import User as DbUser, PositionType, UserRole

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger("sync_range_broadcasts")

# 外部 CRM MySQL 只读数据库连接配置
CRM_DB_CONFIG = {
    "host": "10.40.0.56",
    "port": 3307,
    "user": "gzzdpm_read",
    "password": "cf6jx529KQ",
    "database": "gzzdpm",
    "charset": "utf8mb4"
}

# 外部 CRM API 保存接口及 Token
CRM_API_URL = "https://zdcrm.zdpg.com.cn/api/outside/saveWorkHourMatter"
ACCESS_TOKEN = "battle100_crm_push_token_2026"

# DRY_RUN 模式：若为 True，仅查重和模拟，不发起真实推送 API 请求
DRY_RUN = False

async def check_crm_exists(cursor, employee_name: str, belong_date: str, customer_name: str) -> bool:
    """
    检查外部 CRM 数据库中，对应用户在对应日期针对对应客户，是否已经存在工时事项记录。
    """
    if not customer_name:
        customer_name = "未定客户"
        
    # 1. 查找用户在 CRM 中的 user_code
    cursor.execute("SELECT user_code FROM js_sys_user WHERE user_name = %s AND status = '0' LIMIT 1", (employee_name,))
    user_row = cursor.fetchone()
    if not user_row:
        logger.warning(f"查重提示：未在外部 CRM 用户表中找到激活的中文用户【{employee_name}】")
        return False
    user_code = user_row["user_code"]
    
    # 2. 查询是否存在相同客户名称的工时事项记录（去掉 is_del 限制，防止因 CRM 后台批量置为 1 后导致二次重复推送）
    start_dt = f"{belong_date} 00:00:00"
    end_dt = (datetime.strptime(belong_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
    
    sql = """
        SELECT COUNT(*) as cnt 
        FROM zdcrm_visit_customer_record r
        JOIN zdcrm_visit_work_hour_record h ON r.work_hour_id = h.id
        WHERE h.user_id = %s 
          AND h.start_time >= %s 
          AND h.start_time < %s
          AND (r.customer_name = %s OR r.customer_name = %s)
    """
    cursor.execute(sql, (user_code, start_dt, end_dt, customer_name, customer_name.replace("（", "(").replace("）", ")")))
    row = cursor.fetchone()
    return row and row["cnt"] > 0

async def push_to_crm(client: httpx.AsyncClient, payload: dict) -> bool:
    """
    向外部 CRM 接口推送打卡数据，支持自动重试
    """
    headers = {
        "access_token": ACCESS_TOKEN,
        "Content-Type": "application/json;charset=UTF-8"
    }
    
    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            resp = await client.post(CRM_API_URL, json=payload, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                res_json = resp.json()
                # 兼容真实成功的响应判定 (真实 CRM API 在写入成功后，返回结果包含 code: 1 且 result: "true")
                if res_json.get("code") == 1 or res_json.get("result") == "true":
                    return True
                else:
                    logger.error(f"CRM 接口返回错误。Payload: {payload}, Response: {res_json}")
            else:
                logger.error(f"CRM 接口网络响应非 200。HTTP Status: {resp.status_code}, Response: {resp.text}")
        except Exception as e:
            logger.error(f"推送请求异常。Attempt: {attempt+1}, Error: {e}")
            
        if attempt < max_retries:
            await asyncio.sleep(1.0) # 遇错后等待 1 秒重试
            
    return False

async def sync_range():
    logger.info(f"=== 开始历史数据补推到 CRM ===")
    logger.info(f"模式：{'[干跑/只读模拟] DRY_RUN = True' if DRY_RUN else '[正式推送] DRY_RUN = False'}")
    
    # 6月1日 00:00:00 至 6月9日 23:59:59
    start_time = datetime(2026, 6, 1, 0, 0, 0)
    end_time = datetime(2026, 6, 9, 23, 59, 59)
    
    # 初始化统计指标
    stats = {
        "total_broadcasts": 0,
        "pushed_requests": 0,
        "success_requests": 0,
        "skipped_requests": 0,
        "failed_requests": 0
    }
    
    # 建立与外部 CRM MySQL 的只读连接
    conn = pymysql.connect(**CRM_DB_CONFIG)
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    
    # 建立 HTTPX 客户端 (加入 Connection pool 以优化大批量请求)
    async with httpx.AsyncClient(limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)) as client, \
               AsyncSessionLocal() as db:
        try:
            # 1. 查找指定范围的所有未软删除播报，包含关联用户中文名
            stmt = select(BroadcastEvent, DbUser.name.label("user_real_name"))\
                .outerjoin(DbUser, BroadcastEvent.user_id == DbUser.id)\
                .where(
                    BroadcastEvent.created_at >= start_time,
                    BroadcastEvent.created_at <= end_time,
                    BroadcastEvent.is_deleted == False,
                    BroadcastEvent.event_type.in_(["triangle", "happiness", "marketing_report"])
                ).order_by(BroadcastEvent.created_at.asc())
            res = await db.execute(stmt)
            rows = res.all()
            
            stats["total_broadcasts"] = len(rows)
            logger.info(f"符合类型且在时间范围内的播报共计: {len(rows)} 条")
            
            for idx, row in enumerate(rows, 1):
                event, user_real_name = row
                event_type = event.event_type
                belong_date = event.created_at.strftime("%Y-%m-%d")
                
                logger.info(f"[{idx}/{len(rows)}] 正在处理播报 ID: {event.id}, 类型: {event_type}, 日期: {belong_date}")
                
                # 2. 还原播报人姓名 employee_name
                employee_name = user_real_name
                if not employee_name and event.content:
                    emp_match = re.search(r"我司【([^】]+)】", event.content)
                    if emp_match:
                        employee_name = emp_match.group(1).strip()
                if not employee_name:
                    employee_name = "未知用户"
                    
                # 3. 还原业主单位 customer_name
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
                            
                # 4. 还原动作描述 action_description
                action_description = None
                if event_type == "triangle" and event.content:
                    desc_match = re.search(r"联动动作：([^\n]+)", event.content)
                    if desc_match:
                        action_description = desc_match.group(1).strip()
                elif event_type == "happiness" and event.content:
                    desc_match = re.search(r"动作描述：([^\n]+)", event.content)
                    if desc_match:
                        action_description = desc_match.group(1).strip()
                        
                # 5. 还原营销联动人 marketing_copartners
                marketing_copartners = []
                if event_type == "triangle" and event.content:
                    m_match = re.search(r"营销人员\(([^)]+)\)", event.content)
                    if m_match:
                        copartners_str = m_match.group(1).strip()
                        if copartners_str and copartners_str != "无":
                            marketing_copartners = [name.strip() for name in re.split(r"[,，、\s]+", copartners_str) if name.strip()]
                
                # 6. 确定推送候选人 (岗位过滤)
                users_to_push = []
                try:
                    if event_type == "triangle":
                        all_candidates = list(set([employee_name] + (marketing_copartners or [])))
                        stmt_u = select(DbUser).where(DbUser.name.in_(all_candidates), DbUser.is_active == True)
                        res_u = await db.execute(stmt_u)
                        db_users = res_u.scalars().all()
                        for u in db_users:
                            if (
                                u.position_type == PositionType.MARKETING or 
                                u.role == UserRole.TARGET_OFFICER or
                                u.role == UserRole.ADMIN
                            ):
                                users_to_push.append(u)
                    elif event_type == "happiness":
                        stmt_u = select(DbUser).where(DbUser.name == employee_name, DbUser.is_active == True)
                        res_u = await db.execute(stmt_u)
                        user = res_u.scalar_one_or_none()
                        if user and (
                            user.position_type == PositionType.MARKETING or 
                            user.role == UserRole.TARGET_OFFICER or
                            user.role == UserRole.ADMIN
                        ):
                            users_to_push.append(user)
                    elif event_type == "marketing_report":
                        stmt_u = select(DbUser).where(DbUser.name == employee_name, DbUser.is_active == True)
                        res_u = await db.execute(stmt_u)
                        user = res_u.scalar_one_or_none()
                        if user:
                            users_to_push.append(user)
                        else:
                            # 匿名的兜底类
                            class FakeUser:
                                name = employee_name
                            users_to_push.append(FakeUser())
                except Exception as query_err:
                    logger.error(f"还原岗位信息异常，跳过此条播报 ID: {event.id}. 错误: {query_err}")
                    continue
                    
                if not users_to_push:
                    logger.info(f"  播报 ID: {event.id} 无符合打卡条件的营销人员，跳过。")
                    continue
                    
                # 7. 逐个候选人进行查重和推送
                for u in users_to_push:
                    cur_user_name = u.name
                    stats["pushed_requests"] += 1
                    
                    # 查重校验
                    is_duplicate = await check_crm_exists(cursor, cur_user_name, belong_date, customer_name)
                    if is_duplicate:
                        logger.info(f"  [查重跳过] 用户【{cur_user_name}】在 {belong_date} 对客户【{customer_name or '未定客户'}】已存在CRM记录")
                        stats["skipped_requests"] += 1
                        continue
                        
                    # 构造打卡 Payload
                    payload = {}
                    if event_type == "triangle":
                        partners = [name for name in (marketing_copartners or []) if name != cur_user_name]
                        project_list = []
                        if event.project_name and event.project_name != "未定":
                            project_list.append({
                                "projectId": event.crm_opportunity_id or "",
                                "projectName": event.project_name
                            })
                        payload = {
                            "userName": cur_user_name,
                            "belongDate": belong_date,
                            "customerName": customer_name or "未定客户",
                            "matterType": "business_expansion",
                            "matterProgress": action_description or event.content,
                            "assistUserNames": partners,
                            "assistContent": "",
                            "projectList": project_list
                        }
                    elif event_type == "happiness":
                        project_list = []
                        if event.project_name and event.project_name != "未定":
                            project_list.append({
                                "projectId": event.crm_opportunity_id or "",
                                "projectName": event.project_name
                            })
                        payload = {
                            "userName": cur_user_name,
                            "belongDate": belong_date,
                            "customerName": customer_name or "客户幸福关怀单位",
                            "matterType": "customer_maintenance",
                            "matterProgress": action_description or event.content,
                            "assistUserNames": [],
                            "assistContent": "",
                            "projectList": project_list
                        }
                    elif event_type == "marketing_report":
                        # 内部播报采用行解析逻辑
                        lines = event.content.split('\n')
                        parsed_matter_type = "daily_work"
                        if "【日常工作】" in event.content:
                            parsed_matter_type = "daily_work"
                        elif "【回款跟进】" in event.content:
                            parsed_matter_type = "payment_follow_up"
                            
                        # 进行简要解析，模拟 broadcast.py 中相同的规则
                        region = ""
                        cust = customer_name
                        progress_lines = []
                        help_lines = []
                        in_progress = False
                        in_help = False
                        assist_users = []
                        
                        for line in lines:
                            line_strip = line.strip()
                            if not line_strip:
                                continue
                            if line_strip.startswith("##"):
                                in_progress = False
                                in_help = False
                            if "战区" in line_strip:
                                r_match = re.search(r"：\s*([^\n]+)", line_strip)
                                if r_match:
                                    region = r_match.group(1).strip()
                            elif "协助人" in line_strip:
                                a_match = re.search(r"：\s*([^\n]+)", line_strip)
                                if a_match:
                                    ast_str = a_match.group(1).strip()
                                    if ast_str and ast_str != "无":
                                        assist_users = [n.strip() for n in re.split(r"[,，、\s]+", ast_str) if n.strip()]
                            elif "当前进展" in line_strip or "工作进展" in line_strip:
                                in_progress = True
                                in_help = False
                                continue
                            elif "需协助事项" in line_strip or "协调事项" in line_strip:
                                in_progress = False
                                in_help = True
                                continue
                                
                            if in_progress:
                                progress_lines.append(line_strip)
                            elif in_help:
                                help_lines.append(line_strip)
                                
                        progress_content = "\n".join(progress_lines).strip() if progress_lines else event.content
                        help_content = "\n".join(help_lines).strip() if help_lines else ""
                        
                        payload = {
                            "userName": cur_user_name,
                            "belongDate": belong_date,
                            "customerName": cust or "日常工作客户",
                            "matterType": parsed_matter_type,
                            "matterProgress": progress_content,
                            "assistUserNames": assist_users,
                            "assistContent": help_content,
                            "projectList": []
                        }
                        
                    # 执行推送 (DRY_RUN 仅模拟，不发 POST 也不睡眠)
                    if DRY_RUN:
                        logger.info(f"  [干跑模拟] 将向 CRM 接口推送打卡请求: 用户【{cur_user_name}】")
                        stats["success_requests"] += 1
                    else:
                        logger.info(f"  [正式推送] 正在向 CRM 接口推送打卡请求: 用户【{cur_user_name}】")
                        success = await push_to_crm(client, payload)
                        if success:
                            logger.info(f"  [推送成功] 用户【{cur_user_name}】")
                            stats["success_requests"] += 1
                        else:
                            logger.error(f"  [推送失败] 用户【{cur_user_name}】")
                            stats["failed_requests"] += 1
                        # 串行限流控制，避免过多调用引发服务端拥堵
                        await asyncio.sleep(0.1)
                        
        finally:
            cursor.close()
            conn.close()
            
    # 输出本次汇总报告
    logger.info("=== 补推任务运行报告 ===")
    logger.info(f"处理本地播报总数: {stats['total_broadcasts']} 条")
    logger.info(f"生成打卡请求总数: {stats['pushed_requests']} 个")
    logger.info(f"  - 推送成功: {stats['success_requests']} 个")
    logger.info(f"  - 因查重跳过: {stats['skipped_requests']} 个")
    logger.info(f"  - 推送失败: {stats['failed_requests']} 个")

if __name__ == "__main__":
    asyncio.run(sync_range())
