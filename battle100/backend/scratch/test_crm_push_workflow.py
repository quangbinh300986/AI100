import asyncio
import logging
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User, PositionType, UserRole
from app.api.broadcast import push_broadcast_to_crm_task

# 设置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("battle100_test")

async def test_regex_extraction_logic():
    print("=== 开始测试营销内部播报大文本状态机解析逻辑 ===")
    from app.api.broadcast import push_broadcast_to_crm_task
    
    # 模拟日常工作文本
    content_daily = """【日常工作】
* **区域**：广东省/广州市/越秀区
* **业主单位**：广东省水利厅
* **科/股室**：建管处
* **是否重点**：是 🔴
* **协助人**：林晓, 陈小通
* **当前进展**：
今天下午前往业主单位拜访建管处相关负责人，沟通了百日奋斗项目进展。
明确了本周五提交测算底稿的要求。

* **需协助事项**：
协助完善水利工程造价测算材料"""

    # 模拟回款跟进文本
    content_payment = """【回款跟进】
* **区域**：广东省/深圳市/福田区
* **业主单位**：深圳市规划局
* **科/股室**：财务科
* **关联合同**：2026年度规划技术咨询合同, 福田区水务工程设计合同
* **是否重点**：否
* **当前进展**：
已与财务科负责人完成对接，核对完第二期回款账单。
预计在本月25日左右资金能划拨到账。

* **需协助事项**：
无"""

    # 我们直接借用 push_broadcast_to_crm_task 的行状态机解析逻辑来做演示输出
    # 为了只测试提取逻辑而不实际发 HTTP 请求，我们用一个简化版来测试
    import re
    def run_parser(content, customer_name, cur_user_name):
        lines = content.split('\n')
        parsed_matter_type = "daily_work"
        if "【日常工作】" in content:
            parsed_matter_type = "daily_work"
        elif "【回款跟进】" in content:
            parsed_matter_type = "payment_follow_up"

        region = ""
        customer = customer_name
        section = ""
        is_important = False
        assist_users = []
        contracts = []
        
        progress_lines = []
        help_lines = []
        
        in_progress = False
        in_help = False
        
        for line in lines:
            line_strip = line.strip()
            if not line_strip:
                if in_progress:
                    progress_lines.append("")
                if in_help:
                    help_lines.append("")
                continue
                
            if line_strip.startswith("* **区域**："):
                region = line_strip.replace("* **区域**：", "").strip()
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **业主单位**："):
                if not customer:
                    customer = line_strip.replace("* **业主单位**：", "").strip()
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **科/股室**："):
                section = line_strip.replace("* **科/股室**：", "").strip()
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **是否重点**："):
                is_important = "是" in line_strip
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **协助人**："):
                assist_str = line_strip.replace("* **协助人**：", "").strip()
                if assist_str != "无":
                    assist_users = [name.strip() for name in re.split(r"[,，、\s]+", assist_str) if name.strip()]
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **关联合同**："):
                contract_str = line_strip.replace("* **关联合同**：", "").strip()
                if contract_str != "无":
                    contracts = [c.strip() for c in re.split(r"[,，、]+", contract_str) if c.strip()]
                in_progress = False
                in_help = False
            elif line_strip.startswith("* **当前进展**："):
                in_progress = True
                in_help = False
            elif line_strip.startswith("* **需协助事项**："):
                in_help = True
                in_progress = False
            else:
                if in_progress:
                    progress_lines.append(line)
                elif in_help:
                    help_lines.append(line)

        matter_progress = "\n".join(progress_lines).strip()
        assist_content = "\n".join(help_lines).strip()
        if assist_content == "无" or not assist_content:
            assist_content = ""
            
        project_list = []
        for c in contracts:
            project_list.append({
                "projectId": "",
                "projectName": c
            })
            
        if customer == "未指定":
            customer = "未指定客户"
            
        final_assist_users = [name for name in assist_users if name != cur_user_name]
        
        return {
            "matterType": parsed_matter_type,
            "customerName": customer or "未指定客户",
            "matterProgress": matter_progress,
            "assistUserNames": final_assist_users,
            "assistContent": assist_content,
            "projectList": project_list
        }

    res_daily = run_parser(content_daily, "广东省水利厅", "林晓")
    print("日常工作解析结果：", res_daily)
    assert res_daily["matterType"] == "daily_work"
    assert "今天下午前往业主单位拜访建管处相关负责人" in res_daily["matterProgress"]
    assert res_daily["assistContent"] == "协助完善水利工程造价测算材料"
    # 林晓应该被剔除，只剩下陈小通
    assert "林晓" not in res_daily["assistUserNames"]
    assert "陈小通" in res_daily["assistUserNames"]
    print("日常工作解析测试 [PASS]")

    res_pay = run_parser(content_payment, None, "张三")
    print("回款跟进解析结果：", res_pay)
    assert res_pay["matterType"] == "payment_follow_up"
    assert "已与财务科负责人完成对接" in res_pay["matterProgress"]
    assert res_pay["assistContent"] == ""
    assert res_pay["customerName"] == "深圳市规划局"
    assert len(res_pay["projectList"]) == 2
    assert res_pay["projectList"][0]["projectName"] == "2026年度规划技术咨询合同"
    print("回款跟进解析测试 [PASS]\n")


