import asyncio
import sys
import os
from datetime import date

sys.path.append(r"c:\APP\AI100\battle100\backend")

from app.database import AsyncSessionLocal
from app.models.organization import Team
from app.models.goal import WeeklyTarget
from app.api.dashboard import get_team_weekly_marketing_actual, get_team_weekly_delivery_actual
from sqlalchemy import select, func

async def main():
    async with AsyncSessionLocal() as db:
        # 查询清远战队 (ID: 1 或者根据名字找)
        t_res = await db.execute(select(Team).where(Team.name.like("%清远%")))
        team = t_res.scalar_one_or_none()
        if not team:
            print("找不到清远战队！")
            return
            
        print(f"找到战队: {team.name} (ID: {team.id})")
        
        # 按照刚刚修改的代码逻辑：
        # 当前为第 2 周，所以我们看第 1 周的累计 (week_number < 2，即 week_number == 1)
        # 第 1 周的时间范围是 2026.6.1 到 2026.6.7
        start_date = date(2026, 6, 1)
        end_date = date(2026, 6, 7)
        
        m_actual_last = await get_team_weekly_marketing_actual(db, start_date, end_date, team.id)
        d_actual_last = await get_team_weekly_delivery_actual(db, start_date, end_date, team.id)
        
        target_stmt = select(
            func.coalesce(func.sum(WeeklyTarget.marketing_base_target), 0),
            func.coalesce(func.sum(WeeklyTarget.delivery_base_target), 0)
        ).where(
            WeeklyTarget.team_id == team.id,
            WeeklyTarget.week_number < 2
        )
        target_res = await db.execute(target_stmt)
        m_target_last, d_target_last = target_res.one()
        m_target_last = float(m_target_last)
        d_target_last = float(d_target_last)
        
        print(f"上周 (第 1 周) 累计实际数据：")
        print(f"  营销实际: {m_actual_last} 万")
        print(f"  交付实际: {d_actual_last} 万")
        print(f"上周 (第 1 周) 累计目标数据 (保底目标)：")
        print(f"  营销目标: {m_target_last} 万")
        print(f"  交付目标: {d_target_last} 万")
        
        if m_target_last > 0:
            total_target = m_target_last + d_target_last
            pct = (m_actual_last + d_actual_last) / total_target * 100 if total_target > 0 else 0.0
            print(f"计算有营销目标公式: ({m_actual_last} + {d_actual_last}) / ({m_target_last} + {d_target_last}) * 100% = {pct}%")
        else:
            pct = d_actual_last / d_target_last * 100 if d_target_last > 0 else 0.0
            print(f"计算无营销目标公式: {d_actual_last} / {d_target_last} * 100% = {pct}%")
            
        light = "red"
        if pct >= 80.0:
            light = "green"
        elif pct >= 50.0:
            light = "yellow"
        else:
            light = "red"
            
        print(f"==> 判定灯色为: {light}")

if __name__ == "__main__":
    asyncio.run(main())
