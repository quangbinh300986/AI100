import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    # 直接连接 Supabase 底层的 postgres 数据库
    db_url = "postgresql+asyncpg://postgres:e2bc56caf5860bc0ab930d787730ede4@192.168.101.206:5432/postgres"
    print(f"正在建立与 Supabase 底层 postgres 数据库的连接...")
    
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        print("连接成功！开始查询当前 storage.buckets 列表...")
        try:
            res = await conn.execute(text("SELECT id, name, file_size_limit, public FROM storage.buckets;"))
            rows = res.fetchall()
            for r in rows:
                print(f"==> Bucket ID: {r[0]}, Name: {r[1]}, Limit: {r[2]} 字节, Public: {r[3]}")
                
            print("\n正在将 'photos' 存储桶的最大单文件限制提升为 50MB (52428800 字节)...")
            await conn.execute(text("UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id = 'photos';"))
            
            print("\n更新成功！重新查询以进行确认...")
            res2 = await conn.execute(text("SELECT id, name, file_size_limit, public FROM storage.buckets;"))
            rows2 = res2.fetchall()
            for r in rows2:
                print(f"==> 更新后 Bucket ID: {r[0]}, Name: {r[1]}, Limit: {r[2]} 字节 (约 {r[2]/(1024*1024) if r[2] else '无限制'} MB)")
                
        except Exception as e:
            print(f"执行数据库更新时发生异常: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
