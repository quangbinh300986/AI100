import sys
import os

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import crm_engine
from sqlalchemy import text

def test_group_by():
    print("开始测试 GROUP BY 去重 SQL...")
    
    with crm_engine.connect() as conn:
        # 1. 运行优化后的 SQL（通过 GROUP BY 进行去重，项目名称使用 MIN 聚合）
        sql = text("""
            SELECT MIN(p.project_name) as project_name, br.bill_money, br.un_account_money, br.bill_create_date
            FROM contract_un_receive_bill_not_receive br
            INNER JOIN contract_project cp ON br.contract_id = cp.contract_id
            INNER JOIN project p ON cp.project_id = p.id
            WHERE p.project_manager = '丁浩然'
              AND br.un_account_money > 0
              AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
            GROUP BY br.contract_id, br.bill_money, br.un_account_money, br.bill_create_date
            ORDER BY br.bill_create_date DESC
        """)
        rows = conn.execute(sql).all()
        print(f"优化后的记录数: {len(rows)}")
        for i, row in enumerate(rows, 1):
            print(f"{i}: 代表项目【{row[0]}】, 开票金额: {row[1]}, 未到账金额: {row[2]}, 开票日期: {row[3]}")

if __name__ == "__main__":
    test_group_by()
