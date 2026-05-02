"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorCard({ message = "Falha ao carregar", onRetry }: Props) {
  return (
    <div className="bg-bg-2 border border-accent-red/40 rounded-card p-5 flex items-center gap-3">
      <AlertTriangle className="w-5 h-5 text-accent-red flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-brand-bright hover:underline mt-1"
          >
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}
