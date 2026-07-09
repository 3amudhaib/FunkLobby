
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-surface-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-surface-400 text-center max-w-sm mb-4">{description}</p>
      {action && (
        <button className="btn-primary text-sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
