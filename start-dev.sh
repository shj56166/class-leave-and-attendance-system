#!/bin/bash

echo "=== 校园请假管理 Demo - 开发环境启动 ==="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装 Node.js"
    exit 1
fi

# 检查 MySQL
if ! command -v mysql &> /dev/null; then
    echo "警告: 未检测到 MySQL，请确保 MySQL 服务已启动"
fi

echo ""
echo "1. 启动后端服务..."
cd server
if [ ! -d "node_modules" ]; then
    echo "   安装后端依赖..."
    npm install
fi

# 启动后端（后台运行）
npm run dev &
SERVER_PID=$!
echo "   后端服务已启动 (PID: $SERVER_PID, 端口: 3000)"

cd ..

echo ""
echo "2. 启动学生端..."
cd student-app
if [ ! -d "node_modules" ]; then
    echo "   安装学生端依赖..."
    npm install
fi

npm run dev &
STUDENT_PID=$!
echo "   学生端已启动 (PID: $STUDENT_PID, 端口: 5173)"

cd ..

echo ""
echo "3. 启动教师端..."
cd teacher-app
if [ ! -d "node_modules" ]; then
    echo "   安装教师端依赖..."
    npm install
fi

npm run dev &
TEACHER_PID=$!
echo "   教师端已启动 (PID: $TEACHER_PID, 端口: 5174)"

cd ..

echo ""
echo "=== 启动完成 ==="
echo ""
echo "访问地址："
echo "  学生端: http://localhost:5175"
echo "  教师端: http://localhost:5174"
echo "  后端API: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "echo ''; echo '正在停止所有服务...'; kill $SERVER_PID $STUDENT_PID $TEACHER_PID 2>/dev/null; exit" INT

wait
