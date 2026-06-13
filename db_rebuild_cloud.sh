#!/bin/bash
# -----------------------------------------------------------------------------
# 云服务器执行：清理旧数据、按本地备份还原、重新激活增量逻辑订阅
# -----------------------------------------------------------------------------

echo "=== [1/5] 开始清理云端旧订阅及 22 张核心业务表 ==="

# 连接到云端 supabase-db 容器，以超级管理员用户执行 SQL 清理旧表
# 注：如果您的云端容器名不是 supabase-db，请修改为真实的容器名
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres <<EOF
-- 1. 删除已有的旧订阅
DROP SUBSCRIPTION IF EXISTS battle_sub;

-- 2. 级联物理删除 22 张旧业务与配置表，确保结构和数据彻底清空
DROP TABLE IF EXISTS 
    weekly_reports, 
    group_weekly_reports, 
    happiness_standards, 
    lead_conversions, 
    committee_members, 
    committees, 
    audit_logs, 
    role_permissions, 
    weekly_targets, 
    personal_goals, 
    team_goals, 
    broadcast_events, 
    report_details, 
    daily_reports, 
    zones, 
    teams, 
    users,
    kpi_likes,
    kpi_comments,
    llm_providers,
    llm_models,
    agent_routes
CASCADE;

-- 3. 级联删除所有的自定义枚举类型，确保备份还原时能重新创建包含最新值的类型结构
DROP TYPE IF EXISTS 
    detailtype, 
    eventtype, 
    goaltype, 
    positiontype, 
    pushchannel, 
    pushstatus, 
    reportstatus, 
    teamgoalcategory, 
    userrole 
CASCADE;
EOF

if [ $? -eq 0 ]; then
    echo "✔ 云端核心表清理成功！"
else
    echo "❌ 云端核心表清理失败，请检查数据库连接状态！"
    exit 1
fi

echo "=== [2/5] 开始从本地备份文件还原表结构与存量数据 ==="

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

# 将备份还原至云端数据库 (使用标准输入重定向解决容器内找不到宿主机文件的问题)
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres < "$SQL_PATH"

if [ $? -eq 0 ]; then
    echo "✔ 备份数据还原成功！"
else
    echo "❌ 备份数据还原失败！"
    exit 1
fi

echo "=== [3/5] 补建可能缺失的新表（防止 pg_dump 未包含） ==="

# 显式创建 5 张新增表，IF NOT EXISTS 保证已存在的不会重复创建
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres <<EOF

-- kpi_likes 点赞表
CREATE TABLE IF NOT EXISTS kpi_likes (
    id SERIAL PRIMARY KEY,
    target_id INTEGER NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- kpi_comments 评论表
CREATE TABLE IF NOT EXISTS kpi_comments (
    id SERIAL PRIMARY KEY,
    target_id INTEGER NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- llm_providers 大模型提供商配置表
CREATE TABLE IF NOT EXISTS llm_providers (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'openai',
    base_url VARCHAR(255) NOT NULL DEFAULT '',
    api_key VARCHAR(1000) NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT false,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    website_official VARCHAR(255) NOT NULL DEFAULT '',
    website_api_key VARCHAR(255) NOT NULL DEFAULT '',
    website_docs VARCHAR(255) NOT NULL DEFAULT '',
    website_models VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- llm_models 大模型模型配置表
CREATE TABLE IF NOT EXISTS llm_models (
    id VARCHAR(200) PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL REFERENCES llm_providers(id) ON DELETE CASCADE,
    model_id VARCHAR(200) NOT NULL,
    name VARCHAR(200) NOT NULL,
    group_name VARCHAR(100),
    enabled BOOLEAN NOT NULL DEFAULT false,
    capabilities JSON NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- agent_routes 智能体路由配置表
CREATE TABLE IF NOT EXISTS agent_routes (
    agent_role VARCHAR(100) PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    model_id VARCHAR(200) NOT NULL,
    agent_name VARCHAR(100),
    agent_description VARCHAR(500),
    system_prompt TEXT,
    user_prompt TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

EOF

if [ $? -eq 0 ]; then
    echo "✔ 新增表结构补建完成！"
else
    echo "❌ 新增表结构补建失败！"
    exit 1
fi

echo "=== [4/5] 开始重新创建逻辑订阅连接 ==="

# 重新建立订阅，启用增量实时同步（端口设为确认的 5432）
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres <<EOF
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

echo "=== [5/5] 验证同步就绪状态 ==="
sleep 3

# 查询各表同步状态，显示 s 或 r 代表正常
docker exec -i --user postgres supabase-db psql -U supabase_admin -d postgres -P pager=off <<EOF
SELECT srrelid::regclass AS relname, srsubstate FROM pg_subscription_rel;
EOF

echo "✔ 云端数据库重构及订阅激活步骤全部完成！"
echo "请核对上方的表格同步状态列表，若状态均为 's' 或 'r'，则代表同步正常运行。"
