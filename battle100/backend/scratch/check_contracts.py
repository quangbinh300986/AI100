import pymysql
import sys
import os

# 将 backend 根目录加入 path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings

def main():
    print("===== 开始查询 CRM 2026-06-01 之后的已签合同 =====")
    print(f"CRM DB HOST: {settings.CRM_DB_HOST}")
    print(f"CRM DB NAME: {settings.CRM_DB_NAME}")
    
    try:
        conn = pymysql.connect(
            host=settings.CRM_DB_HOST,
            port=settings.CRM_DB_PORT,
            user=settings.CRM_DB_USER,
            password=settings.CRM_DB_PASSWORD,
            database=settings.CRM_DB_NAME,
            charset='utf8mb4',
            connect_timeout=3
        )
        cur = conn.cursor(pymysql.cursors.DictCursor)
        
        query = """
            SELECT COUNT(*) as cnt
            FROM contract c
            WHERE c.status ='0'
              AND c.contract_status IN ('已签订','已验收')
              AND c.signing_date >= '2026-06-01 00:00:00'
        """
        cur.execute(query)
        cnt = cur.fetchone()["cnt"]
        print(f"2026-06-01 之后已签合同总数: {cnt}")
        
        # 看看不加时间限制的合同总数
        query_all = """
            SELECT COUNT(*) as cnt
            FROM contract c
            WHERE c.status ='0'
              AND c.contract_status IN ('已签订','已验收')
        """
        cur.execute(query_all)
        cnt_all = cur.fetchone()["cnt"]
        print(f"不加时间限制的已签合同总数: {cnt_all}")
        
        # 打印几条最近的已签合同看看日期
        query_recent = """
            SELECT c.id, c.contract_name, c.signing_date, c.contract_status
            FROM contract c
            WHERE c.status ='0'
              AND c.contract_status IN ('已签订','已验收')
            ORDER BY c.signing_date DESC
            LIMIT 5
        """
        cur.execute(query_recent)
        recent = cur.fetchall()
        print("\n最近5条已签合同:")
        for r in recent:
            print(f"- ID: {r['id']}, 名字: {r['contract_name']}, 签署时间: {r['signing_date']}, 状态: {r['contract_status']}")
            
        conn.close()
    except Exception as e:
        print(f"查询出错: {e}")

if __name__ == "__main__":
    main()
