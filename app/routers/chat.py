"""
AI 聊天助手路由

提供 SSE 流式对话接口，支持：
1. 基础模式：使用正则表达式进行意图识别（无需 API Key）
2. DeepSeek 模式：使用 DeepSeek LLM 进行意图识别和工具调用
"""

import asyncio
import json
import os
import re
from typing import AsyncGenerator, Optional

from dotenv import load_dotenv
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

load_dotenv()

router = APIRouter(tags=["AI 助手"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    sessionId: str = "default"
    messages: list[ChatMessage] = []


# ============================================================
# 意图识别与工具调用（基础模式）
# ============================================================

# 星期映射
DAY_MAP = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "星期一": 1, "星期二": 2, "星期三": 3, "星期四": 4, "星期五": 5,
    "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5,
    "mon": 1, "tue": 2, "wed": 3, "thu": 4, "fri": 5,
}

# 时段映射
SLOT_MAP = {
    "t1": "T1", "上午1": "T1", "上午第一节": "T1",
    "t2": "T2", "上午2": "T2", "上午第二节": "T2",
    "t3": "T3", "下午1": "T3", "下午第一节": "T3",
    "t4": "T4", "下午2": "T4", "下午第二节": "T4",
}


def parse_day_from_message(message: str) -> Optional[int]:
    """从消息中解析星期"""
    msg = message.lower()

    patterns = [
        r'周([一二三四五])',
        r'星期([一二三四五])',
        r'(周一|周二|周三|周四|周五)',
    ]

    for pattern in patterns:
        match = re.search(pattern, msg)
        if match:
            day_text = match.group(1) if match.lastindex else match.group(0)
            if day_text in DAY_MAP:
                return DAY_MAP[day_text]

    return None


def parse_slot_from_message(message: str) -> Optional[str]:
    """从消息中解析时段"""
    msg = message.lower()

    match = re.search(r'\b(t[1-4])\b', msg)
    if match:
        return match.group(1).upper()

    if "上午" in msg or "早上" in msg or " morning" in msg:
        if "一" in msg or "第一节" in msg:
            return "T1"
        elif "二" in msg or "第二节" in msg:
            return "T2"
    if "下午" in msg or " afternoon" in msg:
        if "一" in msg or "第一节" in msg:
            return "T3"
        elif "二" in msg or "第二节" in msg:
            return "T4"

    return None


def detect_classroom_query(message: str) -> bool:
    """检测是否在询问教室"""
    msg = message.lower()
    keywords = ["教室", "空教室", "空闲", "教室状态", "哪间"]
    return any(k in msg for k in keywords)


def detect_all_classroom_query(message: str) -> bool:
    """检测是否在询问所有教室（含状态）"""
    msg = message.lower()
    return "所有" in msg or "全部" in msg or "有多少" in msg


# ============================================================
# 通用回复模板
# ============================================================

WELCOME_MESSAGE = "你好！我是排考小助手，可以帮助你查询教室、安排考试等。请问有什么可以帮你的？"

GENERAL_TEMPLATES = {
    "教师": "系统中的监考教师分为专任和兼职两类。你可以在「基础数据」→「教师管理」中查看和管理教师信息。",
    "考试": "当前考试状态分为：待排、已排、失败。你可以进入「排考结果」→「总览矩阵」查看所有考试的安排情况。",
    "排考": "你可以进入「自动排考」页面，勾选需要排考的课程，点击「开始自动排考」按钮，系统将使用运筹优化算法自动分配教室和监考教师。",
    "调剂": "如果需要调整监考教师，可以进入「教师调剂」页面，支持交换场次、转移监考等操作。",
}


# ============================================================
# 模式选择
# ============================================================

def is_deepseek_mode() -> bool:
    """检查是否启用 DeepSeek 模式

    优先读取环境变量（Docker env_file 或 os.environ），
    本地开发时通过 load_dotenv() 从 .env 文件读取
    """
    load_dotenv()  # 本地开发时从 .env 加载；Docker 环境下变量已通过 env_file 注入，此调用无害
    return os.getenv("USE_DEEPSEEK", "false").lower() == "true"


# ============================================================
# 基础模式：正则表达式处理
# ============================================================

async def process_message_basic(user_message: str) -> dict | str:
    """处理用户消息（基础模式，使用正则表达式）"""

    # 1. 检查是否查询教室
    if detect_classroom_query(user_message):
        from app.tools.classroom_tools import query_classrooms

        day_of_week = parse_day_from_message(user_message)
        slot_code = parse_slot_from_message(user_message)
        show_all = detect_all_classroom_query(user_message)

        data = await query_classrooms(
            day_of_week=day_of_week,
            slot_code=slot_code,
            show_all=show_all
        )

        return {"type": "tool", "tool": "query_classrooms", "data": data}

    # 2. 通用模板回复
    message_lower = user_message.lower()
    for keyword, template in GENERAL_TEMPLATES.items():
        if keyword in message_lower:
            return template

    # 3. 默认回复
    return WELCOME_MESSAGE


async def generate_response_basic(user_message: str) -> AsyncGenerator[str, None]:
    """生成回复（基础模式）"""
    result = await process_message_basic(user_message)

    if isinstance(result, dict) and result.get("type") == "tool":
        chunk = json.dumps({
            "type": "tool_result",
            "tool": result["tool"],
            "data": result["data"]
        })
        yield f"data: {chunk}\n\n"
    else:
        for char in result:
            chunk = json.dumps({"type": "text", "content": char})
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.015)

    done_chunk = json.dumps({"type": "done"})
    yield f"data: {done_chunk}\n\n"


