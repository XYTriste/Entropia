# =============================================
# 考试排考系统 - Makefile
# 常用命令快捷方式
# =============================================

.PHONY: help dev build up down restart logs ps test lint format migrate clean

# 默认目标：显示帮助信息
help:
	@echo "考试排考系统 - 可用命令"
	@echo "========================"
	@echo "  make dev        - 开发模式启动所有服务"
	@echo "  make build      - 重新构建Docker镜像"
	@echo "  make up         - 启动服务（后台模式）"
	@echo "  make down       - 停止服务"
	@echo "  make restart    - 重启服务"
	@echo "  make logs       - 查看API服务日志"
	@echo "  make ps         - 查看服务状态"
	@echo "  make init-db    - 初始化数据库"
	@echo "  make test-data  - 生成测试数据"
	@echo "  make test       - 运行测试套件"
	@echo "  make lint       - 代码检查（flake8 + black）"
	@echo "  make format     - 代码格式化（black + isort）"
	@echo "  make migrate    - 创建并执行数据库迁移"
	@echo "  make clean      - 清理所有容器和卷"
	@echo "  make shell      - 进入API容器Shell"

# --------------------------------------------
# Docker Compose 命令
# --------------------------------------------

# 开发模式启动（后台运行）
dev:
	docker-compose up -d

# 构建（或重建）镜像
build:
	docker-compose build --no-cache

# 启动服务
up:
	docker-compose up -d

# 停止服务
down:
	docker-compose down

# 完全停止并清理卷
clean:
	docker-compose down -v
	rm -rf __pycache__ .pytest_cache htmlcov

# 重启服务
restart:
	docker-compose restart

# 查看API日志
logs:
	docker-compose logs -f api

# 查看所有服务状态
ps:
	docker-compose ps

# 进入API容器Shell
shell:
	docker-compose exec api /bin/sh

# --------------------------------------------
# 数据库操作
# --------------------------------------------

# 初始化数据库（创建表 + 时段数据）
init-db:
	docker-compose exec api python scripts/init_db.py

# 生成测试数据
test-data:
	docker-compose exec api python scripts/generate_test_data.py

# 执行数据库迁移
migrate:
	docker-compose exec api alembic upgrade head

# 创建新的迁移脚本（需传入msg参数）
new-migration:
	@read -p "迁移描述: " msg; \
	docker-compose exec api alembic revision --autogenerate -m "$$msg"

# --------------------------------------------
# 测试与代码质量
# --------------------------------------------

# 运行全部测试
test:
	docker-compose exec api pytest tests/ -v

# 运行测试（带覆盖率）
test-cov:
	docker-compose exec api pytest tests/ -v --cov=app --cov-report=term-missing

# 生成HTML覆盖率报告
test-cov-html:
	docker-compose exec api pytest tests/ --cov=app --cov-report=html

# 代码检查
lint:
	docker-compose exec api flake8 app/ tests/

# 代码格式化
format:
	docker-compose exec api black app/ tests/ scripts/
	docker-compose exec api isort app/ tests/ scripts/

# --------------------------------------------
# 本地开发命令（非Docker环境）
# --------------------------------------------

# 本地安装依赖
install:
	pip install -r requirements.txt

# 本地运行服务
run-local:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 本地运行测试
test-local:
	pytest tests/ -v --cov=app --cov-report=term-missing

# 本地数据库迁移
migrate-local:
	alembic upgrade head
