"""
DeepSeek AI 服务 - 支持 Function Calling

提供意图识别和工具调用能力。
工作流程：
  1. 非流式调用 DeepSeek，检测是否需要调用工具
  2. 如需调用工具，执行 Python 函数，将结果追加到消息历史
  3. 非流式获取最终回复，模拟流式输出返回前端
"""

import os
import json
import re
import traceback
import asyncio
from typing import AsyncGenerator, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


# ============================================================
# SSE 工具函数
# ============================================================

def make_sse(data: dict) -> str:
    """
    将 dict 编码成 SSE "data: ...\n\n" 格式。
    正确处理中文（ensure_ascii=False）。
    注意：不能用 f-string 拼接 json_str，JSON 中的 '}' 会被误认为 f-string 结束符。
    """
    json_str = json.dumps(data, ensure_ascii=False)
    return "data: " + json_str + "\n\n"


# ============================================================
# 工具定义（与 DeepSeek Function Calling 格式一致）
# ============================================================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_classrooms",
            "description": "查询教室状态，包括已占用和空闲教室。支持按星期、时段、指定教室筛选。当用户询问教室、空闲教室、教室状态、排考安排时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "day_of_week": {
                        "type": "integer",
                        "description": "星期几（1=星期一, 2=星期二, ..., 5=星期五）。用户提到周一/星期一等时传入对应数字，未指定时不传。",
                        "enum": [1, 2, 3, 4, 5]
                    },
                    "slot_code": {
                        "type": "string",
                        "description": "时段代码，支持单个值或多值逗号分隔。T1=上午第一节，T2=上午第二节，T3=下午第一节，T4=下午第二节。用户说'上午'→'T1,T2'，'下午'→'T3,T4'，'上午第一节'→'T1'，以此类推。"
                    },
                    "classroom": {
                        "type": "string",
                        "description": "指定教室名称，如 '5-201' 或 '5-201,5-202'。用户明确提到某间或多间教室时传入，如'查5-201教室'→'5-201'。未指定时不传。"
                    },
                    "show_all": {
                        "type": "boolean",
                        "description": "是否显示所有教室（包含已占用）。用户问'所有教室''全部教室'时设为 true，默认 false 只显示空闲。",
                        "default": False
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_teacher_assignments",
            "description": "查询教师的监考安排，包括固定监考和流动监考。当用户询问某位老师的监考安排、监考场次时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_name": {
                        "type": "string",
                        "description": "教师姓名，支持模糊匹配。如'张老师'→'张'，'李明'→'李明'。用户提到某位老师时传入。"
                    },
                    "day_of_week": {
                        "type": "integer",
                        "description": "可选，过滤星期几（1=星期一, ..., 5=星期五）。用户指定某天时传入，未指定时不传。",
                        "enum": [1, 2, 3, 4, 5]
                    }
                },
                "required": ["teacher_name"]
            }
        }
    }
]


# ============================================================
# DeepSeek API 客户端
# ============================================================

class DeepSeekClient:
    """DeepSeek API 客户端，支持非流式调用"""

    def __init__(self, api_key: Optional[str] = None, model: str = DEEPSEEK_MODEL):
        self.api_key = api_key or DEEPSEEK_API_KEY
        self.model = model
        self.base_url = DEEPSEEK_BASE_URL

        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY 未配置，请在 .env 文件中设置")

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def chat_non_stream(
        self,
        messages: list[dict],
        tools: list[dict] = None,
        temperature: float = 0.7,
    ) -> dict:
        """非流式调用 DeepSeek，返回完整响应 dict。用于检测是否需要调用工具。"""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._get_headers(),
                json=payload,
            )
            if response.status_code != 200:
                error_text = response.text
                raise Exception(f"DeepSeek API 错误: {response.status_code} - {error_text[:500]}")
            return response.json()


# ============================================================
# 工具注册表
# ============================================================

TOOL_FUNCTIONS = {}


def register_tool(name: str, func):
    """注册工具函数"""
    TOOL_FUNCTIONS[name] = func


def init_tools():
    """初始化所有工具函数"""
    from app.tools.classroom_tools import query_classrooms
    from app.tools.teacher_tools import query_teacher_assignments
    register_tool("query_classrooms", query_classrooms)
    register_tool("query_teacher_assignments", query_teacher_assignments)


# ============================================================
# 核心：流式对话处理（SSE 输出）
# ============================================================

