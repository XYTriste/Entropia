"""
AI 聊天助手路由 - MVP 版本

提供 SSE 流式对话接口，支持与大模型交互。
"""

import asyncio
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/api/chat", tags=["AI 助手"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    sessionId: str = "default"
    messages: list[ChatMessage] = []


# ============================================================
# MVP: 模拟 AI 回复（后续可接入真实 AI API）
# ============================================================

WELCOME_MESSAGE = "你好！我是排考小助手，可以帮助你查询教室、安排考试等。请问有什么可以帮你的？"

RESPONSE_TEMPLATES = {
    "教室": "当前系统中共有 {count} 间教室，分布在多个教学楼中。你可以进入「排考结果」→「教室视图」查看详细的教室使用情况。",
    "教师": "系统中的监考教师分为专任和兼职两类。你可以在「基础数据」→「教师管理」中查看和管理教师信息。",
    "考试": "当前考试状态分为：待排、已排、失败。你可以进入「排考结果」→「总览矩阵」查看所有考试的安排情况。",
    "排考": "你可以进入「自动排考」页面，勾选需要排考的课程，点击「开始自动排考」按钮，系统将使用运筹优化算法自动分配教室和监考教师。",
    "调剂": "如果需要调整监考教师，可以进入「教师调剂」页面，支持交换场次、转移监考等操作。",
}


async def generate_mock_response(user_message: str) -> AsyncGenerator[str, None]:
    """模拟 AI 回复的流式输出"""
    message = user_message.lower()

    # 简单关键词匹配
    response_text = WELCOME_MESSAGE
    for keyword, template in RESPONSE_TEMPLATES.items():
        if keyword in message:
            if keyword == "教室":
                response_text = template.format(count="20+")
            else:
                response_text = template
            break

    # 流式输出文字（打字机效果）
    for char in response_text:
        chunk = json.dumps({"type": "text", "content": char})
        yield f"data: {chunk}\n\n"
        await asyncio.sleep(0.02)  # 控制打字速度

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


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
    """

    async def generate():
        # 获取用户最新消息
        user_messages = [m for m in body.messages if m.role == "user"]
        latest_message = user_messages[-1].content if user_messages else ""

        # 流式返回模拟回复
        async for chunk in generate_mock_response(latest_message):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )


# ============================================================
# 预留：后续接入真实 AI API 的接口签名
# ============================================================
# @router.post("/stream/real")
# async def chat_stream_real(body: ChatRequest) -> StreamingResponse:
#     """
#     真实的 AI 对话接口（需配置 AI_API_KEY）
#     """
#     from app.services.ai_service import chat_stream as real_chat_stream
#
#     return StreamingResponse(
#         real_chat_stream(body.messages, body.sessionId),
#         media_type="text/event-stream",
#         headers={
#             "Cache-Control": "no-cache",
#             "Connection": "keep-alive",
#         },
#     )
