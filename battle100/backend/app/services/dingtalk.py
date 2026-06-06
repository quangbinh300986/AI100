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


def convert_markdown_tables_to_lists(text: str) -> str:
    """自动将 Markdown 表格转换为列表，使其在钉钉消息中排版更友好"""
    lines = text.split('\n')
    output = []
    
    # 辅助函数：解析表格行，按 | 分割并清理空格
    def parse_table_line(line: str) -> list:
        trimmed = line.strip()
        if trimmed.startswith('|'):
            trimmed = trimmed[1:]
        if trimmed.endswith('|'):
            trimmed = trimmed[:-1]
        return [cell.strip() for cell in trimmed.split('|')]

    i = 0
    while i < len(lines):
        line = lines[i]
        trimmed = line.strip()
        
        # 判定是否可能是表格头部
        if trimmed.startswith('|') and trimmed.endswith('|') and i + 1 < len(lines):
            next_line = lines[i+1].strip()
            # 检查下一行是否是分割行 (例如 |---|---| 或 |--:|，且不包含除 -、:、| 之外的其他字符)
            is_separator = next_line.startswith('|') and next_line.endswith('|') and all(c in '-:| ' for c in next_line.replace('|', ''))
            
            if is_separator:
                # 识别到表格
                table_headers = parse_table_line(line)
                i += 2 # 跳过表头和分割行
                table_rows = []
                
                # 收集所有的数据行
                while i < len(lines):
                    data_line = lines[i].strip()
                    if data_line.startswith('|') and data_line.endswith('|'):
                        table_rows.append(parse_table_line(data_line))
                        i += 1
                    else:
                        break
                
                # 开始执行表格转列表转换
                if table_rows:
                    list_items = []
                    for row_idx, row in enumerate(table_rows):
                        # 对齐列名和具体值
                        row_data = {}
                        for col_idx, col_name in enumerate(table_headers):
                            val = row[col_idx] if col_idx < len(row) else ""
                            row_data[col_name] = val
                        
                        # 寻找最适合做标题的列
                        title_col = ""
                        for col in table_headers:
                            if "项目" in col or "名称" in col or "指标" in col:
                                title_col = col
                                break
                        
                        if not title_col and len(table_headers) > 1:
                            title_col = table_headers[1]
                        elif not title_col and len(table_headers) > 0:
                            title_col = table_headers[0]
                            
                        title_val = row_data.get(title_col, f"数据项 {row_idx + 1}")
                        
                        # 查找序号列并拼接到最前面
                        seq_val = ""
                        for col in table_headers:
                            if col in ["序号", "ID", "id", "No", "no"]:
                                seq_val = row_data.get(col, "")
                                break
                        
                        prefix = f"{seq_val}. " if seq_val else ""
                        item_str = f"* **{prefix}{title_val}**\n"
                        
                        # 拼接非标题和非序号的其他列值
                        for col_name, val in row_data.items():
                            if col_name == title_col or col_name in ["序号", "ID", "id", "No", "no"]:
                                continue
                            if val: # 空值不显示
                                item_str += f"  * {col_name}：{val}\n"
                                
                        list_items.append(item_str)
                    
                    output.append("\n" + "".join(list_items))
                continue
        
        output.append(line)
        i += 1
        
    return "\n".join(output)


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

        # 将 Markdown 格式的表格转换为列表格式以适配钉钉的展示宽度
        markdown_text = convert_markdown_tables_to_lists(markdown_text)

        payload = {
            "msgtype": "actionCard",
            "actionCard": {
                "title": f"【百日奋战周报】{user.name}的周复盘",
                "text": markdown_text,
                "btnOrientation": "0",
                "singleTitle": "💻 进入战役作战系统",
                "singleURL": "http://localhost:3100/admin/weekly-reports"
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


async def send_group_weekly_report_to_dingtalk(group_name: str, start_date_val: str, metrics: dict, content: str, redirect_url: str = None) -> bool:
    """推送团队/三级巴级别整体周报到钉钉群机器人"""
    from datetime import datetime, date
    import time
    
    try:
        # 将 start_date_val 解析为日期计算周期
        if isinstance(start_date_val, str):
            start_date = datetime.strptime(start_date_val, "%Y-%m-%d").date()
        else:
            start_date = start_date_val
            
        from datetime import timedelta
        end_date = start_date + timedelta(days=6)
        
        # 拼装出更适合钉钉群中高亮展示的 Markdown 排版，第一句必须包含“百日奋战周报”以触发自定义安全关键词
        header = (
            f"# 📅 【百日奋战周报】整体复盘播报\n"
            f"---  \n"
            f"**团队/三级巴**：{group_name}  \n"
            f"**统计周期**：`{start_date}` ~ `{end_date}`  \n"
            f"**发布时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n"
            f"---  \n"
            f"📊 **核心业务数据看板快照**：\n"
            f"* 🏆 营销新签合同额: **{metrics.get('marketing_signed', 0.0):.2f} 万元**\n"
            f"* 📋 交付新签合同额: **{metrics.get('delivery_signed', 0.0):.2f} 万元**\n"
            f"* 🎯 中标项目个数: **{metrics.get('win_bids', 0)} 个**\n"
            f"* 😊 幸福动作个数: **{metrics.get('happiness_count', 0)} 次**\n"
            f"* 🤝 铁三角联动次数: **{metrics.get('triangle_count', 0)} 次**\n"
            f"* 📌 有效商机线索量: **{metrics.get('valid_leads', 0)} 个**\n"
            f"* 🔥 潜力商机线索量: **{metrics.get('potential_leads', 0)} 个**\n"
            f"* 💰 CRM 累计确认产值: **{metrics.get('production_value', 0.0):.2f} 万元**\n"
            f"* 💵 CRM 到账回款额: **{metrics.get('receive_value', 0.0):.2f} 万元**\n"
            f"---  \n\n"
        )
        
        # 将正文及核心信息拼接，并将 Markdown 表格转换为列表展示
        markdown_text = header + content + f"\n\n---\n> *本播报由【百日奋战智能周报助手】汇总发送。奋战一百天，亮剑破六千！*"
        markdown_text = convert_markdown_tables_to_lists(markdown_text)
        
        payload = {
            "msgtype": "actionCard",
            "actionCard": {
                "title": f"【百日奋战周报】{group_name}整体复盘",
                "text": markdown_text,
                "btnOrientation": "0",
                "singleTitle": "💻 进入战役作战大屏",
                "singleURL": redirect_url or "http://localhost:3100/admin/weekly-reports"
            }
        }
        
        signed_url = get_signed_url(DINGTALK_WEBHOOK, DINGTALK_SECRET)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(signed_url, json=payload, timeout=15.0)
            if response.status_code == 200:
                res_data = response.json()
                if res_data.get("errcode") == 0:
                    logger.info(f"团队整体周报成功推送至钉钉机器人: {group_name}")
                    return True
                else:
                    logger.error(f"钉钉机器人推送返回错误: errcode={res_data.get('errcode')}, errmsg={res_data.get('errmsg')}")
                    return False
            else:
                logger.error(f"发送团队周报到钉钉机器人失败: status_code={response.status_code}, body={response.text}")
                return False
    except Exception as e:
        logger.error(f"发送团队周报到钉钉机器人发生异常: {str(e)}", exc_info=True)
        return False

