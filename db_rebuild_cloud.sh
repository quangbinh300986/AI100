#!/bin/bash
# -----------------------------------------------------------------------------
# 云服务器执行：清理旧数据、按本地备份还原、重新激活增量逻辑订阅
# -----------------------------------------------------------------------------

echo "=== [1/4] 开始清理旧订阅并彻底重建独立的 AI100 数据库 ==="

# 1. 尝试连接到已有 AI100 数据库删除逻辑订阅（若 AI100 尚未创建，报错将被忽略）
docker exec -i --user postgres supabase-db psql -U supabase_admin -d AI100 -c "DROP SUBSCRIPTION IF EXISTS battle_sub;" 2>/dev/null || true

# 2. 连接到默认 postgres 数据库，彻底删除并重新创建全新的 AI100 数据库
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres <<EOF
DROP DATABASE IF EXISTS "AI100";
CREATE DATABASE "AI100";
EOF

if [ $? -eq 0 ]; then
    echo "✔ 独立数据库 AI100 重新创建成功！"
else
    echo "❌ 重建 AI100 数据库失败，请检查云端数据库权限及连接状态！"
    exit 1
fi

echo "=== [2/4] 开始从本地备份文件还原表结构与存量数据 ==="

# 自动检测备份文件路径 (优先使用刚刚 scp 传输到 /tmp 目录下的最新备份)
SQL_PATH=""
if [ -f "/tmp/local_AI100_rebuild.sql" ]; then
    SQL_PATH="/tmp/local_AI100_rebuild.sql"
elif [ -f "/home/ubuntu/local_AI100_rebuild.sql" ]; then
    SQL_PATH="/home/ubuntu/local_AI100_rebuild.sql"
elif [ -f "./local_AI100_rebuild.sql" ]; then
    SQL_PATH="./local_AI100_rebuild.sql"
fi

if [ -z "$SQL_PATH" ]; then
    echo "❌ 备份文件 local_AI100_rebuild.sql 不存在！请确认文件已成功上传至当前目录、/home/ubuntu/ 或 /tmp/ 目录。"
    exit 1
fi

echo "✔ 找到备份文件: $SQL_PATH，开始导入..."

# 将备份还原至云端刚刚创建的 AI100 数据库
docker exec -i --user postgres supabase-db psql -U supabase_admin -d AI100 < "$SQL_PATH"

if [ $? -eq 0 ]; then
    echo "✔ 备份数据还原成功！"
else
    echo "❌ 备份数据还原失败！"
    exit 1
fi
echo "=== [3/4] 开始重新创建逻辑订阅连接 ==="

# 重新建立订阅，启用增量实时同步（端口设为确认的 5432）
docker exec -i --user postgres supabase-db psql -U supabase_admin -d AI100 <<EOF
CREATE SUBSCRIPTION battle_sub 
CONNECTION 'host=175.178.74.222 port=5432 user=postgres dbname=AI100 password=e2bc56caf5860bc0ab930d787730ede4' 
PUBLICATION battle_pub 
WITH (copy_data = false);
EOF

if [ $? -eq 0 ]; then
    echo "✔ 订阅重新创建成功！"
else
    echo "❌ 订阅创建失败，请检查本地 FRP 穿透是否正常！"
    exit 1
fi

echo "=== [4/4] 验证同步就绪状态 ==="
sleep 3

# 查询各表同步状态，显示 s 或 r 代表正常
docker exec -i --user postgres supabase-db psql -U supabase_admin -d AI100 -P pager=off <<EOF
SELECT srrelid::regclass AS relname, srsubstate FROM pg_subscription_rel;
EOF

echo "✔ 云端数据库重构及订阅激活步骤全部完成！"
echo "请核对上方的表格同步状态列表，若状态均为 's' 或 'r'，则代表同步正常运行。"
