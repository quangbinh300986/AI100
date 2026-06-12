import httpx
import json

url = "https://zdcrm.zdpg.com.cn/api/outside/saveWorkHourMatter"
headers = {
    "Content-Type": "application/json;charset=UTF-8",
    "access_token": "battle100_crm_push_token_2026"
}
payload = {
    "userName": "刘训东",
    "belongDate": "2026-06-09",
    "customerName": "测试客户12345",
    "matterType": "daily_work",
    "matterProgress": "测试外部工时推送返回JSON格式调试，耗时1小时。",
    "assistUserNames": [],
    "assistContent": "",
    "projectList": []
}

r = httpx.post(url, headers=headers, json=payload, timeout=10.0)
print("Status Code:", r.status_code)
print("Headers:", dict(r.headers))
print("Body Text:", r.text)
try:
    print("Parsed JSON:", r.json())
except Exception as e:
    print("JSON Parse Error:", e)
