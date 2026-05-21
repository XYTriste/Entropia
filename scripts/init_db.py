#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
考试排考系统 - 数据库初始化脚本
功能：
  1. 创建所有数据表（如果不存在）
  2. 插入20个预置考试时段（周一到周五，每天4个时段）

使用方式：
  python scripts/init_db.py
  
Docker环境中：
  docker-compose exec api python scripts/init_db.py
"""

import asyncio
import os
import sys
from datetime import time
from typing import Optional

# 将项目根目录加入Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# SQLAlchemy 导入
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# 尝试导入应用模型
try:
    from app.models.base import Base
    from app.models.time_slot import TimeSlot
    MODELS_AVAILABLE = True
except ImportError as e:
    MODELS_AVAILABLE = False
    print(f"[WARN] 应用模型导入失败: {e}，将使用原始SQL方式初始化")


# =============================================
# 时段配置：周一到周五，每天4个时段
# =============================================
TIME_SLOT_CONFIG = [
    # 周一 (day=1)
    {"day_of_week": 1, "day_name": "周一", "slots": [
        {"name": "周一上午第1场", "start": time(8, 30),  "end": time(10, 10)},
        {"name": "周一上午第2场", "start": time(10, 20), "end": time(12, 0)},
        {"name": "周一下午第1场", "start": time(14, 0),  "end": time(15, 40)},
        {"name": "周一下午第2场", "start": time(15, 50), "end": time(17, 30)},
    ]},
    # 周二 (day=2)
    {"day_of_week": 2, "day_name": "周二", "slots": [
        {"name": "周二上午第1场", "start": time(8, 30),  "end": time(10, 10)},
        {"name": "周二上午第2场", "start": time(10, 20), "end": time(12, 0)},
        {"name": "周二下午第1场", "start": time(14, 0),  "end": time(15, 40)},
        {"name": "周二下午第2场", "start": time(15, 50), "end": time(17, 30)},
    ]},
    # 周三 (day=3)
    {"day_of_week": 3, "day_name": "周三", "slots": [
        {"name": "周三上午第1场", "start": time(8, 30),  "end": time(10, 10)},
        {"name": "周三上午第2场", "start": time(10, 20), "end": time(12, 0)},
        {"name": "周三下午第1场", "start": time(14, 0),  "end": time(15, 40)},
        {"name": "周三下午第2场", "start": time(15, 50), "end": time(17, 30)},
    ]},
    # 周四 (day=4)
    {"day_of_week": 4, "day_name": "周四", "slots": [
        {"name": "周四上午第1场", "start": time(8, 30),  "end": time(10, 10)},
        {"name": "周四上午第2场", "start": time(10, 20), "end": time(12, 0)},
        {"name": "周四下午第1场", "start": time(14, 0),  "end": time(15, 40)},
        {"name": "周四下午第2场", "start": time(15, 50), "end": time(17, 30)},
    ]},
    # 周五 (day=5)
    {"day_of_week": 5, "day_name": "周五", "slots": [
        {"name": "周五上午第1场", "start": time(8, 30),  "end": time(10, 10)},
        {"name": "周五上午第2场", "start": time(10, 20), "end": time(12, 0)},
        {"name": "周五下午第1场", "start": time(14, 0),  "end": time(15, 40)},
        {"name": "周五下午第2场", "start": time(15, 50), "end": time(17, 30)},
    ]},
]


def get_database_url(sync: bool = True) -> str:
    """获取数据库连接URL，优先从环境变量读取"""
    if sync:
        url = os.environ.get("SCHEDULER_DATABASE_SYNC_URL")
        if url:
            return url
        # 回退：从异步URL推导
        async_url = os.environ.get("SCHEDULER_DATABASE_URL", "")
        if async_url:
            return async_url.replace("postgresql+asyncpg", "postgresql", 1)
        raise RuntimeError(
            "未找到数据库连接配置。请设置环境变量 SCHEDULER_DATABASE_SYNC_URL 或 SCHEDULER_DATABASE_URL。"
            "参考 .env.example 文件配置。"
        )
    else:
        url = os.environ.get("SCHEDULER_DATABASE_URL")
        if url:
            return url
        raise RuntimeError(
            "未找到数据库连接配置。请设置环境变量 SCHEDULER_DATABASE_URL。"
            "参考 .env.example 文件配置。"
        )


def create_tables_sync(sync_engine) -> None:
    """使用同步引擎创建所有数据表"""
    if MODELS_AVAILABLE:
        print("[INFO] 使用应用模型创建数据表...")
        Base.metadata.create_all(bind=sync_engine)
    else:
        print("[INFO] 应用模型不可用，使用原始SQL创建基础表...")
        # 兜底：至少创建 time_slots 表（结构与 ORM 模型一致）
        with sync_engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS time_slots (
                    id SERIAL PRIMARY KEY,
                    day_of_week INTEGER NOT NULL,
                    slot_code VARCHAR(5) NOT NULL,
                    start_time VARCHAR(10) NOT NULL,
                    end_time VARCHAR(10) NOT NULL,
                    is_continuous BOOLEAN DEFAULT TRUE,
                    exam_date DATE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            conn.commit()


def init_time_slots_sync(session: Session) -> int:
    """同步方式初始化时段数据"""
    inserted_count = 0

    if MODELS_AVAILABLE:
        # 使用ORM模型方式
        existing = session.execute(select(TimeSlot)).scalars().all()
        existing_keys = {(slot.day_of_week, slot.slot_code) for slot in existing}

        # 名称映射到 slot_code
        slot_code_map = {
            "上午第1场": "T1", "上午第2场": "T2",
            "下午第1场": "T3", "下午第2场": "T4",
        }

        for day_config in TIME_SLOT_CONFIG:
            for slot_data in day_config["slots"]:
                # 从 "周一上午第1场" 中提取 "上午第1场"
                name = slot_data["name"]
                suffix = name[2:]  # 去掉 "周一"、"周二" 等前缀
                slot_code = slot_code_map.get(suffix, "T1")
                key = (day_config["day_of_week"], slot_code)
                if key not in existing_keys:
                    # T2和T3之间不连续（午休）
                    is_continuous = slot_code in ("T1", "T3")
                    time_slot = TimeSlot(
                        day_of_week=day_config["day_of_week"],
                        slot_code=slot_code,
                        start_time=slot_data["start"].strftime("%H:%M"),
                        end_time=slot_data["end"].strftime("%H:%M"),
                        is_continuous=is_continuous,
                    )
                    session.add(time_slot)
                    inserted_count += 1
        session.commit()
    else:
        # 使用原始SQL方式
        slot_code_map = {
            "上午第1场": "T1", "上午第2场": "T2",
            "下午第1场": "T3", "下午第2场": "T4",
        }
        for day_config in TIME_SLOT_CONFIG:
            for slot_data in day_config["slots"]:
                name = slot_data["name"]
                suffix = name[2:]
                slot_code = slot_code_map.get(suffix, "T1")
                is_continuous = slot_code in ("T1", "T3")

                # 检查是否已存在
                result = session.execute(
                    text("SELECT id FROM time_slots WHERE day_of_week = :dow AND slot_code = :code"),
                    {"dow": day_config["day_of_week"], "code": slot_code},
                ).fetchone()

                if result is None:
                    session.execute(
                        text(
                            """
                            INSERT INTO time_slots (day_of_week, slot_code, start_time, end_time, is_continuous)
                            VALUES (:day_of_week, :slot_code, :start_time, :end_time, :is_continuous)
                            """
                        ),
                        {
                            "day_of_week": day_config["day_of_week"],
                            "slot_code": slot_code,
                            "start_time": slot_data["start"].strftime("%H:%M"),
                            "end_time": slot_data["end"].strftime("%H:%M"),
                            "is_continuous": is_continuous,
                        },
                    )
                    inserted_count += 1
        session.commit()

    return inserted_count


def init_database() -> None:
    """数据库主初始化函数（同步入口）"""
    print("=" * 60)
    print("考试排考系统 - 数据库初始化")
    print("=" * 60)

    # 获取数据库连接
    db_url = get_database_url(sync=True)
    print("数据库真实URL:", db_url)
    print(f"[INFO] 数据库连接: {db_url.replace('://', '://***:***@')}")

    try:
        # 创建同步引擎
        sync_engine = create_engine(db_url, echo=False)

        # 测试连接
        with sync_engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            pg_version = result.scalar()
            print(f"[OK] PostgreSQL连接成功: {pg_version[:40]}...")

        # 创建数据表
        print("[INFO] 创建数据表...")
        create_tables_sync(sync_engine)
        print("[OK] 数据表创建完成")

        # 初始化时段数据
        print("[INFO] 初始化考试时段数据...")
        SessionLocal = sessionmaker(bind=sync_engine)
        with SessionLocal() as session:
            count = init_time_slots_sync(session)
            if count > 0:
                print(f"[OK] 已插入 {count} 个时段")
            else:
                print("[OK] 时段数据已存在，跳过插入")

        # 统计时段数量
        with SessionLocal() as session:
            result = session.execute(text("SELECT COUNT(*) FROM time_slots"))
            total = result.scalar()
            print(f"[OK] 当前时段总数: {total}")

        print("=" * 60)
        print("[OK] 数据库初始化完成!")
        print("=" * 60)

    except Exception as e:
        print(f"[ERROR] 数据库初始化失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    init_database()