async def test_real_push_workflow():
    print("=== 开始测试真实数据库角色匹配及推送流程 ===")
    async with AsyncSessionLocal() as db:
        # 1. 查找系统里属于营销岗或目标官的两个用户
        stmt = select(User).where(User.is_active == True)
        res = await db.execute(stmt)
        all_users = res.scalars().all()
        
        marketing_users = [u for u in all_users if u.position_type == PositionType.MARKETING]
        target_officers = [u for u in all_users if u.role == UserRole.TARGET_OFFICER]
        
        print(f"找到系统营销岗用户: {[u.name for u in marketing_users]}")
        print(f"找到系统目标官用户: {[u.name for u in target_officers]}")
        
        test_user1 = None
        test_user2 = None
        
        if marketing_users:
            test_user1 = marketing_users[0]
        if len(marketing_users) > 1:
            test_user2 = marketing_users[1]
        elif target_officers:
            test_user2 = target_officers[0]
            
        if not test_user1 or not test_user2:
            print("测试失败：系统中营销岗/目标官人员不足两个，无法进行铁三角联动打卡测试。")
            return
            
        print(f"测试选定：用户A={test_user1.name} (岗位:{test_user1.position_type}, 角色:{test_user1.role})")
        print(f"测试选定：用户B={test_user2.name} (岗位:{test_user2.position_type}, 角色:{test_user2.role})")

        # 2. 模拟铁三角推送测试 (满足条件，有两人)
        print(f"\n测试：铁三角联动 - {test_user1.name} 播报，且联动了 {test_user2.name}")
        # 该测试将真实向 CRM 发送 POST 请求，观察网络是否通顺、接口能否走通
        await push_broadcast_to_crm_task(
            broadcast_id=9999,
            action_type="triangle",
            event_type="triangle",
            customer_name="铁三角测试业主单位",
            employee_name=test_user1.name,
            action_description="铁三角联合拜访测试业主，洽谈项目前置测算。",
            content="铁三角联合拜访测试业主，洽谈项目前置测算。",
            crm_opportunity_id="test_opp_id",
            project_name="测试铁三角项目",
            marketing_copartners=[test_user2.name]
        )
        
        # 3. 模拟客户幸福动作推送测试 (满足条件，单人)
        print(f"\n测试：客户幸福动作 - {test_user1.name} 播报")
        await push_broadcast_to_crm_task(
            broadcast_id=9998,
            action_type="happiness",
            event_type="happiness",
            customer_name="幸福动作测试业主单位",
            employee_name=test_user1.name,
            action_description="为客户提供前置技术保障方案支持，获得高度认可。",
            content="为客户提供前置技术保障方案支持，获得高度认可。",
            crm_opportunity_id="test_opp_id_2",
            project_name="测试幸福动作项目",
            marketing_copartners=None
        )

        # 4. 模拟营销内部播报推送测试 (日常工作，单人)
        print(f"\n测试：营销内部播报 - {test_user1.name} 播报")
        content_marketing = f"""【日常工作】
* **区域**：广东省/广州市/越秀区
* **业主单位**：水利部珠江委员会
* **科/股室**：无
* **是否重点**：否
* **协助人**：无
* **当前进展**：
测试营销内部播报打卡流程，提交当日工作内容。

* **需协助事项**：
无"""
        await push_broadcast_to_crm_task(
            broadcast_id=9997,
            action_type="marketing_report",
            event_type="marketing_report",
            customer_name="水利部珠江委员会",
            employee_name=test_user1.name,
            action_description=None,
            content=content_marketing,
            crm_opportunity_id=None,
            project_name=None,
            marketing_copartners=None
        )

async def main():
    await test_regex_extraction_logic()
    await test_real_push_workflow()

if __name__ == "__main__":
    asyncio.run(main())