# ============================================================
# DeepSeek 模式
# ============================================================

async def generate_response_deepseek(messages: list[dict]) -> AsyncGenerator[str, None]:
    """生成回复（DeepSeek 模式）"""
    from app.services.ai_service import stream_chat

    async for chunk in stream_chat(messages):
        yield chunk


# ============================================================
# API 端点
# ============================================================

@router.post("/stream")
async def chat_stream(body: ChatRequest) -> StreamingResponse:
    """
    SSE 流式对话接口

    请求体:
    {
        "sessionId": "session_xxx",  // 可选
        "messages": [
            {"role": "user", "content": "周三T2有哪些空教室？"}
        ]
    }

    响应: text/event-stream

    配置说明:
    - 基础模式（默认）：使用正则表达式进行意图识别，无需配置 API Key
    - DeepSeek 模式：在 .env 中设置 USE_DEEPSEEK=true 并配置 DEEPSEEK_API_KEY
    """

    async def generate():
        try:
            # 转换消息格式
            converted_messages = [
                {"role": m.role, "content": m.content}
                for m in body.messages
            ]

            if is_deepseek_mode():
                # DeepSeek 模式
                async for chunk in generate_response_deepseek(converted_messages):
                    yield chunk
            else:
                # 基础模式
                user_messages = [m for m in converted_messages if m["role"] == "user"]
                latest_message = user_messages[-1]["content"] if user_messages else ""

                async for chunk in generate_response_basic(latest_message):
                    yield chunk

        except Exception as e:
            error_chunk = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_chunk}\n\n"
            done_chunk = json.dumps({"type": "done"})
            yield f"data: {done_chunk}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status")
async def chat_status():
    """获取聊天服务状态"""
    deepseek_enabled = is_deepseek_mode()

    status = {
        "mode": "deepseek" if deepseek_enabled else "basic",
        "deepseek_configured": False,
        "message": ""
    }

    if deepseek_enabled:
        try:
            from app.services.ai_service import is_configured
            status["deepseek_configured"] = is_configured()
            if not status["deepseek_configured"]:
                status["message"] = "DeepSeek 模式已启用但 API Key 未配置"
        except ImportError:
            status["message"] = "DeepSeek 服务未安装"
            status["mode"] = "basic"
    else:
        status["message"] = "基础模式：使用正则表达式进行意图识别"

    return status
