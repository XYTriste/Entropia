# 排考系统核心算法修复 -- 上下文备忘录

> 由前一轮会话整理，用于恢复上下文。
> 项目路径：D:/Code/best_exam_scheduler/exam-scheduler
> 数据库：Docker Compose 中的 PostgreSQL (exam-scheduler-db)
> 进入命令：docker compose exec db psql -U scheduler -d exam_scheduler

---

## 一、项目结构与关键文件

| 文件 | 作用 | 问题严重程度 |
|------|------|-------------|
| `app/engine/scheduler.py` | 排考主引擎 | **P0** - 核心问题集中于此 |
| `app/engine/classroom_alloc.py` | 教室分配算法 | **P1** - 缺少时段占用感知 |
| `app/engine/teacher_alloc.py` | 教师分配算法 | **P1** - 缺少时段冲突检测 |
| `app/routers/scheduler.py` | 排考路由 /run、/apply | **P0** - AB卷合并错误、apply累加错误 |
| `app/services/export_service.py` | Excel导出 | **P2** - 格式问题（第二轮修） |

---

## 二、数据库实际数据（关键事实）

### 2.1 教室（23间）
查询：SELECT id, name, capacity, room_type FROM classrooms ORDER BY id;

- 普通教室：5-201 ~ 5-219、5-303 ~ 5-320，共 **22 间**，容量全部为 **28人**。
- 阶梯教室：理东二，容量 **90人**。
- 可用教室总容量 = 22*28 + 90 = **706人**。

### 2.2 课程（10门）

id 22 大学英语读写1/2 PUBLIC t 1 (周一T1)
id 23 思想道德与法治1/2 PUBLIC t 3 (周一T3)
id 24 高等数学1/2 PUBLIC t 3 (周一T3)
id 25 Python程序设计 MAJOR f --
id 26 面向对象程序设计1/2 MAJOR f --
id 27 C语言程序设计 MAJOR f --
id 28 度安实宙 MAJOR f --
id 29 初作提供技术支肤手机功提供性丘1/2 PUBLIC t 1 (靝Ṱ)
id 30 设功提供技术支肤手机功提供性丘2/2 MAJOR f --
id 31 Cľ语评分性提供手机功提供性丘1/2 MAJOR f --
id 28 心理学 MAJOR f --
id 29 初作提供技术支肤手机功提供性丘1/2 PUBLIC t 1 (靝Ṱ)
id 30 面向对象程序设计2/2 MAJOR f --
id 31 C语言程序设计1/2 MAJOR f --
