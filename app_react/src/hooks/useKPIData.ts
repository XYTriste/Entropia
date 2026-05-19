/**
 * KPI 数据 Hook
 *
 * 从后端获取仪表盘 KPI 数据
 */

import { useState, useEffect, useCallback } from 'react';
import { getKPIData, type KPIDataResponse } from '@/api/kpi';

export interface KPIDataItem {
  label: string;
  value: number;
  unit: string;
  color: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'orange';
  hasAlert?: boolean;
}

/**
 * 将后端 KPI 数据转换为前端展示格式
 */
function transformKPIData(data: KPIDataResponse): KPIDataItem[] {
  return [
    {
      label: '已安排考试场次',
      value: data.scheduled_exams,
      unit: '场',
      color: 'blue',
    },
    {
      label: '未安排考试场次',
      value: data.pending_exams,
      unit: '场',
      color: data.pending_exams > 0 ? 'red' : 'blue',
      hasAlert: data.pending_exams > 0,
    },
    {
      label: '总考试场次',
      value: data.total_exam_sessions,
      unit: '场',
      color: 'green',
    },
    {
      label: '教室利用率',
      value: data.classroom_utilization,
      unit: '%',
      color: 'green',
    },
    {
      label: '监考教师分配率',
      value: data.teacher_assignment_rate,
      unit: '%',
      color: 'purple',
    },
    {
      label: '排考冲突告警',
      value: data.conflict_count,
      unit: '项',
      color: 'red',
      hasAlert: data.conflict_count > 0,
    },
    {
      label: '考生人次流量',
      value: data.student_flow,
      unit: '人次',
      color: 'yellow',
    },
    {
      label: '平均考场负载',
      value: data.avg_classroom_load,
      unit: '%',
      color: 'orange',
    },
  ];
}

/**
 * 获取 KPI 数据的 Hook
 */
export function useKPIData() {
  const [kpiData, setKPIData] = useState<KPIDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchKPIData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getKPIData();
      const transformedData = transformKPIData(data);
      setKPIData(transformedData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('获取 KPI 数据失败'));
      console.error('Failed to fetch KPI data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData]);

  return {
    kpiData,
    loading,
    error,
    refetch: fetchKPIData,
  };
}

export default useKPIData;
