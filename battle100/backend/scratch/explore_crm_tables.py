# -*- coding: utf-8 -*-
import sys
import os
import pymysql

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

def main():
    try:
        conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=10
        )
        cur = conn.cursor(pymysql.cursors.DictCursor)
        
        # 1. 查找所有表名
        cur.execute("SHOW TABLES")
        tables = [list(row.values())[0] for row in cur.fetchall()]
        print("--- CRM 数据库中表总数:", len(tables))
        
        # 2. 搜索表名包含关键字的表
        keywords = ["receive", "receipt", "payment", "money", "remit", "finance", "bank", "汇款", "到账", "款"]
        matched_tables = []
        for table in tables:
            if any(kw in table.lower() for kw in keywords):
                matched_tables.append(table)
        print("\n--- 匹配关键字的表名 ---")
        for mt in matched_tables:
            print(mt)
            
        # 3. 搜索字段或列注释包含“到账”、“汇款”、“银行”相关的表和列
        print("\n--- 查找包含特定字段或列注释的表 ---")
        cur.execute("""
            SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT 
            FROM information_schema.columns 
            WHERE table_schema = %s 
              AND (COLUMN_NAME LIKE '%%bank%%' 
                   OR COLUMN_NAME LIKE '%%remit%%' 
                   OR COLUMN_NAME LIKE '%%receive%%'
                   OR COLUMN_COMMENT LIKE '%%到账%%' 
                   OR COLUMN_COMMENT LIKE '%%汇款%%'
                   OR COLUMN_COMMENT LIKE '%%银行%%'
                   OR COLUMN_COMMENT LIKE '%%回款%%')
        """, (settings.CRM_DB_NAME,))
        columns = cur.fetchall()
        for col in columns[:30]:  # 限制输出 30 条
            print(f"表: {col['TABLE_NAME']}, 列: {col['COLUMN_NAME']}, 注释: {col['COLUMN_COMMENT']}")
            
        # 4. 打印目前使用的 zdcrm_contract_receive_money_view 的前 5 条数据进行结构核对
        if "zdcrm_contract_receive_money_view" in tables:
            print("\n--- zdcrm_contract_receive_money_view 数据样本 (前5条) ---")
            cur.execute("SELECT * FROM zdcrm_contract_receive_money_view LIMIT 5")
            rows = cur.fetchall()
            for r in rows:
                print(r)
        else:
            print("\n未找到 zdcrm_contract_receive_money_view 表/视图")

        # 5. 查找是否有符合第二张图的“到账/汇款记录表”的真实表名和结构
        # 第二张图有列：到账银行、汇款单位、汇款金额、汇款日期、汇款类型、财务备注
        # 我们看看有没有类似 zdcrm_remit_record, zdcrm_bank_arrival, zdcrm_finance_receive 等表
        remit_tables = [t for t in tables if "remit" in t.lower() or "receipt" in t.lower() or "bank" in t.lower() or "arrive" in t.lower() or "remittance" in t.lower()]
        for rt in remit_tables:
            print(f"\n--- 疑似回款表: {rt} 结构与样本 ---")
            cur.execute(f"DESCRIBE {rt}")
            cols_info = cur.fetchall()
            for col in cols_info:
                print(f"  列名: {col['Field']}, 类型: {col['Type']}")
            cur.execute(f"SELECT * FROM {rt} LIMIT 3")
            sample_rows = cur.fetchall()
            for sr in sample_rows:
                print("  样本:", sr)

        cur.close()
        conn.close()
    except Exception as e:
        print("连接或探索失败:", e)

if __name__ == "__main__":
    main()
