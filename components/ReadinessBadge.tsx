import { ColorStatus } from '@/lib/types';

interface Props {
  score: number;
  status: ColorStatus;
  subject?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_STYLES: Record<ColorStatus, { bg: string; text: string; bar: string; label: string }> = {
  [ColorStatus.GREEN]: { bg: '#D1FAE5', text: '#065F46', bar: '#10B981', label: 'On Track' },
  [ColorStatus.YELLOW]: { bg: '#FEF9C3', text: '#854D0E', bar: '#EAB308', label: 'Needs Attention' },
  [ColorStatus.RED]: { bg: '#FEE2E2', text: '#991B1B', bar: '#EF4444', label: 'At Risk' },
};

export default function ReadinessBadge({ score, status, subject, size = 'md' }: Props) {
  const style = STATUS_STYLES[status];
  const isLg = size === 'lg';
  const isSm = size === 'sm';

  return (
    <div
      className={`rounded-xl border ${isLg ? 'p-4' : isSm ? 'p-2' : 'p-3'}`}
      style={{ background: style.bg, borderColor: style.bar + '60' }}
    >
      {subject && (
        <div className={`font-semibold ${isSm ? 'text-xs' : 'text-sm'} mb-1`} style={{ color: style.text }}>
          {subject}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div
            className={`font-bold leading-none ${isLg ? 'text-3xl' : isSm ? 'text-lg' : 'text-2xl'}`}
            style={{ color: style.text }}
          >
            {score.toFixed(0)}%
          </div>
          {!isSm && (
            <div className="text-xs mt-0.5 font-medium" style={{ color: style.text, opacity: 0.8 }}>
              {style.label}
            </div>
          )}
        </div>
        {isLg && (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
            style={{ background: style.bar, color: 'white' }}
          >
            {status === ColorStatus.GREEN ? '✓' : status === ColorStatus.YELLOW ? '!' : '✗'}
          </div>
        )}
      </div>
      {!isSm && (
        <div className="progress-bar mt-2">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(100, score)}%`, background: style.bar }}
          />
        </div>
      )}
    </div>
  );
}