async def stream_chat(
    messages: list[dict],
    session_id: str = "default"
) -> AsyncGenerator[str, None]:
    """
    流式对话处理，yield SSE 格式字符串。

    Yields:
        SSE 格式字符串，如 'data: {"type":"text","content":"你好"}\n\n'
    """
    client = DeepSeekClient()

    if not TOOL_FUNCTIONS:
        init_tools()

    def sse(data: dict) -> str:
        """局部 SSE 编码函数，避免变量名冲突"""
        return make_sse(data)

    try:
        system_message = {
            "role": "system",
            "content": """你是一个考试安排管理系统的智能助手。

你的职责：
1. 回答用户关于教室查询、考试安排、教师监考安排等问题
2. 当用户询问空闲教室、教室状态、排考安排时，必须调用 query_classrooms 工具
3. 当用户询问某位老师的监考安排、监考场次时，必须调用 query_teacher_assignments 工具
4. 用简洁友好的中文回复，不要复述工具结果
5. 如果用户只是闲聊，简短回应即可

【角色约束——你必须严格遵守】：
1. 你只能回答与考试安排、教室查询、考试管理相关的问题。
2. 当用户询问与考试安排无关的问题（如编程、数学、通用知识等）时，你应该礼貌地告知用户你只负责考试安排管理，并引导用户咨询相关问题。
3. 即使用户要求你详细回答非考试安排问题，你也必须礼貌拒绝，不得展开回答。
4. 你的职责是帮助教师和管理员进行考试安排管理，不是通用AI助手。

重要：
- 调用 query_classrooms 工具时，必须严格按用户描述提取参数，不要遗漏：
  - 星期：用户说"周一"或"星期一" → day_of_week=1，"周二"→2，以此类推；用户没提星期 → 不传此参数
  - 时段：用户说"上午第一节"→ slot_code="T1"，"上午第二节"→"T2"，"下午第一节"→"T3"，"下午第二节"→"T4"
      * 用户说"上午"（不指定第几节）→ slot_code="T1,T2"（传两个时段）
      * 用户说"下午"（不指定第几节）→ slot_code="T3,T4"（传两个时段）
      * 用户没提时段 → 不传此参数
  - 关键：用户同时提到星期和时段（如"周一上午"）→ 两个参数都要传，不能只传一个
  - 指定教室：用户通常用简称，你需要映射到全称：
      "201"、"5-201" → "5-201"
      "202"、"5-202" → "5-202"
      ... 以此类推，理东二 → "理东二"
      用户说"201和202" → classroom="5-201,5-202"
  - 用户没指定教室 → 不传 classroom 参数，让工具返回所有教室
- 调用 query_teacher_assignments 工具时，必须严格按用户描述提取参数：
  - teacher_name：用户提到的教师姓名，如"张老师""李明""王教授"→ 提取姓名部分
  - day_of_week：用户指定某天时传入（如"周一""星期一"→1），未指定时不传此参数
  - 关键：即使用户要求详细回答，如果你有相关工具，必须调用工具获取数据，不得自行编造
- 如果你没有相关的工具来完成用户的请求（例如：修改排考、删除考试等），请诚实告知用户"抱歉，我目前还不支持这个功能，请联系管理员添加相关功能。"
- 不要编造不存在的功能或数据。

【反幻觉强制规则——你必须严格遵守】：
1. 你只能基于工具返回的 JSON 数据回答，绝对不得自行推断、补充或编造任何教师姓名、教室名称、课程名称或监考场次。
2. 工具返回的数据中包含 "teacher" 对象，你回答时提到的教师姓名，必须能在工具返回的数据中找到。
3. 如果工具返回 "found": false，请直接告诉用户"未找到该教师，请确认姓名是否正确"，严禁自行列举任何教师姓名。
4. 如果工具返回 "found": true 但 "assignments" 为空数组且 "patrol_slots" 为空数组，请直接告诉用户"该教师暂无监考安排"，严禁编造任何监考信息。
5. 当用户追问（如"李老师呢？""那王老师呢？"）时，你必须再次调用 query_teacher_assignments 工具，绝对不能基于"记忆"或想象回答。
6. 回答前，请先在脑海中核对：你提到的任何教师姓名、教室名称、课程名称、监考场次，是否都出现在工具返回的数据中。只要有一次核对失败，就不要输出那个名称。
7. 当用户的问题不需要调用工具时，直接回答，同样不得编造数据。

【空结果处理示例——必须严格遵守】：
- 工具返回 {"found": false, "message": "未找到..."} → 你只能回答"未找到该教师，请确认姓名是否正确"
- 工具返回 {"found": true, "teacher": {"name": "周建军"}, "assignments": [], "patrol_slots": []} → 你只能回答"周建军老师暂无监考安排"
- 绝对禁止在工具返回空结果时编造任何监考场次、教室或课程信息

【追问处理示例】：
- 用户先问："查询梅老师的监考安排" → 你必须调用 query_teacher_assignments 工具，参数 teacher_name="梅"
- 用户追问："李老师呢？" → 你必须再次调用 query_teacher_assignments 工具，参数 teacher_name="李"
- 绝对不要基于"记忆"或"想象"回答，每次都必须调用工具获取真实数据
- 如果用户只说"他呢？""她呢？"，且上下文中有提到某位老师，你可以推测并调用工具，但如果不确定，请先问清楚是哪一位老师"""
        }

        full_messages = [system_message] + messages

        # ── 第 1 步：非流式调用，检测 tool_call ─────────────
        first_resp = await client.chat_non_stream(full_messages, tools=TOOLS)
        choice = first_resp["choices"][0]
        assistant_msg = choice["message"]

        # ── 第 2 步：如有 tool_call，执行工具 ────────────────
        if assistant_msg.get("tool_calls"):
            tool_call = assistant_msg["tool_calls"][0]
            func_name = tool_call["function"]["name"]
            func_args = json.loads(tool_call["function"]["arguments"])

            # 容错：统一参数名（AI 可能返回 class_room 而非 classroom）
            if "class_room" in func_args and "classroom" not in func_args:
                func_args["classroom"] = func_args.pop("class_room")

            # 向前端发送"正在查询"提示
            yield sse({"type": "text", "content": f"[正在查询{func_name}...]\n"})

            tool_func = TOOL_FUNCTIONS.get(func_name)
            if not tool_func:
                yield sse({"type": "error", "content": f"未知工具: {func_name}"})
                yield sse({"type": "done"})
                return

            # 执行工具函数
            try:
                result = await tool_func(**func_args)
            except Exception as tool_e:
                yield sse({"type": "error", "content": f"工具执行失败: {tool_e}"})
                yield sse({"type": "done"})
                return

            # 向前端发送 tool_result 事件（前端渲染成表格卡片）
            print(f"[DEBUG] Sending tool_result: tool={func_name}, data keys={list(result.keys()) if isinstance(result, dict) else type(result)}")
            yield sse({"type": "tool_result", "tool": func_name, "data": result})

            # ── 反幻觉：空结果直接返回，不经过 LLM 生成 ────────────
            # 当工具返回未找到或空数据时，直接返回标准回复，不给 LLM 编造数据的机会
            is_empty_teacher = func_name == "query_teacher_assignments" and (
                not result.get("found", True) or
                (not result.get("assignments") and not result.get("patrol_slots"))
            )

            if is_empty_teacher:
                teacher_name = func_args.get("teacher_name", "该教师")
                if not result.get("found", True):
                    reply = f"未找到名为「{teacher_name}」的教师，请确认姓名是否正确。"
                else:
                    reply = f"{result['teacher']['name']}老师暂无监考安排。"
                yield sse({"type": "text", "content": reply})
                yield sse({"type": "done"})
                return

            # 将 tool_call 和 tool_result 追加到消息历史（严格按照 OpenAI 格式）
            # 注意：role 必须是 "assistant"（不能拼错！），content 为 None 时要省略该字段
            assistant_content = assistant_msg.get("content")
            tool_call_msg = {
                "role": "assistant",
                "tool_calls": assistant_msg["tool_calls"]
            }
            if assistant_content is not None:
                tool_call_msg["content"] = assistant_content
            full_messages.append(tool_call_msg)

            full_messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": json.dumps(result, ensure_ascii=False)
            })

            # ── 第 3 步：非流式获取最终回复，然后手动 SSE 输出 ─────────
            # 使用低 temperature 避免模型在基于工具结果回答时自由发挥/编造数据
            final_resp = await client.chat_non_stream(full_messages, tools=None, temperature=0.1)
            final_content = final_resp["choices"][0]["message"].get("content", "")

            # 模拟流式输出（逐块发送）
            if final_content:
                chunks = re.split(r'([，。！？\s]+)', final_content)
                current_text = ""
                for chunk in chunks:
                    if not chunk:
                        continue
                    current_text += chunk
                    if len(current_text) >= 5 or re.search(r'[，。！？]$', chunk):
                        yield sse({"type": "text", "content": current_text})
                        current_text = ""
                        await asyncio.sleep(0.02)
                if current_text:
                    yield sse({"type": "text", "content": current_text})

        else:
            # ── 无工具调用：直接返回内容 ────────────────────
            content = assistant_msg.get("content", "")
            if content:
                yield sse({"type": "text", "content": content})

        # ── 第 4 步：发送完成信号 ──────────────────────────
        yield sse({"type": "done"})

    except Exception as e:
        traceback.print_exc()
        try:
            yield sse({"type": "error", "content": str(e)})
        except Exception:
            pass
        try:
            yield sse({"type": "done"})
        except Exception:
            pass


# ============================================================
# 工具函数（供外部调用）
# ============================================================

async def call_tool(tool_name: str, arguments: dict) -> dict:
    """调用指定的工具函数"""
    if not TOOL_FUNCTIONS:
        init_tools()
    if tool_name not in TOOL_FUNCTIONS:
        raise ValueError(f"未知工具: {tool_name}")
    return await TOOL_FUNCTIONS[tool_name](**arguments)


def get_available_tools() -> list[dict]:
    """获取所有可用的工具定义"""
    return TOOLS


def is_configured() -> bool:
    """检查是否已配置 API Key"""
    return bool(DEEPSEEK_API_KEY and DEEPSEEK_API_KEY != "your-deepseek-api-key-here")
