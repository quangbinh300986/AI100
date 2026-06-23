import asyncio
import sys
import os
from datetime import date, datetime

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.organization import Team
from app.models.user import User, PositionType
from app.models.report import WeeklyReport, ReportStatus
from app.services.dingtalk import send_weekly_report_to_dingtalk
from sqlalchemy import select, delete

async def main():
    async with AsyncSessionLocal() as db:
        # 1. 获取云浮战队实体
        team_stmt = select(Team).where(Team.name == "云浮战队")
        res = await db.execute(team_stmt)
        team = res.scalar_one_or_none()
        if not team:
            print("❌ 数据库中未找到云浮战队！")
            return
            
        print(f"找到战队: {team.name}，ID: {team.id}")
        
        # 2. 寻找云浮战队的一位真实活跃用户（优先选择非管理员）
        user_stmt = select(User).where(User.team_id == team.id, User.is_active == True)
        res_users = await db.execute(user_stmt)
        users = res_users.scalars().all()
        if not users:
            print("❌ 云浮战队下没有找到任何活跃用户！")
            return
            
        # 选择第一个用户进行测试
        target_user = users[0]
        print(f"选择测试真人: 姓名={target_user.name}, ID={target_user.id}, 岗位类型={target_user.position_type}, 钉钉ID={target_user.dingtalk_id}")
        
        # 3. 设定周报的本周时间段（当前周：2026-06-22 至 2026-06-28）
        start_d = date(2026, 6, 22)
        end_d = date(2026, 6, 28)
        
        # 4. 如果已经存在该用户这周的周报，先清理掉，确保是干净的全新插入
        del_stmt = delete(WeeklyReport).where(
            WeeklyReport.user_id == target_user.id,
            WeeklyReport.start_date == start_d,
            WeeklyReport.end_date == end_d
        )
        await db.execute(del_stmt)
        await db.commit()
        
        # 5. 根据岗位的类型，构建真实的周报填报文本
        is_marketing = (
            target_user.position_type == PositionType.MARKETING 
        )
        
        new_report = WeeklyReport(
            user_id=target_user.id,
            start_date=start_d,
            end_date=end_d,
            status=ReportStatus.SUBMITTED,
            submitted_at=datetime.now()
        )
        
        # 准备逼真的内容
        if is_marketing:
            new_report.sales_plan = (
                "1. 推进云浮某项目的销售拜访与客户关系维护，对齐百日奋战指标；\n"
                "2. 跟进项目回款，协助完成云浮三水项目的催款事宜；\n"
                "3. 挖掘云浮地区潜在的新政策与规划项目线索。"
            )
            new_report.sales_actual = (
                "1. 已与云浮局方进行了新一轮的现场技术交流，客户满意度良好；\n"
                "2. 成功协调催回一笔到账，金额约 5.94 万元；\n"
                "3. 已对接上两家规划院，获取了关于下半年专项债方案的初步采购意向。"
            )
            new_report.sales_rate = "100%"
            new_report.sales_highlights = "成功促成了与云浮地区关键客户的百日指标对齐，为下季度业绩奠定基础。"
            new_report.sales_blockers = "部分项目申报流程周期较长，需要耐心跟进。"
            new_report.sales_support = "需要中台技术部门协助提供一份新的政策解读方案材料。"
            new_report.next_sales_plan = (
                "1. 针对新意向项目出具正式的销售报价方案；\n"
                "2. 拜访云浮另一位意向客户，争取签回合同。"
            )
        else:
            new_report.delivery_plan = (
                "1. 完成云浮市各区县百日奋战交付动作，确保系统上线调试无误；\n"
                "2. 协助编写云浮某项目的交付卡点报告；\n"
                "3. 按照计划完成周度项目里程碑汇报材料。"
            )
            new_report.delivery_actual = (
                "1. 现场对云浮系统进行了两轮联调，目前所有核心接口响应时间均正常；\n"
                "2. 已完成并提交了关于项目停滞卡点的分析方案，经评审已基本通过；\n"
                "3. 顺利完成项目里程碑节点汇报，客户方认可度高。"
            )
            new_report.delivery_rate = "100%"
            new_report.delivery_highlights = "克服了对接环境不稳的困难，通过优化配置让系统性能大幅提升。"
            new_report.delivery_blockers = "对接数据源存在些许脏数据，对清洗逻辑造成了干扰，已手动作了处理。"
            new_report.delivery_support = "无"
            new_report.next_delivery_plan = (
                "1. 启动第三期云浮现场用户培训课程；\n"
                "2. 针对系统新收集的需求进行研发对接排期。"
            )
            
        # 6. 保存至数据库
        db.add(new_report)
        await db.commit()
        await db.refresh(new_report)
        
        print(f"✅ 已在数据库中生成该成员的真实周报记录，ID: {new_report.id}")
        
        # 7. 调用钉钉推送逻辑（应自动路由分流至云浮战队群）
        print("🚀 正在触发钉钉周报分流推送测试...")
        try:
            await send_weekly_report_to_dingtalk(new_report, target_user)
            print("🎉 钉钉周报专属群分流推送已完成，请检查云浮战队钉钉群接收情况！")
        except Exception as e_send:
            print(f"❌ 推送失败: {e_send}")

if __name__ == "__main__":
    asyncio.run(main())
