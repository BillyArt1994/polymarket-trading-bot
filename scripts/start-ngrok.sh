#!/bin/bash

# Dashboard 外网访问启动脚本
# 使用 ngrok 将本地 Streamlit 暴露到外网

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DASHBOARD_DIR="$PROJECT_DIR/dashboard"
NGROK_CONFIG="$HOME/.ngrok2/ngrok.yml"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🌐 Dashboard 外网访问启动器${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 ngrok 是否安装
check_ngrok() {
    if ! command -v ngrok &> /dev/null; then
        echo -e "${YELLOW}⚠️  ngrok 未安装${NC}"
        echo ""
        echo "请选择安装方式："
        echo "1) 自动安装 (推荐)"
        echo "2) 手动安装说明"
        echo "3) 退出"
        echo ""
        read -p "选择 [1-3]: " choice
        
        case $choice in
            1)
                install_ngrok
                ;;
            2)
                show_manual_install
                exit 0
                ;;
            *)
                exit 1
                ;;
        esac
    fi
}

# 自动安装 ngrok
install_ngrok() {
    echo -e "${BLUE}📦 正在安装 ngrok...${NC}"
    
    # 检测系统
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ngrok/ngrok/ngrok
        else
            echo -e "${RED}✗ 请先安装 Homebrew: https://brew.sh${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    else
        echo -e "${RED}✗ 不支持的操作系统${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ ngrok 安装完成${NC}"
    echo ""
}

# 显示手动安装说明
show_manual_install() {
    echo ""
    echo "📖 手动安装 ngrok:"
    echo ""
    echo "1. 访问 https://ngrok.com/download"
    echo "2. 下载适合你系统的版本"
    echo "3. 解压并将 ngrok 添加到 PATH"
    echo "4. 注册 ngrok 账号获取 authtoken"
    echo "5. 运行: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
    echo "完成后重新运行此脚本"
}

# 检查 ngrok 配置
check_ngrok_config() {
    if ! ngrok config check &> /dev/null; then
        echo -e "${YELLOW}⚠️  ngrok 需要配置 authtoken${NC}"
        echo ""
        echo "1. 访问 https://dashboard.ngrok.com/signup 注册账号"
        echo "2. 获取你的 authtoken"
        echo ""
        read -p "请输入你的 ngrok authtoken: " token
        
        if [ -n "$token" ]; then
            ngrok config add-authtoken "$token"
            echo -e "${GREEN}✓ authtoken 配置完成${NC}"
        else
            echo -e "${RED}✗ 未提供 token，无法继续${NC}"
            exit 1
        fi
    fi
}

# 启动 Dashboard
start_dashboard() {
    echo -e "${BLUE}🚀 启动 Streamlit Dashboard...${NC}"
    cd "$DASHBOARD_DIR"
    
    # 检查是否在虚拟环境中
    if [ -d "$PROJECT_DIR/venv" ]; then
        source "$PROJECT_DIR/venv/bin/activate"
    fi
    
    # 后台启动 Streamlit
    nohup streamlit run app.py --server.port 8501 --server.headless true > /tmp/streamlit.log 2>&1 &
    STREAMLIT_PID=$!
    
    # 等待启动
    sleep 3
    
    if ! kill -0 $STREAMLIT_PID 2>/dev/null; then
        echo -e "${RED}✗ Dashboard 启动失败${NC}"
        echo "查看日志: tail -f /tmp/streamlit.log"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Dashboard 已启动 (PID: $STREAMLIT_PID)${NC}"
    echo "   本地地址: http://localhost:8501"
    echo ""
    
    echo $STREAMLIT_PID > /tmp/streamlit.pid
}

# 启动 ngrok
start_ngrok() {
    echo -e "${BLUE}🌐 启动 ngrok 隧道...${NC}"
    
    # 检查端口是否占用
    if lsof -Pi :8501 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ 端口 8501 已在使用${NC}"
    else
        echo -e "${RED}✗ 端口 8501 未监听，Dashboard 可能未启动${NC}"
        exit 1
    fi
    
    # 启动 ngrok
    echo "   正在建立隧道，请稍候..."
    ngrok http 8501 --log=stdout > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!
    
    # 等待获取 URL
    sleep 5
    
    # 获取公网 URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | grep -o 'https://[^"]*' | head -1)
    
    if [ -n "$NGROK_URL" ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}🎉 外网访问地址:${NC}"
        echo -e "${GREEN}   $NGROK_URL${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo "📱 你可以:"
        echo "   - 手机浏览器访问"
        echo "   - 分享给朋友查看"
        echo "   - 任何地方实时监控"
        echo ""
        echo -e "${YELLOW}⚠️  注意:${NC}"
        echo "   - 此链接每次重启都会变化"
        echo "   - 免费版 ngrok 有速率限制"
        echo "   - 关闭终端后服务会停止"
        echo ""
        echo "按 Ctrl+C 停止服务"
        
        # 保存 PID
        echo $NGROK_PID > /tmp/ngrok.pid
        
        # 等待用户中断
        wait $NGROK_PID
    else
        echo -e "${RED}✗ 获取 ngrok URL 失败${NC}"
        echo "查看日志: tail -f /tmp/ngrok.log"
        kill $NGROK_PID 2>/dev/null
        exit 1
    fi
}

# 停止服务
stop_services() {
    echo ""
    echo -e "${BLUE}🛑 停止服务...${NC}"
    
    if [ -f /tmp/ngrok.pid ]; then
        kill $(cat /tmp/ngrok.pid) 2>/dev/null
        rm -f /tmp/ngrok.pid
        echo "   ngrok 已停止"
    fi
    
    if [ -f /tmp/streamlit.pid ]; then
        kill $(cat /tmp/streamlit.pid) 2>/dev/null
        rm -f /tmp/streamlit.pid
        echo "   Dashboard 已停止"
    fi
    
    echo -e "${GREEN}✓ 所有服务已清理${NC}"
}

# 清理函数
cleanup() {
    stop_services
    exit 0
}

# 设置信号处理
trap cleanup INT TERM

# 主流程
main() {
    check_ngrok
    check_ngrok_config
    start_dashboard
    start_ngrok
}

# 如果带参数 --stop，则停止服务
if [ "$1" == "--stop" ]; then
    stop_services
    exit 0
fi

main
