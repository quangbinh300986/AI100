import httpx
import asyncio

async def main():
    url = "http://175.178.74.222:18000"
    print(f"正在测试连接 Supabase 服务: {url} ...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=5.0)
            print(f"连接成功！状态码: {resp.status_code}")
            print(f"响应内容: {resp.text[:200]}")
    except Exception as e:
        print(f"连接失败！错误信息: {e}")

if __name__ == "__main__":
    asyncio.run(main())
