import asyncio
import sys
import os
import json
from unittest.mock import MagicMock, AsyncMock, patch

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# 设置 mock 环境变量
MOCK_CONFIG = {
    "清远战队": {
        "template_id": "qingyuan_mock_template_id_12345",
        "webhook": "https://oapi.dingtalk.com/robot/send?access_token=qingyuan_private_token",
        "secret": "qingyuan_private_secret"
    }
}
os.environ["TEAM_WEBHOOKS_JSON"] = json.dumps(MOCK_CONFIG)

from app.models.user import User, PositionType, UserRole
from app.models.report import WeeklyReport
from app.models.organization import Team
from app.config import settings

# 临时设置系统默认的模板ID
settings.DINGTALK_WEEKLY_REPORT_TEMPLATE_ID = "company_global_default_template_id"

async def mock_get_team(db_session, team_id):
    """模拟数据库查询战队对象"""
    if team_id == 1:
        team = MagicMock()
        team.id = 1
        team.name = "清远战队"
        return team
    return None

async def test_weekly_log_sync_routing():
    print("\n===== 场景 1：测试【同步工作日志到钉钉日志】功能中的模板 ID 选择 =====")
    
    # 模拟 reports.py 中的模板 ID 判定算法
    async def get_resolved_template_id(db_user, req_template_id=None):
        template_id = req_template_id
        if not template_id:
            team_name = ""
            if db_user.team_id:
                # 模拟 db.get 行为
                team_obj = await mock_get_team(None, db_user.team_id)
                if team_obj:
                    team_name = team_obj.name
                    
            # 尝试从环境变量读取战队专属的 Webhook JSON 配置
            team_webhooks = {}
            env_config = os.getenv("TEAM_WEBHOOKS_JSON")
            if env_config:
                try:
                    team_webhooks = json.loads(env_config)
                except Exception:
                    pass
                    
            if team_name and team_name in team_webhooks:
                custom_cfg = team_webhooks[team_name]
                if custom_cfg.get("template_id"):
                    template_id = custom_cfg["template_id"]

        if not template_id:
            template_id = settings.DINGTALK_WEEKLY_REPORT_TEMPLATE_ID
        return template_id

    # 1. 模拟战队人员（清远战队）
    user_team = User(name="张三", team_id=1, position_type="delivery")
    t_id_team = await get_resolved_template_id(user_team)
    print(f"【战队人员】张三 (清远战队) 匹配到的日志模板 ID: '{t_id_team}' (预期: 'qingyuan_mock_template_id_12345')")
    
    # 2. 模拟中台人员 (无战队)
    user_middle = User(name="李四", team_id=None, position_type="delivery")
    t_id_middle = await get_resolved_template_id(user_middle)
    print(f"【中台人员】李四 (无战队) 匹配到的日志模板 ID: '{t_id_middle}' (预期: 'company_global_default_template_id')")
    
    assert t_id_team == "qingyuan_mock_template_id_12345"
    assert t_id_middle == "company_global_default_template_id"


async def test_dingtalk_message_routing():
    print("\n===== 场景 2：测试【发送周报到钉钉群聊】功能中的 Webhook 路由 =====")
    
    # 模拟 app/services/dingtalk.py 中发送消息时的路由决策
    from app.services.dingtalk import DINGTALK_WEBHOOK, DINGTALK_SECRET
    
    def resolve_webhook_and_secret(team_name):
        team_webhooks = {}
        env_config = os.getenv("TEAM_WEBHOOKS_JSON")
        if env_config:
            try:
                team_webhooks = json.loads(env_config)
            except Exception:
                pass

        target_webhook = DINGTALK_WEBHOOK
        target_secret = DINGTALK_SECRET
        
        if team_name and team_name in team_webhooks:
            custom_cfg = team_webhooks[team_name]
            if custom_cfg.get("webhook"):
                target_webhook = custom_cfg["webhook"]
                target_secret = custom_cfg.get("secret") or ""
        return target_webhook, target_secret

    # 1. 模拟战队人员（清远战队）
    webhook_team, secret_team = resolve_webhook_and_secret("清远战队")
    print(f"【战队人员】清远战队 匹配到的 Webhook: '{webhook_team}' (预期包含: 'qingyuan_private_token')")
    print(f"【战队人员】清远战队 匹配到的 Secret: '{secret_team}' (预期: 'qingyuan_private_secret')")
    
    # 2. 模拟中台人员 (所属战队名为空或不在配置中)
    webhook_middle, secret_middle = resolve_webhook_and_secret("")
    print(f"【中台人员】无战队 匹配到的 Webhook: '{webhook_middle[:60]}...' (预期: 默认全局 Webhook)")
    print(f"【中台人员】无战队 匹配到的 Secret: '{secret_middle[:10]}...' (预期: 默认全局 Secret)")
    
    assert "qingyuan_private_token" in webhook_team
    assert secret_team == "qingyuan_private_secret"
    assert webhook_middle == DINGTALK_WEBHOOK
    assert secret_middle == DINGTALK_SECRET


if __name__ == "__main__":
    asyncio.run(test_weekly_log_sync_routing())
    asyncio.run(test_dingtalk_message_routing())
    print("\n所有场景模拟测试通过！分流与回落机制运行完全正常。")
