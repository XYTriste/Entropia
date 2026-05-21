"""
DeepSeek AI 服务 - 支持 Function Calling

提供意图识别和工具调用能力。
工作流程:
  1. 非流式调用 DeepSeek,检测是否需要调用工具
  2. 如需调用工具,执行 Python 函数,将结果追加到消息历史
  3. 非流式获取最终回复,模拟流式输出返回前端
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
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")


# ============================================================
# SSE 工具函数
# ============================================================

def make_sse(data: dict) -> str:
    """
    将 dict 编码成 SSE "data: ...\n\n" 格式。
    正确处理中文(ensure_ascii=False)。
    注意:不能用 f-string 拼接 json_str,JSON 中的 '}' 会被误认为 f-string 结束符。
    """
    json_str = json.dumps(data, ensure_ascii=False)
    return "data: " + json_str + "\n\n"


# ============================================================
# 工具定义(与 DeepSeek Function Calling 格式一致)
# ============================================================

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_classrooms",
            "description": (
                "查询教室状态,包括已占用和空闲教室,以及每个考试的固定监考和流动监考老师信息。"
                "当用户询问教室、空闲教室、教室状态、排考安排、教室监考安排时调用此工具。"
                "参数规则:(1)day_of_week:周一→1,未指定则不传。"
                "(2)slot_code:'上午第一节'→'T1','上午'→'T1,T2',未指定则不传。"
                "(3)classroom:'201'→'5-201',未指定则不传。"
                "用户同时提到星期和时段(如'周一上午'),两个参数都要传。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "day_of_week": {
                        "type": "integer",
                        "description": "星期几(1=星期一, 2=星期二, ..., 5=星期五)。用户提到周一/星期一等时传入对应数字,未指定时不传。",
                        "enum": [1, 2, 3, 4, 5]
                    },
                    "slot_code": {
                        "type": "string",
                        "description": "时段代码,支持单个值或多值逗号分隔。T1=上午第一节,T2=上午第二节,T3=下午第一节,T4=下午第二节。用户说'上午'→'T1,T2','下午'→'T3,T4','上午第一节'→'T1',以此类推。"
                    },
                    "classroom": {
                        "type": "string",
                        "description": "指定教室名称,如 '5-201' 或 '5-201,5-202'。用户明确提到某间或多间教室时传入,如'查5-201教室'→'5-201'。未指定时不传。"
                    },
                    "show_all": {
                        "type": "boolean",
                        "description": "是否显示所有教室(包含已占用)。用户问'所有教室''全部教室'时设为 true,默认 false 只显示空闲。",
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
            "description": (
                "查询教师的监考安排,包括固定监考和流动监考。支持模糊匹配。"
                "当用户询问某位老师、某姓老师或所有匹配老师的监考安排时调用此工具。"
                "参数规则:(1)teacher_name:'张老师'→'张','李明'→'李明','所有李姓老师'→'李'。"
                "(2)day_of_week:指定某天时传入(如'周一'→1),未指定则不传。"
                "注意:匹配多位教师时工具返回 teachers 数组,你必须基于每位教师的实际数据分别说明,不得推断或编造。"
                "示例:用户问'查所有李姓老师'→参数 teacher_name='李'→工具返回 teachers 数组→逐个教师回答,有安排则列出,无安排则说明。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_name": {
                        "type": "string",
                        "description": "教师姓名,支持模糊匹配。如'张老师'→'张','李明'→'李明','所有李姓老师'→'李'。用户提到某位老师时传入。"
                    },
                    "day_of_week": {
                        "type": "integer",
                        "description": "可选,过滤星期几(1=星期一, ..., 5=星期五)。用户指定某天时传入,未指定时不传。",
                        "enum": [1, 2, 3, 4, 5]
                    }
                },
                "required": ["teacher_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_teacher_conflicts",
            "description": (
                "检测多位教师之间的监考时间冲突。"
                "当用户询问两位及以上教师的监考是否有冲突、时间是否重叠、是否撞车时调用此工具。"
                "输入教师姓名列表(支持模糊匹配),返回结构化的冲突检测结果。"
                "注意:单个教师查询冲突(如'查张老师的冲突')无意义,请改用 query_teacher_assignments。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "teacher_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "教师姓名列表,如 [\"梅鹏飞\", \"李婷\"]。支持模糊匹配。"
                    }
                },
                "required": ["teacher_names"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_class_exams",
            "description": (
                "查询班级的考试安排,包括考试时间、课程、教室、监考教师等信息。"
                "当用户询问某班、某年级、某专业的考试安排,或'哪天考试'、'考什么'时调用此工具。"
                "支持模糊匹配班级名称(如'软件'可匹配'软件工程2301')。"
                "参数规则:(1)class_name:用户提到的班级名称,如'软件工程2301'、'计算机1班'。"
                "(2)day_of_week:指定某天时传入(如'周一'→1),未指定则不传。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "class_name": {
                        "type": "string",
                        "description": "班级名称,支持模糊匹配。如'软件工程2301'、'计算机1班'。"
                    },
                    "day_of_week": {
                        "type": "integer",
                        "description": "可选,过滤星期几(1=星期一, ..., 5=星期五)。用户指定某天时传入,未指定时不传。",
                        "enum": [1, 2, 3, 4, 5]
                    }
                },
                "required": ["class_name"]
            }
        }
    }
]


# ============================================================
# DeepSeek API 客户端
# ============================================================

class DeepSeekClient:
    """DeepSeek API 客户端,支持非流式调用"""

    def __init__(self, api_key: Optional[str] = None, model: str = DEEPSEEK_MODEL):
        self.api_key = api_key or DEEPSEEK_API_KEY
        self.model = model
        self.base_url = DEEPSEEK_BASE_URL

        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY 未配置,请在 .env 文件中设置")

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
        """非流式调用 DeepSeek,返回完整响应 dict。用于检测是否需要调用工具。"""
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
    from app.tools.teacher_tools import query_teacher_assignments, check_teacher_conflicts
    from app.tools.class_tools import query_class_exams
    register_tool("query_classrooms", query_classrooms)
    register_tool("query_teacher_assignments", query_teacher_assignments)
    register_tool("check_teacher_conflicts", check_teacher_conflicts)
    register_tool("query_class_exams", query_class_exams)


# ============================================================
# 核心:流式对话处理(SSE 输出)
# ============================================================

async def stream_chat(
    messages: list[dict],
    session_id: str = "default"
) -> AsyncGenerator[str, None]:
    """
    流式对话处理,yield SSE 格式字符串。

    Yields:
        SSE 格式字符串,如 'data: {"type":"text","content":"你好"}\n\n'
    """
    client = DeepSeekClient()

    if not TOOL_FUNCTIONS:
        init_tools()

    def sse(data: dict) -> str:
        """局部 SSE 编码函数,避免变量名冲突"""
        return make_sse(data)

    try:
        system_message = {
            "role": "system",
            "content": """你是考试安排管理系统的智能助手,你的名字叫做小白。

