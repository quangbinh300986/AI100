import asyncio
import sys
import os

sys.path.append(r"c:\APP\AI100\battle100\backend")

from app.database import AsyncSessionLocal
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        print("正在查询 storage.buckets 列表...")
        try:
            res = await db.execute(text("SELECT id, name, file_size_limit, public, allowed_mime_types FROM storage.buckets;"))
            rows = res.fetchall()
            for r in rows:
                print(f"Bucket ID: {r[0]}")
                print(f"Name: {r[1]}")
                print(f"File Size Limit: {r[2]} 字节 (约 {r[2]/(1024*1024) if r[2] else '无限制'} MB)")
                print(f"Public: {r[3]}")
                print(f"Allowed MIME Types: {r[4]}")
                print("-" * 50)
        except Exception as e:
            print(f"查询 storage.buckets 发生异常: {e}")

if __name__ == "__main__":
    asyncio.run(main())
