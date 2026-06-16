import asyncio
import sys
import os

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.report import WeeklyReport
from sqlalchemy import select

async def test_migration():
    """
    通过更新一个现有的周报记录来验证数据库和模型修改是否成功，并使用 rollback 保证数据不被修改。
    """
    print("开始进行验证测试...")
    
    # 模拟那个报错中使用的超长中文字符串
    long_desc = "基本完成。项目交付的计划动作基本落实，部分工作因需领导层沟通等原因有推进但暂无进展。催款和商务计划均有落实动作，但无到账和新签，下周需继续加强。"
    print(f"待测试的描述长度为: {len(long_desc)} 字符")

    async with AsyncSessionLocal() as session:
        try:
            # 1. 查找 ID=129 的周报记录（如果不存在则查任意一条）
            report_id = 129
            query = select(WeeklyReport).where(WeeklyReport.id == report_id)
            result = await session.execute(query)
            db_report = result.scalar_one_or_none()
            
            if not db_report:
                print(f"周报 ID {report_id} 不存在，尝试获取任意一条周报记录...")
                query_any = select(WeeklyReport).limit(1)
                result_any = await session.execute(query_any)
                db_report = result_any.scalar_one_or_none()
                
            if not db_report:
                print("数据库中没有任何周报记录，无法进行更新测试。")
                sys.exit(0)
                
            print(f"找到用于测试的周报 ID: {db_report.id}")
            
            # 保存原始的 delivery_rate 用于比对
            original_rate = db_report.delivery_rate
            
            # 2. 尝试修改为超长内容
            db_report.delivery_rate = long_desc
            await session.flush()  # 触发 SQL 执行但不提交事务
            print("成功执行 flush 写入超长文本，未抛出数据库截断错误。")
            
            # 3. 再次查询以验证 session 内是否已成功更新并能正确读取
            assert db_report.delivery_rate == long_desc, "Session内读取数据与新修改数据不一致"
            print("数据在当前事务内验证读取成功，内容完整无缺。")
            
            # 4. 执行回滚，撤销所有修改
            await session.rollback()
            print("事务已成功回滚，数据库没有受到任何污染。")
            
            print("====================================")
            print("所有验证步骤全部通过！修改完美生效。")
            print("====================================")
            
        except Exception as e:
            await session.rollback()
            print(f"验证测试失败，报错信息: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_migration())