规则:
- 必须基于工具返回的数据回答,不得编造任何教师姓名、教室名称、课程名称或监考信息
- 如果用户只是闲聊,简短回应即可
- 如果用户询问你的名称,可以告诉他你叫小白
- 不支持的功能,诚实告知即可"""
        }

        full_messages = [system_message] + messages

        # ── 第 1 步:非流式调用,检测 tool_call ─────────────
        first_resp = await client.chat_non_stream(full_messages, tools=TOOLS)
        choice = first_resp["choices"][0]
        assistant_msg = choice["message"]

        # ── 第 2 步:如有 tool_call,执行工具 ────────────────
        if assistant_msg.get("tool_calls"):
            tool_calls = assistant_msg["tool_calls"]
            tool_results: list[dict] = []  # 收集所有工具结果
            has_error = False
            all_empty = True  # 是否所有结果都为空

            for tc in tool_calls:
                func_name = tc["function"]["name"]
                func_args = json.loads(tc["function"]["arguments"])

                # 容错:统一参数名(AI 可能返回 class_room 而非 classroom)
                if "class_room" in func_args and "classroom" not in func_args:
                    func_args["classroom"] = func_args.pop("class_room")

                # 向前端发送"正在查询"提示
                yield sse({"type": "text", "content": f"[正在查询{func_name}...]\n"})

                tool_func = TOOL_FUNCTIONS.get(func_name)
                if not tool_func:
                    yield sse({"type": "error", "content": f"未知工具: {func_name}"})
                    has_error = True
                    continue

                # 执行工具函数
                try:
                    result = await tool_func(**func_args)
                except Exception as tool_e:
                    yield sse({"type": "error", "content": f"工具执行失败: {tool_e}"})
                    has_error = True
                    continue

                # 向前端发送 tool_result 事件
                print(f"[DEBUG] Sending tool_result: tool={func_name}, data keys={list(result.keys()) if isinstance(result, dict) else type(result)}")
                yield sse({"type": "tool_result", "tool": func_name, "data": result})

                # 反幻觉判断:教师查询空结果
                is_empty_teacher = func_name == "query_teacher_assignments" and (
                    not result.get("found", True) or
                    (not result.get("assignments") and not result.get("patrol_slots"))
                )

                if is_empty_teacher:
                    teacher_name = func_args.get("teacher_name", "该教师")
                    if not result.get("found", True):
                        yield sse({"type": "text", "content": f"未找到名为「{teacher_name}」的教师,请确认姓名是否正确。\n"})
                    else:
                        yield sse({"type": "text", "content": f"{result['teacher']['name']}老师暂无监考安排。\n"})
                    # 空结果仍需追加到消息历史,否则 OpenAI 格式校验会报错
                    tool_results.append({"tc": tc, "result": result})
                else:
                    all_empty = False
                    tool_results.append({"tc": tc, "result": result})

            # 如果出现严重错误且无有效结果,直接结束
            if has_error and not tool_results:
                yield sse({"type": "done"})
                return

            # 如果所有结果都为空(教师查询未找到),直接结束,不经过 LLM
            if all_empty and tool_results:
                yield sse({"type": "done"})
                return

            # 将 tool_calls 和所有 tool_results 追加到消息历史(严格按照 OpenAI 格式)
            assistant_content = assistant_msg.get("content")
            tool_call_msg = {
                "role": "assistant",
                "tool_calls": tool_calls
            }
            if assistant_content is not None:
                tool_call_msg["content"] = assistant_content
            full_messages.append(tool_call_msg)

            for tr in tool_results:
                full_messages.append({
                    "role": "tool",
                    "tool_call_id": tr["tc"]["id"],
                    "content": json.dumps(tr["result"], ensure_ascii=False)
                })

            # ── 第 3 步:非流式获取最终回复,然后手动 SSE 输出 ─────────
            # 注入格式提示到消息末尾,确保上下文较长时仍遵守输出格式
            format_hint = {
                "role": "user",
                "content": (
                    "请基于以上工具返回的数据整理回复。"
                    "涉及多条记录时使用 Markdown 表格,格式:| 时间 | 教室 | 课程 | 班级 |"
                    "单条记录用简洁文字描述即可。"
                    "不要暴露工具调用的技术细节。"
                )
            }
            full_messages.append(format_hint)
            # 使用低 temperature 避免模型在基于工具结果回答时自由发挥/编造数据
            final_resp = await client.chat_non_stream(full_messages, tools=None, temperature=0.1)
            final_content = final_resp["choices"][0]["message"].get("content", "")

            # 模拟流式输出(逐块发送)
            if final_content:
                chunks = re.split(r'([,。！？\s]+)', final_content)
                current_text = ""
                for chunk in chunks:
                    if not chunk:
                        continue
                    current_text += chunk
                    if len(current_text) >= 5 or re.search(r'[,。！？]$', chunk):
                        yield sse({"type": "text", "content": current_text})
                        current_text = ""
                        await asyncio.sleep(0.02)
                if current_text:
                    yield sse({"type": "text", "content": current_text})

        else:
            # ── 无工具调用:直接返回内容 ────────────────────
            content = assistant_msg.get("content", "")
            if content:
                yield sse({"type": "text", "content": content})

        # ── 第 4 步:发送完成信号 ──────────────────────────
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
# 工具函数(供外部调用)
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
