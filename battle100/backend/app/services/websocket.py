import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger("battle100")

class ConnectionManager:
    """管理 WebSocket 连接，支持单播与广播实时大屏数据"""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"大屏客户端已连接，当前在线客户端: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"大屏客户端已断开，当前在线客户端: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """向所有连接的客户端推送消息"""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"消息推送失败: {e}")

ws_manager = ConnectionManager()
