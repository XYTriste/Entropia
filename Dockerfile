# =============================================
# 考试排考系统 - Dockerfile
# 多阶段构建优化，减小最终镜像体积
# =============================================

# --------------------------------------------
# 阶段一：builder - 构建依赖和编译环境
# --------------------------------------------
FROM python:3.11-slim AS builder

# 设置构建环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装编译依赖（OR-Tools等需要编译的包）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 创建虚拟环境（后续复制到runtime阶段）
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 先复制依赖清单，利用Docker缓存层
COPY requirements.txt .

# 安装Python依赖（包含OR-Tools等重型库）
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# --------------------------------------------
# 阶段二：runtime - 最小化运行镜像
# --------------------------------------------
FROM python:3.11-slim AS runtime

# 设置运行时环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app

# 安装运行时必需的系统依赖（最小集）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 从builder阶段复制虚拟环境（包含所有Python包）
COPY --from=builder /opt/venv /opt/venv

# 设置工作目录
WORKDIR ${APP_HOME}

# 创建非root用户运行应用（安全最佳实践）
RUN groupadd -r scheduler && useradd -r -g scheduler scheduler \
    && chown -R scheduler:scheduler ${APP_HOME}

# 复制应用代码（保持目录结构）
COPY --chown=scheduler:scheduler app/ ./app/
COPY --chown=scheduler:scheduler scripts/ ./scripts/
COPY --chown=scheduler:scheduler alembic.ini ./
COPY --chown=scheduler:scheduler migrations/ ./migrations/

# 暴露应用端口
EXPOSE 8000

# 切换到非root用户
USER scheduler

# 健康检查：每30秒检查一次API健康端点，连续3次失败标记为unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# 默认启动命令（生产环境）
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
