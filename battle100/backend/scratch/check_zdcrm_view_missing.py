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
        
        print("--- 检查 2026-06-15 在 contract_account 中的汇款记录 ---")
        cur.execute("""
            SELECT id, account_bank, remittance_dept, remittance_money, remittance_date, remittance_type
            FROM contract_account 
            WHERE remittance_date >= '2026-06-15 00:00:00' AND remittance_date <= '2026-06-15 23:59:59'
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"ID: {r['id']}, 银行: {r['account_bank']}, 单位: {r['remittance_dept']}, 金额: {r['remittance_money']}, 日期: {r['remittance_date']}, 类型: {r['remittance_type']}")
            
        print("\n--- 检查这几笔记录在 zdcrm_contract_receive_money_view 中的匹配情况 ---")
        # 看看 102 万和 59,434.36 万的记录是否在视图中
        cur.execute("""
            SELECT contract_id, contract_name, contract_no, receive_money, receive_date, owner
            FROM zdcrm_contract_receive_money_view
            WHERE receive_date >= '2026-06-15 00:00:00' AND receive_date <= '2026-06-15 23:59:59'
        """)
        rows_view = cur.fetchall()
        print(f"视图中 2026-06-15 的记录数: {len(rows_view)}")
        for rv in rows_view:
            print(f"合同ID: {rv['contract_id']}, 名字: {rv['contract_name']}, 金额: {rv['receive_money']}, 日期: {rv['receive_date']}, 签约人ID/Owner: {rv['owner']}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print("查询失败:", e)

if __name__ == "__main__":
    main()
