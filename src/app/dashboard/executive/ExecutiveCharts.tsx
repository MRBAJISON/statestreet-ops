'use client';

import { SimpleLineChart, SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import ScoreGauge from '@/components/ui/ScoreGauge';

interface ExecutiveChartsProps {
  type: 'line' | 'bar' | 'donut' | 'gauge';
  data?: { name: string; value: number; value2?: number }[];
  height?: number;
  color?: string;
  color2?: string;
  area?: boolean;
  prefix?: string;
  horizontal?: boolean;
  centerLabel?: string;
  centerValue?: string;
  colors?: string[];
  score?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  innerRadius?: number;
  outerRadius?: number;
}

export default function ExecutiveCharts({
  type,
  data,
  height,
  color,
  color2,
  area,
  prefix,
  horizontal,
  centerLabel,
  centerValue,
  colors,
  score,
  label,
  size,
  innerRadius,
  outerRadius,
}: ExecutiveChartsProps) {
  if (type === 'gauge') {
    return (
      <ScoreGauge
        score={score ?? 0}
        label={label}
        size={size || 'md'}
      />
    );
  }

  if (type === 'line') {
    return (
      <SimpleLineChart
        data={data || []}
        height={height}
        color={color}
        area={area}
        prefix={prefix}
      />
    );
  }

  if (type === 'bar') {
    return (
      <SimpleBarChart
        data={data || []}
        height={height}
        color={color}
        color2={color2}
        horizontal={horizontal}
        prefix={prefix}
      />
    );
  }

  if (type === 'donut') {
    return (
      <SimpleDonutChart
        data={data || []}
        height={height}
        centerLabel={centerLabel}
        centerValue={centerValue}
        colors={colors}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
      />
    );
  }

  return null;
}
