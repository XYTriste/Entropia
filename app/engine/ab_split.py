"""
AB卷班级分配算法

功能：将课程的所有涉考班级划分为A卷和B卷两组，目标是最小化两组人数差。
约束：以班级为最小分配单位，不可拆分（硬约束HC-07）。

算法：动态规划（子集和问题变体）
- 时间复杂度：O(n * total_students)，n为班级数
- 空间复杂度：O(total_students)
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Class


def split_ab_classes(classes: list) -> tuple[list, list]:
    """
    将班级列表划分为A、B两组，使得两组人数之差的绝对值最小。

    参数:
        classes: 涉考班级列表，每个元素为 Class 对象（含 student_count 字段）

    返回:
        (group_a, group_b): 两组班级的元组

    算法说明:
        这是一个经典的"分区问题"(Partition Problem)，NP-hard，但可用伪多项式时间的
        动态规划求解。由于学生总数在1000-2000规模，DP完全可行。

    动态规划定义:
        dp[s] = True 表示存在某个子集，其学生总数恰好为 s
        parent[(i, s)] = (prev_s, class_idx) 用于回溯解
    """
    # --------------------------------------------------------
    # 步骤1: 计算总人数与目标值
    # --------------------------------------------------------
    total_students: int = sum(c.student_count for c in classes)
    target: int = total_students // 2  # 理想情况下，每组人数为总人数的一半

    # 边界情况：没有班级
    if not classes:
        return [], []

    # 边界情况：只有一个班级，全部分给A组
    if len(classes) == 1:
        return [classes[0]], []

    # --------------------------------------------------------
    # 步骤2: 动态规划求解子集和问题
    # --------------------------------------------------------
    # dp[s] = True 表示可以凑出和为 s 的子集
    # 使用字典记录路径：prev[s] = (previous_sum, class_index)
    dp: dict[int, bool] = {0: True}
    prev: dict[int, tuple[int, int]] = {}  # 用于回溯：从哪个状态和哪个班级转移而来

    for idx, cls in enumerate(classes):
        count: int = cls.student_count
        # 逆序遍历，避免同一班级被使用多次
        current_sums: list[int] = sorted(dp.keys(), reverse=True)
        for s in current_sums:
            new_sum: int = s + count
            if new_sum > target:
                continue  # 超过目标，不记录
            if new_sum not in dp:
                dp[new_sum] = True
                prev[new_sum] = (s, idx)

    # --------------------------------------------------------
    # 步骤3: 找到最接近目标的子集和
    # --------------------------------------------------------
    best_sum: int = 0
    for s in range(target, -1, -1):
        if s in dp:
            best_sum = s
            break

    # --------------------------------------------------------
    # 步骤4: 回溯找出具体班级
    # --------------------------------------------------------
    a_indices: set[int] = set()
    current: int = best_sum
    while current > 0 and current in prev:
        previous_sum, class_idx = prev[current]
        a_indices.add(class_idx)
        current = previous_sum

    # --------------------------------------------------------
    # 步骤5: 构造A、B两组
    # --------------------------------------------------------
    group_a: list = []
    group_b: list = []
    for idx, cls in enumerate(classes):
        if idx in a_indices:
            group_a.append(cls)
        else:
            group_b.append(cls)

    return group_a, group_b


# ============================================================
# 单元测试
# ============================================================
if __name__ == "__main__":
    import unittest

    class MockClass:
        """测试用模拟班级类"""
        def __init__(self, id: int, student_count: int) -> None:
            self.id = id
            self.student_count = student_count
            self.name = f"Class_{id}"
            self.grade = 1
            self.major_id = 1

    class TestABSplit(unittest.TestCase):
        """AB卷分配单元测试"""

        def test_equal_split(self):
            """测试可均等划分的情况：50, 50 -> A:50, B:50"""
            classes = [MockClass(1, 25), MockClass(2, 25), MockClass(3, 25), MockClass(4, 25)]
            group_a, group_b = split_ab_classes(classes)
            sum_a = sum(c.student_count for c in group_a)
            sum_b = sum(c.student_count for c in group_b)
            self.assertEqual(sum_a, 50)
            self.assertEqual(sum_b, 50)

        def test_unequal_split(self):
            """测试不可均等划分的情况：差值应最小化"""
            classes = [MockClass(1, 30), MockClass(2, 30), MockClass(3, 30)]
            group_a, group_b = split_ab_classes(classes)
            sum_a = sum(c.student_count for c in group_a)
            sum_b = sum(c.student_count for c in group_b)
            # 总人数90，最优划分应为45:45或尽量接近
            self.assertLessEqual(abs(sum_a - sum_b), 30)  # 至少比最差情况好

        def test_single_class(self):
            """测试单班级情况"""
            classes = [MockClass(1, 40)]
            group_a, group_b = split_ab_classes(classes)
            self.assertEqual(len(group_a), 1)
            self.assertEqual(len(group_b), 0)

        def test_empty(self):
            """测试空列表"""
            group_a, group_b = split_ab_classes([])
            self.assertEqual(len(group_a), 0)
            self.assertEqual(len(group_b), 0)

        def test_large_gap(self):
            """测试班级人数差异大的情况"""
            classes = [MockClass(1, 100), MockClass(2, 3), MockClass(3, 3), MockClass(4, 3)]
            group_a, group_b = split_ab_classes(classes)
            sum_a = sum(c.student_count for c in group_a)
            sum_b = sum(c.student_count for c in group_b)
            # 总人数109，最接近的划分是55:54或100:9
            self.assertLessEqual(abs(sum_a - sum_b), 91)

        def test_no_split_class(self):
            """
            验证HC-07：班级不可拆分。
            检查返回的每组中，每个班级对象都是完整的（不是部分人数）
            """
            classes = [MockClass(1, 35), MockClass(2, 40), MockClass(3, 35), MockClass(4, 30)]
            group_a, group_b = split_ab_classes(classes)
            # 检查所有班级都被分配且不重复
            all_classes = group_a + group_b
            self.assertEqual(len(all_classes), len(classes))
            ids_a = {c.id for c in group_a}
            ids_b = {c.id for c in group_b}
            self.assertEqual(len(ids_a & ids_b), 0)  # 无交集

    unittest.main()
