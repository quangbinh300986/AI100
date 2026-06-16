import sys
import os

# 将项目根目录加入模块搜索路径，以便能导入 app 模块
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import crm_engine
from sqlalchemy import text

def diagnose():
    print("开始连接 CRM 数据库进行诊断...")
    
    with crm_engine.connect() as conn:
        # 1. 检查表的列信息
        try:
            print("\n--- contract_un_receive_bill_not_receive 表/视图的列信息 ---")
            columns_sql = text("DESCRIBE contract_un_receive_bill_not_receive")
            cols = conn.execute(columns_sql).all()
            for col in cols:
                print(f"列名: {col[0]}, 类型: {col[1]}")
        except Exception as e:
            print(f"获取列信息失败: {e}")

        # 2. 查询丁浩然名下的项目以及发票关联数据
        print("\n--- 查询丁浩然的名下的项目 ---")
        p_sql = text("""
            SELECT id, project_name, project_manager
            FROM project
            WHERE project_manager = '丁浩然'
              AND (project_status IS NULL OR (project_status != '已归档' AND project_status != '已结项'))
        """)
        projects = conn.execute(p_sql).all()
        print(f"活跃项目总数: {len(projects)}")
        for p in projects:
            print(f"项目ID: {p[0]}, 项目名: {p[1]}")

        # 3. 运行原有的 SQL，看输出了多少条记录，并打印出来
        print("\n--- 运行原 SQL 看看输出结果 ---")
        sql = text("""
            SELECT DISTINCT p.project_name, br.bill_money, br.un_account_money, br.bill_create_date, br.contract_id, p.id
            FROM contract_un_receive_bill_not_receive br
            INNER JOIN contract_project cp ON br.contract_id = cp.contract_id
            INNER JOIN project p ON cp.project_id = p.id
            WHERE p.project_manager = '丁浩然'
              AND br.un_account_money > 0
              AND (p.project_status IS NULL OR (p.project_status != '已归档' AND p.project_status != '已结项'))
        """)
        rows = conn.execute(sql).all()
        print(f"原 SQL 返回的记录数: {len(rows)}")
        # 打印丁浩然的前20条记录，看看他们的 contract_id 和 project_id 对应情况
        for i, row in enumerate(rows[:20], 1):
            print(f"{i}: 项目【{row[0]}】(id:{row[5]}), 合同ID: {row[4]}, 开票金额: {row[1]}, 未到账金额: {row[2]}, 开票日期: {row[3]}")

        # 4. 统计丁浩然名下不同的合同以及每一个合同关联了多少个项目
        print("\n--- 统计每一个合同关联的项目数 ---")
        contract_ids = list(set([row[4] for row in rows]))
        if contract_ids:
            for cid in contract_ids:
                cp_count_sql = text("""
                    SELECT COUNT(*), GROUP_CONCAT(p.project_name)
                    FROM contract_project cp
                    JOIN project p ON cp.project_id = p.id
                    WHERE cp.contract_id = :cid
                """)
                count_res = conn.execute(cp_count_sql, {"cid": cid}).first()
                print(f"合同ID: {cid} 关联了 {count_res[0]} 个项目: {count_res[1]}")

if __name__ == "__main__":
    diagnose()
