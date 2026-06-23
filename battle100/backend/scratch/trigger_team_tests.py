import asyncio
import sys
import os
import json
import httpx
from dotenv import load_dotenv

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.dingtalk import get_signed_url

# 优先读取 .env
load_dotenv()

async def send_test_message(team_name, config):
    webhook = config.get("webhook")
    secret = config.get("secret", "")
    template_id = config.get("template_id", "")
    
    if not webhook:
        print(f"❌ 战队 {team_name} 没有配置 webhook，跳过测试")
        return False
        
    # 消息内容必须包含安全关键字 "百日奋战周报"
    markdown_text = (
        f"# 📅 【百日奋战周报】机器人连通性调试测试\n"
        f"---  \n"
        f"这里是【**{team_name}**】专属消息通道测试。\n\n"
        f"收到此消息代表该群的自定义机器人 Webhook 与签名 Secret 配置完全正确且网络畅通！\n\n"
        f"* 关联日志模板 ID: `{template_id or '未配置（将回落默认模板）'}`\n\n"
        f"---  \n"
        f"> *您收到此消息后可将其从群聊中手动撤回或清理。感谢您的配合！*"
    )
    
    payload = {
        "msgtype": "actionCard",
        "actionCard": {
            "title": f"【百日奋战周报】机器人调试 - {team_name}",
            "text": markdown_text,
            "btnOrientation": "0",
            "singleTitle": "💻 进入战役作战系统",
            "singleURL": "http://localhost:3100/admin/weekly-reports"
        }
    }
    
    signed_url = get_signed_url(webhook, secret)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(signed_url, json=payload, timeout=10.0)
            if response.status_code == 200:
                res_data = response.json()
                if res_data.get("errcode") == 0:
                    print(f"✅ 战队 {team_name} 测试消息推送成功！")
                    return True
                else:
                    print(f"❌ 战队 {team_name} 推送返回错误: errcode={res_data.get('errcode')}, errmsg={res_data.get('errmsg')}")
            else:
                print(f"❌ 战队 {team_name} 推送失败: status_code={response.status_code}, body={response.text}")
    except Exception as e:
        print(f"❌ 战队 {team_name} 推送时发生网络异常: {e}")
        
    return False

async def main():
    print("===== 开始执行各战队群机器人连通性端到端发送测试 =====")
    env_config = os.getenv("TEAM_WEBHOOKS_JSON")
    
    # 尝试直接读取 .env 文件的所在目录下再次查找
    if not env_config:
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("TEAM_WEBHOOKS_JSON="):
                        val_str = line.strip().split("TEAM_WEBHOOKS_JSON=", 1)[1]
                        # 剥除外层的单引号或双引号
                        if val_str.startswith("'") and val_str.endswith("'"):
                            val_str = val_str[1:-1]
                        elif val_str.startswith('"') and val_str.endswith('"'):
                            val_str = val_str[1:-1]
                        env_config = val_str
                        break
                        
    if not env_config:
        print("错误: 无法获取到 TEAM_WEBHOOKS_JSON 的环境变量或配置值！请确保您已经在服务器的 .env 中保存了该变量。")
        return
        
    try:
        team_webhooks = json.loads(env_config)
    except Exception as e:
        print(f"错误: 无法解析配置，JSON 格式可能不正确: {e}\n输入内容为: {env_config}")
        return
        
    print(f"已加载的战队配置数量: {len(team_webhooks)}")
    
    tasks = []
    for team_name, config in team_webhooks.items():
        tasks.append(send_test_message(team_name, config))
        
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"\n===== 测试完成: 共发送 {len(results)} 个战队，成功 {success_count} 个 =====")

if __name__ == "__main__":
    asyncio.run(main())
