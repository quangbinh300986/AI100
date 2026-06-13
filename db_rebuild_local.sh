#!/bin/bash
# -----------------------------------------------------------------------------
# 本地服务器执行：重建发布、备份数据库并传送至云服务器
# -----------------------------------------------------------------------------

echo "=== [1/3] 开始在本地数据库重建发布关系 (battle_pub) 并清理旧复制槽 ==="

# 连入本地 AI100 数据库，重建发布关系，自动且天然包含该数据库中的所有表，并清理旧订阅残留的复制槽
docker exec -i supabase-db psql -U postgres -d AI100 <<EOF
DROP PUBLICATION IF EXISTS battle_pub;
CREATE PUBLICATION battle_pub FOR ALL TABLES;

-- 如果存在旧的复制槽，则先将其删除，防止云端重新激活订阅时因槽已存在而报错
SELECT pg_drop_replication_slot('battle_sub') 
FROM pg_replication_slots 
WHERE slot_name = 'battle_sub';
EOF

if [ $? -eq 0 ]; then
    echo "✔ 本地发布重建成功: battle_pub (天然自动包含所有业务表)"
else
    echo "❌ 本地发布重建失败，请检查容器及数据库连接！"
    exit 1
fi

echo "=== [2/3] 开始在本地 Docker 容器中备份数据库 ==="

# 导出本地主库 public 模式下的所有业务表
docker exec -i supabase-db pg_dump -U postgres -d AI100 --schema=public > ./local_AI100_rebuild.sql

if [ $? -eq 0 ]; then
    echo "✔ 本地数据库备份成功: ./local_AI100_rebuild.sql"
else
    echo "❌ 本地数据库备份失败！"
    exit 1
fi

echo "=== [3/3] 开始传送备份文件到公网云端服务器 ==="
echo "提示：请在下方按提示输入云端服务器 (106.55.22.207) 的 ubuntu 密码"

# 传送到云服务器的 /tmp 目录
scp ./local_AI100_rebuild.sql ubuntu@106.55.22.207:/tmp/

if [ $? -eq 0 ]; then
    echo "✔ 备份文件传输成功！请登录云服务器继续执行云端重建步骤。"
else
    echo "❌ 备份文件传输失败，请检查网络连接或密码！"
    exit 1
fi
