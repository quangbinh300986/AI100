import time
import hmac
import hashlib
import base64
import urllib.parse
import httpx
import logging
from app.models.report import WeeklyReport
from app.models.user import User

logger = logging.getLogger("battle100.dingtalk")

DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=07690b8c1562a8e4229df625e989fbaa660945dcf1089d6f115e98367542b0a0"
DINGTALK_SECRET = "SECc540d6e6386da37dc5dec72b3517814415c13ecd10ef62f9c0762682781ceceb"

def get_signed_url(webhook_url: str, secret: str) -> str:
    """计算签名并获取最终的 Webhook URL"""
    timestamp = str(round(time.time() * 1000))
    secret_enc = secret.encode('utf-8')
    string_to_sign = '{}\n{}'.format(timestamp, secret)
    string_to_sign_enc = string_to_sign.encode('utf-8')
    hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
    sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
    return f"{webhook_url}&timestamp={timestamp}&sign={sign}"

async def send_weekly_report_to_dingtalk(report: WeeklyReport, user: User):
    """将周报发送到钉钉机器人"""
    try:
        from app.models.user import PositionType
        is_marketing = user.position_type == PositionType.MARKETING
        
        position_type_desc = "营销与销售线" if is_marketing else "项目与交付线"
        plan = report.sales_plan if is_marketing else report.delivery_plan
        actual = report.sales_actual if is_marketing else report.delivery_actual
        rate = report.sales_rate if is_marketing else report.delivery_rate
        highlights = report.sales_highlights if is_marketing else report.delivery_highlights
        blockers = report.sales_blockers if is_marketing else report.delivery_blockers
        support = report.sales_support if is_marketing else report.delivery_support
        next_plan = report.next_sales_plan if is_marketing else report.next_delivery_plan

        # 拼接排版优美的 Markdown 文本
        # 注意：必须包含安全设置自定义关键词“百日奋战周报”
        markdown_text = (
            f"# 📅 【百日奋战周报】复盘播报\n"
            f"---  \n"
            f"### 👤 汇报人信息  \n"
            f"* **姓名**：{user.name}  \n"
            f"* **战线/岗位**：{position_type_desc}  \n"
            f"* **周报周期**：`{report.start_date}` ~ `{report.end_date}`  \n\n"
            f"---  \n"
            f"### 🎯 本周目标计划  \n"
            f"{plan or '（未填写）'}\n\n"
            f"---  \n"
            f"### 🔥 本周实际完成  \n"
            f"{actual or '（未填写）'}\n\n"
            f"---  \n"
            f"### 📈 计划达成率说明  \n"
            f"`{rate or '（未填写）'}`  \n\n"
            f"---  \n"
            f"### 🏆 本周工作亮点  \n"
            f"{highlights or '（无）'}\n\n"
            f"---  \n"
            f"### 🚧 本周工作卡点/难点  \n"
            f"{blockers or '（无）'}\n\n"
            f"---  \n"
            f"### 🤝 需要支持协调  \n"
            f"{support or '（无）'}\n\n"
            f"---  \n"
            f"### 🚀 下周工作目标  \n"
            f"{next_plan or '（未填写）'}\n\n"
            f"---  \n"
            f"> *本播报由【百日奋战智能周报助手】整理发送。为客户幸福而奋斗，赢战百日！*"
        )

        payload = {
            "msgtype": "markdown",
            "markdown": {
                "title": f"【百日奋战周报】{user.name}的周复盘",
                "text": markdown_text
            }
        }

        signed_url = get_signed_url(DINGTALK_WEBHOOK, DINGTALK_SECRET)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(signed_url, json=payload)
            if response.status_code == 200:
                res_data = response.json()
                if res_data.get("errcode") == 0:
                    logger.info(f"周报成功推送至钉钉机器人: user={user.name}")
                else:
                    logger.error(f"钉钉机器人推送返回错误: errcode={res_data.get('errcode')}, errmsg={res_data.get('errmsg')}")
            else:
                logger.error(f"发送周报到钉钉机器人失败: status_code={response.status_code}, body={response.text}")
    except Exception as e:
        logger.error(f"发送周报到钉钉机器人发生异常: {str(e)}", exc_info=True)
