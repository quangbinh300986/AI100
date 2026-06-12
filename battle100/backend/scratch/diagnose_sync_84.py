import asyncio
import sys
import os
import httpx
import json

# 将 backend 根目录加入 path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.config import settings
from app.models.user import User as DbUser
from app.models.report import WeeklyReport
from app.integrations.dingtalk import dingtalk_client
from app.database import AsyncSessionLocal

async def test_api_call(token, template_id, userid, contents, to_userids):
    url = f"{dingtalk_client.BASE_URL}/topapi/report/create"
    params = {"access_token": token}
    json_data = {
        "create_report_param": {
            "template_id": template_id,
            "userid": userid,
            "contents": contents,
            "to_userids": to_userids,
            "to_chat": False,
            "dd_from": "battle100"
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, params=params, json=json_data)
            return response.json()
    except Exception as e:
        return {"exception": str(e)}

async def main():
    print("===== 开始诊断周报 84 的钉钉同步流程 =====")
    
    # 1. 提取 token
    token = await dingtalk_client._get_access_token()
    print(f"Token: {token[:10]}...")
    
    # 2. 查询周报 64 和相关用户
    async with AsyncSessionLocal() as db:
        stmt = select(WeeklyReport).where(WeeklyReport.id == 64)
        res = await db.execute(stmt)
        report = res.scalar_one_or_none()
        if not report:
            print("找不到周报 64")
            return
            
        print(f"周报 64 找到。开始日期: {report.start_date}, 结束日期: {report.end_date}, 用户 ID: {report.user_id}")
        
        db_user_stmt = select(DbUser).where(DbUser.id == report.user_id)
        db_user_res = await db.execute(db_user_stmt)
        db_user = db_user_res.scalar_one_or_none()
        if not db_user:
            print("找不到对应的用户")
            return
            
        print(f"提报用户: {db_user.name}, 手机: {db_user.phone}, 钉钉 ID: '{db_user.dingtalk_id}'")
        
        # 计算 to_userids，同 reports.py
        dingtalk_userid = db_user.dingtalk_id
        to_userids = []
        if dingtalk_userid:
            to_userids.append(dingtalk_userid)
            
        stmt_admins = select(DbUser.dingtalk_id).where(
            DbUser.role == "admin",
            DbUser.dingtalk_id.isnot(None),
            DbUser.dingtalk_id != ""
        )
        res_admins = await db.execute(stmt_admins)
        admin_ids = res_admins.scalars().all()
        to_userids.extend(admin_ids)
        
        has_third_bar = db_user.third_class_bar and db_user.third_class_bar.strip() != "" and db_user.third_class_bar.strip().lower() != "all"
        if has_third_bar:
            stmt_teammates = select(DbUser.dingtalk_id).where(
                DbUser.third_class_bar == db_user.third_class_bar.strip(),
                DbUser.dingtalk_id.isnot(None),
                DbUser.dingtalk_id != ""
            )
            res_teammates = await db.execute(stmt_teammates)
            teammate_ids = res_teammates.scalars().all()
            to_userids.extend(teammate_ids)
        elif db_user.team_id:
            stmt_teammates = select(DbUser.dingtalk_id).where(
                DbUser.team_id == db_user.team_id,
                DbUser.dingtalk_id.isnot(None),
                DbUser.dingtalk_id != ""
            )
            res_teammates = await db.execute(stmt_teammates)
            teammate_ids = res_teammates.scalars().all()
            to_userids.extend(teammate_ids)
            
        to_userids = list(set([uid for uid in to_userids if uid and uid != dingtalk_userid]))
        print(f"计算出的接收人 to_userids 列表: {to_userids}")
        
        # 组装 contents
        print(f"\n--- 周报字段值详情 ---")
        print(f"delivery_plan: '{report.delivery_plan}'")
        print(f"sales_plan: '{report.sales_plan}'")
        print(f"delivery_actual: '{report.delivery_actual}'")
        print(f"sales_actual: '{report.sales_actual}'")
        print(f"delivery_rate: '{report.delivery_rate}'")
        print(f"sales_rate: '{report.sales_rate}'")
        print(f"delivery_highlights: '{report.delivery_highlights}'")
        print(f"sales_highlights: '{report.sales_highlights}'")
        print(f"delivery_blockers: '{report.delivery_blockers}'")
        print(f"sales_blockers: '{report.sales_blockers}'")
        print(f"delivery_support: '{report.delivery_support}'")
        print(f"sales_support: '{report.sales_support}'")
        print(f"next_delivery_plan: '{report.next_delivery_plan}'")
        print(f"next_sales_plan: '{report.next_sales_plan}'")
        
        is_marketing = db_user.position_type == "marketing"
        print(f"当前用户 position_type: '{db_user.position_type}', is_marketing: {is_marketing}")
        
        plan_val = report.sales_plan if is_marketing else report.delivery_plan
        actual_val = report.sales_actual if is_marketing else report.delivery_actual
        rate_val = report.sales_rate if is_marketing else report.delivery_rate
        highlights_val = report.sales_highlights if is_marketing else report.delivery_highlights
        blockers_val = report.sales_blockers if is_marketing else report.delivery_blockers
        support_val = report.sales_support if is_marketing else report.delivery_support
        next_plan_val = report.next_sales_plan if is_marketing else report.next_delivery_plan
        
        start_date_str = report.start_date.strftime('%Y-%m-%d')
        end_date_str = report.end_date.strftime('%Y-%m-%d')
        date_range_str = f"{start_date_str}至{end_date_str}"
        
        contents_source = [
            {"key": "周报日期", "value": date_range_str},
            {"key": "本周目标计划", "value": plan_val or ""},
            {"key": "本周实际完成", "value": actual_val or ""},
            {"key": "达成情况", "value": rate_val or ""},
            {"key": "本周亮点", "value": highlights_val or ""},
            {"key": "本周卡点", "value": blockers_val or ""},
            {"key": "是否需要上级支持", "value": support_val or ""},
            {"key": "下周目标", "value": next_plan_val or ""}
        ]
        
        sort_map = {
            "本周目标计划": 1,
            "本周实际完成": 2,
            "达成情况": 3,
            "本周亮点": 4,
            "本周卡点": 5,
            "是否需要上级支持": 6,
            "下周目标": 7,
            "周报日期": 8
        }
        
        formatted_contents = []
        for i, c in enumerate(contents_source):
            formatted_contents.append({
                "key": c.get("key"),
                "content": c.get("value"),
                "sort": sort_map.get(c.get("key"), 1),
                "type": 1,
                "content_type": "markdown"
            })
            
        print("\n最终发送的 formatted_contents:")
        print(json.dumps(formatted_contents, ensure_ascii=False, indent=2))
            
        # 测试 1: 原 template_id 和原 to_userids
        orig_template_id = "19cab0d8aa4c349cb1df85146edac9cf"
        print(f"\n--- 测试 1: 原 template_id ({orig_template_id}) + 包含 to_userids ---")
        res1 = await test_api_call(token, orig_template_id, dingtalk_userid, formatted_contents, to_userids)
        print(f"结果: {json.dumps(res1, ensure_ascii=False)}")
        
        # 测试 2: 原 template_id，空 to_userids (排查是不是因为某个队友的 dingtalk_id 是无效的)
        print(f"\n--- 测试 2: 原 template_id ({orig_template_id}) + 空 to_userids ---")
        res2 = await test_api_call(token, orig_template_id, dingtalk_userid, formatted_contents, [])
        print(f"结果: {json.dumps(res2, ensure_ascii=False)}")
        
        # 测试 3: 格式化后的 template_id (加中横线)，包含 to_userids
        # UUID 32位无横线转36位带横线: 19cab0d8-aa4c-349c-b1df-85146edac9cf
        formatted_template_id = f"{orig_template_id[:8]}-{orig_template_id[8:12]}-{orig_template_id[12:16]}-{orig_template_id[16:20]}-{orig_template_id[20:]}"
        print(f"\n--- 测试 3: 格式化后 template_id ({formatted_template_id}) + 包含 to_userids ---")
        res3 = await test_api_call(token, formatted_template_id, dingtalk_userid, formatted_contents, to_userids)
        print(f"结果: {json.dumps(res3, ensure_ascii=False)}")
        
        # 测试 4: 格式化后的 template_id，空 to_userids
        print(f"\n--- 测试 4: 格式化后 template_id ({formatted_template_id}) + 空 to_userids ---")
        res4 = await test_api_call(token, formatted_template_id, dingtalk_userid, formatted_contents, [])
        print(f"结果: {json.dumps(res4, ensure_ascii=False)}")

        # 使用 "value" 重新构造 contents
        value_contents = []
        for i, c in enumerate(contents_source):
            value_contents.append({
                "key": c.get("key"),
                "value": c.get("value"),
                "sort": i + 1,
                "type": 1,
                "content_type": "markdown"
            })

        # 测试 5: 使用 value 字段 + 原 template_id
        print(f"\n--- 测试 5: 使用 value 字段 + 原 template_id ({orig_template_id}) + 空 to_userids ---")
        res5 = await test_api_call(token, orig_template_id, dingtalk_userid, value_contents, [])
        print(f"结果: {json.dumps(res5, ensure_ascii=False)}")

        # 测试 6: 使用 value 字段 + 格式化后 template_id
        print(f"\n--- 测试 6: 使用 value 字段 + 格式化后 template_id ({formatted_template_id}) + 空 to_userids ---")
        res6 = await test_api_call(token, formatted_template_id, dingtalk_userid, value_contents, [])
        print(f"结果: {json.dumps(res6, ensure_ascii=False)}")

        # 测试 7: 使用正确的 template_id + 包含 to_userids
        correct_template_id = "19eab0d8aa4e349cb1df85146edac9cf"
        print(f"\n--- 测试 7: 使用正确的 template_id ({correct_template_id}) + 包含 to_userids ---")
        res7 = await test_api_call(token, correct_template_id, dingtalk_userid, formatted_contents, to_userids)
        print(f"结果: {json.dumps(res7, ensure_ascii=False)}")

        # 测试 8: 使用正确的 template_id + 空 to_userids
        print(f"\n--- 测试 8: 使用正确的 template_id ({correct_template_id}) + 空 to_userids ---")
        res8 = await test_api_call(token, correct_template_id, dingtalk_userid, formatted_contents, [])
        print(f"结果: {json.dumps(res8, ensure_ascii=False)}")

if __name__ == "__main__":
    asyncio.run(main())
