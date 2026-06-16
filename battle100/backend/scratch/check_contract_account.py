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
        
        print("--- 查询 contract_account 特定记录 ---")
        cur.execute("""
            SELECT account_bank, remittance_dept, remittance_money, remittance_date, remittance_type
            FROM contract_account 
            WHERE remittance_money = 284000 OR remittance_dept LIKE '%高明%' OR remittance_dept LIKE '%深元%'
        """)
        rows = cur.fetchall()
        for i, r in enumerate(rows):
            print(f"{i+1}: 银行: {r['account_bank']}, 单位: {r['remittance_dept']}, 金额: {r['remittance_money']}, 日期: {r['remittance_date']}, 类型: {r['remittance_type']}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print("查询失败:", e)

if __name__ == "__main__":
    main()
