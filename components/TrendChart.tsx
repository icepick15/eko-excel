'use client';

import { SCORE_GREEN, SCORE_YELLOW, scoreColor } from '@/lib/calculations';
import type { TrendPoint } from '@/lib/calculations';

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  emptyText?: string;
}

export default function TrendChart({
  data,
  height = 72,
  showLabels = true,
  showValues = false,
  emptyText = 'No data yet',
}: TrendChartProps) {
  const hasData = data.some((p) => p.score > 0);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-xl text-xs"
        style={{ height, background: '#F9FAFB', color: '#9CA3AF', border: '1.5px dashed #E5E7EB' }}
      >
        {emptyText}
      </div>
    );
  }

  const max = Math.max(...data.map((p) => p.score), 1);
  const barW = 100 / data.length;

  // Trend direction from first non-zero to last non-zero
  const nonZero = data.filter((p) => p.score > 0);
  const first = nonZero[0]?.score ?? 0;
  const last  = nonZero[nonZero.length - 1]?.score ?? 0;
  const trendDir = last - first > 3 ? '↑' : last - first < -3 ? '↓' : '→';
  const trendCol = trendDir === '↑' ? '#008751' : trendDir === '↓' ? '#E30613' : '#6B7280';

  return (
    <div>
      {/* Bar chart */}
      <div className="flex items-end gap-0.5" style={{ height }}>
        {data.map((pt) => {
          const barH = pt.score > 0 ? Math.max(4, (pt.score / max) * height) : 3;
          const color = pt.score > 0 ? scoreColor(pt.score) : '#E5E7EB';
          return (
            <div
              key={pt.weekStart}
              className="flex-1 rounded-t-sm transition-all"
              style={{ height: barH, background: color, minHeight: 3 }}
              title={`${pt.label}: ${pt.score > 0 ? `${pt.score}%` : 'no data'}`}
            />
          );
        })}
      </div>

      {/* X-axis labels */}
      {showLabels && (
        <div className="flex mt-1" style={{ gap: '2px' }}>
          {data.map((pt, i) => (
            <div
              key={pt.weekStart}
              className="flex-1 text-center overflow-hidden"
              style={{ fontSize: 9, color: '#9CA3AF', whiteSpace: 'nowrap' }}
            >
              {i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2) ? pt.label : ''}
            </div>
          ))}
        </div>
      )}

      {/* Trend indicator + threshold lines legend */}
      <div className="flex items-center justify-between mt-1.5 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#008751' }} />
            <span style={{ color: '#6B7280', fontSize: 10 }}>≥{SCORE_GREEN}%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FFCC00' }} />
            <span style={{ color: '#6B7280', fontSize: 10 }}>{SCORE_YELLOW}–{SCORE_GREEN - 1}%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#E30613' }} />
            <span style={{ color: '#6B7280', fontSize: 10 }}>&lt;{SCORE_YELLOW}%</span>
          </div>
        </div>
        <span className="font-black text-sm" style={{ color: trendCol }}>{trendDir}</span>
      </div>
    </div>
  );
}
