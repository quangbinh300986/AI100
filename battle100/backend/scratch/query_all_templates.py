import asyncio
import sys
import os
import httpx
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.integrations.dingtalk import dingtalk_client

async def main():
    token = await dingtalk_client._get_access_token()
    params = {"access_token": token}
    
    # 采用陈小通的钉钉 ID 作为测试
    userid = "15977978767632898"
    
    list_url = f"{dingtalk_client.BASE_URL}/topapi/report/template/listbyuserid"
    list_data = {
        "userid": userid,
        "offset": 0,
        "size": 100
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        list_resp = await client.post(list_url, params=params, json=list_data)
        list_res = list_resp.json()
        
    if list_res.get("errcode") != 0:
        print(f"获取模板列表失败: {list_res.get('errmsg')}")
        return
        
    template_list = list_res.get("result", {}).get("template_list", [])
    
    output_lines = []
    for t in template_list:
        line = f"模板名称: {t.get('name')} | report_code (template_id): {t.get('report_code')}"
        output_lines.append(line)
        
    output_content = "\n".join(output_lines)
    
    # 写入文件，采用 utf-8 编码防乱码
    file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "all_templates.txt"))
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(output_content)
    print(f"模板列表已成功以 UTF-8 写入: {file_path}")

if __name__ == "__main__":
    asyncio.run(main())
