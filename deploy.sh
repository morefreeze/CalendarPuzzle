#!/bin/bash

# Calendar Puzzle 部署脚本
# 支持本地开发、测试、生产环境部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Docker Compose命令（将在check_dependencies中初始化）
DOCKER_COMPOSE_CMD=""

# 帮助信息
show_help() {
    echo "Calendar Puzzle 部署脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  dev         启动本地开发环境"
    echo "  test        启动测试环境"
    echo "  prod        启动生产环境"
    echo "  stop        停止所有服务"
    echo "  logs        查看日志"
    echo "  clean       清理所有容器和镜像"
    echo "  help        显示帮助信息"
    echo ""
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}检查依赖...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装${NC}"
        exit 1
    fi
    
    # 检测Docker Compose版本（支持v1和v2）
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    else
        echo -e "${RED}错误: Docker Compose 未安装${NC}"
        echo -e "${YELLOW}请安装 Docker Compose v2: https://docs.docker.com/compose/install/${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}依赖检查通过${NC}"
    echo -e "${GREEN}使用 Docker Compose: $DOCKER_COMPOSE_CMD${NC}"
}

# 启动开发环境
start_dev() {
    echo -e "${YELLOW}启动开发环境...${NC}"
    
    # 启动后端
    echo -e "${YELLOW}启动后端 API 服务...${NC}"
    python server.py &
    BACKEND_PID=$!
    
    # 启动前端
    echo -e "${YELLOW}启动前端开发服务器...${NC}"
    cd my-cal
    npm start &
    FRONTEND_PID=$!
    
    echo -e "${GREEN}开发环境已启动:${NC}"
    echo "  前端: http://localhost:3000"
    echo "  后端: http://localhost:5000"
    echo "  后端PID: $BACKEND_PID"
    echo "  前端PID: $FRONTEND_PID"
    
    # 保存PID到文件
    echo "$BACKEND_PID" > .dev_pids
    echo "$FRONTEND_PID" >> .dev_pids
}

# 启动测试环境
start_test() {
    echo -e "${YELLOW}启动测试环境...${NC}"
    $DOCKER_COMPOSE_CMD up --build -d
    
    echo -e "${GREEN}测试环境已启动:${NC}"
    echo "  前端: http://localhost:3000"
    echo "  后端: http://localhost:5000"
    
    # 等待服务启动
    echo -e "${YELLOW}等待服务启动...${NC}"
    sleep 10
    
    # 健康检查
    echo -e "${YELLOW}健康检查...${NC}"
    curl -f http://localhost:5000/api/health || echo -e "${RED}后端健康检查失败${NC}"
    curl -f http://localhost:3000/api/health || echo -e "${RED}前端健康检查失败${NC}"
}

# 启动生产环境
start_prod() {
    echo -e "${YELLOW}启动生产环境...${NC}"
    
    # 检查SSL证书
    if [ ! -d "ssl" ]; then
        echo -e "${YELLOW}创建SSL证书...${NC}"
        mkdir -p ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/nginx.key -out ssl/nginx.crt \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    fi
    
    $DOCKER_COMPOSE_CMD -f docker-compose.yml -f docker-compose.prod.yml up --build -d
    
    echo -e "${GREEN}生产环境已启动:${NC}"
    echo "  应用: http://localhost"
    echo "  健康检查: http://localhost/api/health"
    
    # 等待服务启动
    echo -e "${YELLOW}等待服务启动...${NC}"
    sleep 15
    
    # 健康检查
    echo -e "${YELLOW}健康检查...${NC}"
    curl -f http://localhost/api/health || echo -e "${RED}健康检查失败${NC}"
}

# 停止服务
stop_services() {
    echo -e "${YELLOW}停止服务...${NC}"
    
    # 检测Docker Compose版本（如果未初始化）
    if [ -z "$DOCKER_COMPOSE_CMD" ]; then
        if command -v docker-compose &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker-compose"
        elif docker compose version &> /dev/null; then
            DOCKER_COMPOSE_CMD="docker compose"
        fi
    fi
    
    # 停止Docker容器（如果Docker Compose可用）
    if [ -n "$DOCKER_COMPOSE_CMD" ]; then
        $DOCKER_COMPOSE_CMD down 2>/dev/null || echo "⚠️  无法停止Docker容器，可能未运行"
    fi
    
    # 停止开发环境进程
    if [ -f ".dev_pids" ]; then
        echo -e "${YELLOW}停止开发环境进程...${NC}"
        while read pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                echo -e "${GREEN}已停止进程 $pid${NC}"
            fi
        done < .dev_pids
        rm -f .dev_pids
    fi
    
    echo -e "${GREEN}所有服务已停止${NC}"
}

# 查看日志
show_logs() {
    echo -e "${YELLOW}查看日志...${NC}"
    $DOCKER_COMPOSE_CMD logs -f
}

# 清理环境
clean_environment() {
    echo -e "${YELLOW}清理环境...${NC}"
    
    # 停止并删除容器
    $DOCKER_COMPOSE_CMD down -v --remove-orphans
    
    # 删除镜像
    docker rmi calendarpuzzle_backend calendarpuzzle_frontend nginx:alpine 2>/dev/null || true
    
    # 清理构建缓存
    docker system prune -f
    
    echo -e "${GREEN}环境已清理${NC}"
}

# 主逻辑
case "$1" in
    dev)
        check_dependencies
        start_dev
        ;;
    test)
        check_dependencies
        start_test
        ;;
    prod)
        check_dependencies
        start_prod
        ;;
    stop)
        stop_services
        ;;
    logs)
        show_logs
        ;;
    clean)
        clean_environment
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}错误: 未知选项 '$1'${NC}"
        show_help
        exit 1
        ;;
esac