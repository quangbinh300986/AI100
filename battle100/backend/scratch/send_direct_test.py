# -*- coding: utf-8 -*-
import asyncio
import time
import hmac
import hashlib
import base64
import urllib.parse
import httpx

async def main():
    webhook_url = "https://oapi.dingtalk.com/robot/send?access_token=5bd92dbee70063fe2033d880524ecb7c78cbcfcc58a659a98cf7d9d0f1e0e516"
    secret = "SEC8c0ac0f5f3a6e65ddbfa23ee98c1bb00ceee149d251d7e3325315e038d0ae6dd"
    
    # 关键字：政策文件播报 （必须要包含这个以通过安全验证）
    keyword_tag = "【政策文件播报 | 格式测试】"
    password = "q2@PE2EmnaKx"
    
    markdown_text = f"### {keyword_tag} 密码复制格式对比测试\n\n"
    markdown_text += f"---\n"
    
    # 格式 1：原有的反引号格式（无空格隔开）
    markdown_text += f"* **格式 1 (当前 - 无空格)**：`{password}`\n"
    
    # 格式 2：反引号格式，但是前后各加一个半角空格
    markdown_text += f"* **格式 2 (带半角空格)**： `{password}` \n"
    
    # 格式 3：密码独立在一行，采用单行代码块
    markdown_text += f"* **格式 3 (独立行单行代码块)**：\n`{password}`\n"
    
    # 格式 4：密码使用多行代码块包裹
    markdown_text += f"* **格式 4 (多行代码块)**：\n```\n{password}\n```\n"
    
    # 格式 5：加粗格式（以前的老格式，对比用）
    markdown_text += f"* **格式 5 (加粗无代码块)**：**{password}**\n"
    
    markdown_text += f"---\n\n"
    markdown_text += "请在钉钉客户端（包括电脑端和手机端）测试以上 5 种格式中，哪一种双击密码时可以**精准选中且不粘连前后文字/标点**。\n"

    # 签名逻辑
    url = webhook_url
    if secret:
        timestamp = str(round(time.time() * 1000))
        secret_enc = secret.encode('utf-8')
        string_to_sign = f"{timestamp}\n{secret}"
        string_to_sign_enc = string_to_sign.encode('utf-8')
        hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        url = f"{url}&timestamp={timestamp}&sign={sign}"

    json_data = {
        "msgtype": "actionCard",
        "actionCard": {
            "title": f"{keyword_tag} 密码复制格式测试",
            "text": markdown_text,
            "btnOrientation": "1",
            "btns": [
                {
                    "title": "查看测试说明",
                    "actionURL": "https://oapi.dingtalk.com"
                }
            ]
        }
    }

    print("正在发送请求到钉钉 Webhook...")
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(url, json=json_data)
        data = response.json()
        print("响应结果：", data)

if __name__ == "__main__":
    asyncio.run(main())
