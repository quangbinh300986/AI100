"""
钉钉集成模块
提供钉钉消息推送、用户认证等功能
钉钉AppKey: dingcdmb2imuqdcoqrdf
钉钉CorpId: dingdaec913f1d2b741235c2f4657eb6378f
"""

import httpx
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.config import settings


class DingTalkClient:
    """钉钉API客户端"""

    # 钉钉开放平台API地址
    BASE_URL = "https://oapi.dingtalk.com"
    NEW_API_URL = "https://api.dingtalk.com"

    def __init__(self):
        self.app_key = settings.DINGTALK_APP_KEY
        self.app_secret = settings.DINGTALK_APP_SECRET
        self.corp_id = settings.DINGTALK_CORP_ID
        self._access_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None
        self.timeout = httpx.Timeout(30.0)

    async def _get_access_token(self) -> str:
        """
        获取钉钉接口访问令牌
        令牌有效期为2小时，过期前自动刷新
        :return: access_token字符串
        """
        # 检查缓存的token是否有效
        now = datetime.now(timezone.utc)
        if self._access_token and self._token_expires_at and now < self._token_expires_at:
            return self._access_token

        # 请求新token
        url = f"{self.BASE_URL}/gettoken"
        params = {
            "appkey": self.app_key,
            "appsecret": self.app_secret,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params)
            data = response.json()

        if data.get("errcode") == 0:
            self._access_token = data["access_token"]
            # 提前5分钟刷新
            self._token_expires_at = now + timedelta(seconds=data.get("expires_in", 7200) - 300)
            return self._access_token
        else:
            raise Exception(f"获取钉钉access_token失败: {data.get('errmsg')}")

    async def get_user_info_by_code(self, auth_code: str) -> Optional[dict]:
        """
        通过授权码获取用户信息（免登场景）
        :param auth_code: 前端传来的授权码
        :return: 用户信息字典
        """
        import logging
        logger = logging.getLogger("battle100")
        try:
            token = await self._get_access_token()
            # 1. 获取 userid
            url = f"{self.BASE_URL}/topapi/v2/user/getuserinfo"
            params = {"access_token": token}
            json_data = {"code": auth_code}
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, params=params, json=json_data)
                data = response.json()
            
            if data.get("errcode") != 0:
                logger.error(f"通过免登授权码获取userid失败: {data.get('errmsg')}")
                return None
                
            result = data.get("result", {})
            userid = result.get("userid")
            name = result.get("name")
            
            # 2. 通过 userid 获取用户详情，拿到手机号
            user_detail_url = f"{self.BASE_URL}/topapi/v2/user/get"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    user_detail_url, 
                    params=params, 
                    json={"userid": userid, "language": "zh_CN"}
                )
                detail_data = response.json()
                
            mobile = None
            if detail_data.get("errcode") == 0:
                mobile = detail_data.get("result", {}).get("mobile")
                
            return {
                "userid": userid,
                "name": name,
                "mobile": mobile
            }
        except Exception as e:
            logger.error(f"get_user_info_by_code 发生异常: {e}")
            return None

    async def send_work_notification(
        self,
        user_id_list: list[str],
        content: str,
        title: str = "百日奋战播报",
    ) -> Optional[str]:
        """
        发送工作通知消息
        :param user_id_list: 钉钉用户ID列表
        :param content: 消息内容（支持Markdown）
        :param title: 消息标题
        :return: 任务ID (task_id)
        """
        if not user_id_list:
            return None
        import logging
        logger = logging.getLogger("battle100")
        try:
            token = await self._get_access_token()
            agent_id = settings.DINGTALK_AGENT_ID
            if not agent_id:
                logger.error("未配置 DINGTALK_AGENT_ID，无法发送工作通知")
                return None
                
            url = f"{self.BASE_URL}/topapi/message/corpconversation/asyncsend_v2"
            params = {"access_token": token}
            json_data = {
                "agent_id": int(agent_id),
                "userid_list": ",".join(user_id_list),
                "msg": {
                    "msgtype": "markdown",
                    "markdown": {
                        "title": title,
                        "text": content
                    }
                }
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, params=params, json=json_data)
                data = response.json()
                
            if data.get("errcode") == 0:
                return str(data.get("task_id"))
            else:
                logger.error(f"发送工作通知失败: {data.get('errmsg')}")
                return None
        except Exception as e:
            logger.error(f"send_work_notification 发生异常: {e}")
            return None

    async def send_group_message(
        self,
        chat_id: str,
        content: str,
        msg_type: str = "markdown",
    ) -> Optional[str]:
        """
        发送群消息
        :param chat_id: 群会话ID
        :param content: 消息内容
        :param msg_type: 消息类型（text/markdown/action_card等）
        :return: 消息ID
        """
        if not chat_id:
            return None
        import logging
        logger = logging.getLogger("battle100")
        try:
            token = await self._get_access_token()
            url = f"{self.BASE_URL}/chat/send"
            params = {"access_token": token}
            
            title = "百日奋战播报"
            if content.startswith("#"):
                first_line = content.split("\n")[0]
                title = first_line.replace("#", "").strip()
                
            json_data = {
                "chatid": chat_id,
                "msg": {
                    "msgtype": "markdown",
                    "markdown": {
                        "title": title,
                        "text": content
                    }
                }
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, params=params, json=json_data)
                data = response.json()
                
            if data.get("errcode") == 0:
                return data.get("messageId")
            else:
                # 尝试使用新版机器人发送群消息接口
                new_url = f"{self.NEW_API_URL}/v1.0/robot/groupMessages/send"
                headers = {
                    "x-acs-dingtalk-access-token": token,
                    "Content-Type": "application/json"
                }
                import json
                new_json_data = {
                    "msgKey": "sampleMarkdown",
                    "msgParam": json.dumps({"title": title, "text": content}),
                    "openConversationId": chat_id,
                    "robotCode": self.app_key
                }
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(new_url, headers=headers, json=new_json_data)
                    new_data = resp.json()
                if resp.status_code == 200 or new_data.get("processQueryKey"):
                    return new_data.get("processQueryKey") or "success"
                else:
                    logger.error(f"发送群消息失败，旧接口错误: {data.get('errmsg')}; 新接口返回: {new_data}")
                    return None
        except Exception as e:
            logger.error(f"send_group_message 发生异常: {e}")
            return None

    async def send_webhook_message(
        self,
        content: str,
        title: str = "百日奋战播报",
    ) -> Optional[str]:
        """
        通过自定义群机器人 Webhook 发送消息
        :param content: 消息内容（支持Markdown）
        :param title: 消息标题
        :return: 消息发送状态标识
        """
        webhook_url = settings.DINGTALK_WEBHOOK_URL
        if not webhook_url:
            return None
            
        import logging
        logger = logging.getLogger("battle100")
        try:
            import time
            import hmac
            import hashlib
            import base64
            import urllib.parse
            
            secret = settings.DINGTALK_WEBHOOK_SECRET
            url = webhook_url
            
            if secret:
                timestamp = str(round(time.time() * 1000))
                secret_enc = secret.encode('utf-8')
                string_to_sign = f"{timestamp}\n{secret}"
                string_to_sign_enc = string_to_sign.encode('utf-8')
                hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
                sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
                
                if "?" in url:
                    url = f"{url}&timestamp={timestamp}&sign={sign}"
                else:
                    url = f"{url}?timestamp={timestamp}&sign={sign}"
                    
            json_data = {
                "msgtype": "markdown",
                "markdown": {
                    "title": title,
                    "text": content
                }
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=json_data)
                data = response.json()
                
            if data.get("errcode") == 0 or data.get("status") == "ok":
                return "webhook_success"
            else:
                logger.error(f"Webhook 发送失败: {data.get('errmsg') or data}")
                return None
        except Exception as e:
            logger.error(f"send_webhook_message 发生异常: {e}")
            return None

    async def push_broadcast_message(
        self,
        event_type: str,
        content: str,
        user_name: Optional[str] = None,
        team_name: Optional[str] = None,
        dingtalk_users: Optional[list[str]] = None
    ) -> Optional[str]:
        """
        统一的消息播报推送服务，支持 Webhook、自建群发及工作通知，并将战报排版成精美的 Markdown 卡片
        """
        import logging
        import re
        logger = logging.getLogger("battle100")
        
        # 1. 转换事件类型名称
        event_type_names = {
            "contract_signed": "已完成合同签订 (90%)",
            "lead_75": "中标确定 (75%)",
            "lead_25": "有效线索确定 (25%)",
            "triangle": "铁三角联动",
            "happiness": "客户幸福动作",
            "custom": "自定义播报",
            "goal_achieved": "目标达成",
            "daily_summary": "每日战报汇总",
            "weekly_summary": "每周战报汇总",
            "ranking_update": "战队排名更新"
        }
        type_name = event_type_names.get(event_type, "最新战报")
        
        # 提取项目名称与客户名称
        project_name_val = None
        proj_match = re.search(r"关联项目【([^】]+)】", content)
        if proj_match:
            project_name_val = proj_match.group(1)
        if not project_name_val:
            proj_match = re.search(r"确定([^】]+)项目走完合同流程", content)
            if proj_match:
                project_name_val = proj_match.group(1)
        if not project_name_val:
            proj_match = re.search(r"确定([^】]+)项目中地承接", content)
            if proj_match:
                project_name_val = proj_match.group(1)

        customer_name_val = None
        cust_match = re.search(r"对象为【([^】]+)】", content)
        if cust_match:
            customer_name_val = cust_match.group(1)
        if not customer_name_val:
            cust_match = re.search(r"客户为\s*([^，!。]+)", content)
            if cust_match:
                customer_name_val = cust_match.group(1).replace("【", "").replace("】", "")
        if not customer_name_val:
            cust_match = re.search(r"业主单位：\s*([^，!。]+)", content)
            if cust_match:
                customer_name_val = cust_match.group(1).replace("【", "").replace("】", "")

        # 2. 格式化精美 Markdown 内容
        cleaned_content = content
        if "【战报播报】" in cleaned_content:
            cleaned_content = cleaned_content.replace("【战报播报】", "")
            
        if event_type == "happiness":
            cleaned_content = re.sub(r"今日我司【[^】]+】", "", cleaned_content)
            cleaned_content = re.sub(r"，?对象为【[^】]+】", "", cleaned_content)
            cleaned_content = re.sub(r"，?关联项目【[^】]+】", "", cleaned_content)
            cleaned_content = cleaned_content.replace("，，", "，")

        markdown_text = f"### 🎉 战报播报 | 赢战百日\n\n"
        markdown_text += f"**恭喜战友，再传捷报！**\n\n"
        markdown_text += f"---\n"
        markdown_text += f"* **战报类型**：{type_name}\n"
        if user_name:
            markdown_text += f"* **推进战友**：{user_name}\n"
        if project_name_val:
            markdown_text += f"* **项目名称**：{project_name_val}\n"
        if customer_name_val:
            markdown_text += f"* **客户名称**：{customer_name_val}\n"
        if team_name:
            markdown_text += f"* **所属战队**：{team_name}\n"
            
        # 提取金额
        amount_match = re.search(r"金额：\s*([0-9.]+)\s*万元", content)
        if not amount_match:
            amount_match = re.search(r"价值\s*([0-9.]+)\s*万元", content)
        if amount_match:
            markdown_text += f"* **战报金额**：**{amount_match.group(1)}** 万元 💰\n"
            
        markdown_text += f"---\n"
        
        # 保证主正文段落以肌肉图标结尾，并去掉重复期待语
        cleaned_content_stripped = cleaned_content.strip()
        if not cleaned_content_stripped.endswith("💪"):
            cleaned_content_stripped += " 💪"
            
        # 处理内容中的换行符，将单个换行 \n 替换为 2个空格+\n+> 符号，以保证在钉钉 Markdown 的 Blockquote 块中多行正常换行展示而不换出引用框
        formatted_content = cleaned_content_stripped.replace("\n", "  \n> ")
        markdown_text += f"> {formatted_content}\n"
        
        title = f"战报播报: {type_name}"
        msg_id = None
        
        # 路由 1：群自定义机器人 Webhook（最推荐）
        if settings.DINGTALK_WEBHOOK_URL:
            logger.info("检测到 DINGTALK_WEBHOOK_URL，使用群自定义机器人 Webhook 发送")
            msg_id = await self.send_webhook_message(markdown_text, title)
            if msg_id:
                return msg_id
                
        # 路由 2：企业自建群聊接口（需 ChatID）
        if settings.DINGTALK_CHAT_ID:
            logger.info(f"使用自建应用机器人向群聊 {settings.DINGTALK_CHAT_ID} 发送")
            msg_id = await self.send_group_message(settings.DINGTALK_CHAT_ID, markdown_text)
            if msg_id:
                return msg_id
                
        # 路由 3：工作通知兜底（直接发送给相关人员个人）
        if dingtalk_users:
            logger.info(f"使用自建应用向指定用户 {dingtalk_users} 推送个人工作通知")
            msg_id = await self.send_work_notification(dingtalk_users, markdown_text, title)
            if msg_id:
                return msg_id
                
        return None

    async def send_station_report_actioncard(
        self,
        title: str,
        category: str,
        location: str,
        summary: str,
        download_url: Optional[str],
        password: Optional[str],
        is_urgent: bool = False,
        detail_url: Optional[str] = None,
    ) -> Optional[str]:
        """
        发送驻点播报的 ActionCard 消息到钉钉群，支持加签验证和紧急@所有人
        """
        if category == "policy":
            webhook_url = "https://oapi.dingtalk.com/robot/send?access_token=5bd92dbee70063fe2033d880524ecb7c78cbcfcc58a659a98cf7d9d0f1e0e516"
            secret = "SEC8c0ac0f5f3a6e65ddbfa23ee98c1bb00ceee149d251d7e3325315e038d0ae6dd"
        else:
            webhook_url = settings.DINGTALK_WEBHOOK_URL
            secret = settings.DINGTALK_WEBHOOK_SECRET

        if not webhook_url:
            return None

        import logging
        import time
        import hmac
        import hashlib
        import base64
        import urllib.parse
        
        logger = logging.getLogger("battle100")
        try:
            # 子分类名称映射
            category_names = {
                "policy": "🏛️ 最新政策",
                "deployment": "📋 重大会议部署",
                "lead": "🎯 潜在项目线索",
                "intelligence": "🔍 重大情报信息",
            }
            category_label = category_names.get(category, "📢 驻点人员播报")
            
            urgent_tag = "🔴 【紧急快报】" if is_urgent else "📢 "
            at_text = " @所有人" if is_urgent else ""
            keyword_tag = "【政策文件播报】" if category == "policy" else "【战报播报 | 赢战百日】"
            
            # 构建文本内容，将解压密码直接展示在群消息中
            markdown_text = f"### {keyword_tag}{urgent_tag}{category_label}{at_text}\n\n"
            markdown_text += f"---\n"
            markdown_text += f"* **驻点地点**：{location}\n"
            markdown_text += f"* **播报标题**：{title}\n"
            markdown_text += f"---\n\n"
            markdown_text += f"> {summary.replace('\n', '  \n> ')}\n\n"
            markdown_text += f"---\n"
            
            if download_url:
                if category == "policy":
                    markdown_text += f"* **附件状态**：🔑 已进行 AES-256 安全加密打包\n"
                    markdown_text += f"* **解压密码**：**{password}** (下载后使用密码解压)\n"
                else:
                    markdown_text += f"* **附件状态**：常规附件包 (无解压密码，可直接解压)\n"
            else:
                markdown_text += f"* **附件状态**：无附件\n"

            # 签名逻辑
            url = webhook_url
            if secret:
                timestamp = str(round(time.time() * 1000))
                secret_enc = secret.encode('utf-8')
                string_to_sign = f"{timestamp}\n{secret}"
                string_to_sign_enc = string_to_sign.encode('utf-8')
                hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
                sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
                if "?" in url:
                    url = f"{url}&timestamp={timestamp}&sign={sign}"
                else:
                    url = f"{url}?timestamp={timestamp}&sign={sign}"

            btns = []
            if download_url:
                btn_title = "📥 下载加密附件" if category == "policy" else "📥 下载附件包"
                btns.append({
                    "title": btn_title,
                    "actionURL": download_url
                })
            if detail_url:
                btns.append({
                    "title": "📄 查看网页详情",
                    "actionURL": detail_url
                })

            json_data = {
                "msgtype": "actionCard",
                "actionCard": {
                    "title": f"{keyword_tag}{urgent_tag}{title}",
                    "text": markdown_text,
                    "btnOrientation": "1",
                    "btns": btns
                }
            }
            
            if is_urgent:
                json_data["at"] = {
                    "isAtAll": True
                }

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=json_data)
                data = response.json()
                
            if data.get("errcode") == 0 or data.get("status") == "ok":
                return "webhook_success"
            else:
                logger.error(f"发送 ActionCard Webhook 失败: {data.get('errmsg') or data}")
                return None
        except Exception as e:
            logger.error(f"send_station_report_actioncard 发生异常: {e}")
            return None

    async def get_department_users(self, dept_id: int = 1) -> list[dict]:
        """
        获取部门用户列表
        :param dept_id: 部门ID，默认根部门
        :return: 用户列表
        """
        import logging
        logger = logging.getLogger("battle100")
        try:
            token = await self._get_access_token()
            url = f"{self.BASE_URL}/topapi/v2/user/list"
            params = {"access_token": token}
            json_data = {
                "dept_id": dept_id,
                "cursor": 0,
                "size": 100
            }
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, params=params, json=json_data)
                data = response.json()
            if data.get("errcode") == 0:
                return data.get("result", {}).get("list", [])
            else:
                logger.error(f"获取部门用户失败: {data.get('errmsg')}")
                return []
        except Exception as e:
            logger.error(f"get_department_users 发生异常: {e}")
            return []


# 全局钉钉客户端单例
dingtalk_client = DingTalkClient()
