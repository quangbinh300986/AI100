import asyncio
import sys
import os
import httpx
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.integrations.dingtalk import dingtalk_client

async def main():
    print("===== 开始获取钉钉日志模板组件定义 =====")
    token = await dingtalk_client._get_access_token()
    params = {"access_token": token}
    
    # 我们用陈小通的钉钉 ID 作为测试
    userid = "15977978767632898"
    template_id = "19eab0d8aa4e349cb1df85146edac9cf"
    
    # 1. 获取用户可见的模板列表
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
        print("获取模板列表失败")
        return
        
    template_list = list_res.get("result", {}).get("template_list", [])
    matched_template = None
    for t in template_list:
        if t.get("report_code") == template_id:
            matched_template = t
            break
            
    if not matched_template:
        print(f"未能在可见列表中找到 template_id={template_id} 的模板！")
        return
        
    template_name = matched_template.get("name")
    print(f"\n匹配到模板名称: [{template_name}], 代码: {template_id}")
    
    # 2. 获取模板详情
    detail_url = f"{dingtalk_client.BASE_URL}/topapi/report/template/getbyname"
    detail_data = {
        "userid": userid,
        "template_name": template_name
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        detail_resp = await client.post(detail_url, params=params, json=detail_data)
        detail_res = detail_resp.json()
        
    if detail_res.get("errcode") == 0:
        fields = detail_res.get("result", {}).get("fields", [])
        output_lines = ["模板组件列表:"]
        for f in fields:
            line = f"- 字段名称 (field_name): '{f.get('field_name')}', 排序 (sort): {f.get('sort')}, 类型 (type): {f.get('type')}"
            output_lines.append(line)
        
        output_content = "\n".join(output_lines)
        # 写入文件
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "template_fields.txt"))
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(output_content)
        print(f"成功将组件列表写入文件: {file_path}")
    else:
        print(f"获取模板详情失败: {detail_res.get('errmsg')}")

if __name__ == "__main__":
    asyncio.run(main())
