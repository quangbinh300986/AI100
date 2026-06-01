import os
import json
import logging
from datetime import datetime, date, time
from decimal import Decimal
import uuid
from sqlalchemy import text
from app.config import settings

# 获取针对定期备份的专用 logger
logger = logging.getLogger("battle100.backup")

class CustomEncoder(json.JSONEncoder):
    """自定义 JSON 编码器，处理时间、Decimal 和 UUID 等特殊类型"""
    def default(self, obj):
        if isinstance(obj, (datetime, date, time)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

async def run_auto_backup():
    """执行数据库自动备份逻辑，输出至 backend/backups 目录下"""
    # 动态从 database 引入 engine，复用已有的连接池
    from app.database import engine
    
    try:
        async with engine.connect() as conn:
            # 1. 查询 public schema 下的所有用户表名称
            result = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public';"))
            tables = [row[0] for row in result.fetchall()]
            
            backup_payload = {
                "backup_time": datetime.now().isoformat(),
                "database_name": settings.DB_NAME,
                "tables": {}
            }
            
            # 2. 依次备份每张表的数据
            for table_name in tables:
                # 获取该表的所有字段名
                cols_query = text(f"""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = '{table_name}' 
                    ORDER BY ordinal_position;
                """)
                cols_result = await conn.execute(cols_query)
                columns = [row[0] for row in cols_result.fetchall()]
                
                # 获取该表的所有行记录
                data_query = text(f'SELECT * FROM "{table_name}";')
                data_result = await conn.execute(data_query)
                rows = data_result.fetchall()
                
                # 转换为字典列表
                table_rows = []
                for row in rows:
                    row_dict = {}
                    for col, val in zip(columns, row):
                        row_dict[col] = val
                    table_rows.append(row_dict)
                
                backup_payload["tables"][table_name] = {
                    "columns": columns,
                    "row_count": len(table_rows),
                    "data": table_rows
                }
                
            # 3. 准备写入本地备份文件
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"db_backup_{settings.DB_NAME}_{timestamp}.json"
            
            # 计算 backend/backups 绝对路径
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            backups_dir = os.path.join(base_dir, "backups")
            
            os.makedirs(backups_dir, exist_ok=True)
            backup_path = os.path.join(backups_dir, filename)
            
            # 写入本地文件
            with open(backup_path, "w", encoding="utf-8") as f:
                json.dump(backup_payload, f, cls=CustomEncoder, ensure_ascii=False, indent=2)
                
            logger.info(f"定期自动备份数据库成功：{filename}，已保存至 {backup_path}")
            
    except Exception as e:
        logger.error(f"定期自动备份数据库过程发生错误: {e}")
