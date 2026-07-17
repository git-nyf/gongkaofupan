import {
  CircleCheck,
  CircleX,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';

type StatusNoticeState = 'loading' | 'empty' | 'error' | 'success';

interface StatusNoticeProps {
  state: StatusNoticeState;
  message: string;
}

const stateIcons: Record<StatusNoticeState, LucideIcon> = {
  loading: LoaderCircle,
  empty: Inbox,
  error: CircleX,
  success: CircleCheck,
};

export function StatusNotice({ state, message }: StatusNoticeProps) {
  const Icon = stateIcons[state];

  return (
    <div
      className="status-notice"
      data-state={state}
      role={state === 'error' ? 'alert' : 'status'}
    >
      <Icon aria-hidden="true" className="status-notice__icon" size={20} />
      <span>{message}</span>
    </div>
  );
}
