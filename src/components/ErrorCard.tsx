import { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, Copy } from 'lucide-react';
import type { FriendlyError } from '@/shared/validation';
import { shortRequestId } from '@/shared/validation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Reusable error card for the Structured API Validation Layer.
 *
 * Displays:
 *  - Error title
 *  - Friendly description
 *  - Request ID (copyable)
 *  - Retry button
 *  - Expandable technical details
 *
 * Never shows raw exceptions to the user.
 */
export function ErrorCard({
  error,
  onRetry,
  className,
  compact = false,
}: {
  error: FriendlyError;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = error.details != null;

  const copyRequestId = () => {
    if (error.requestId) {
      navigator.clipboard.writeText(error.requestId);
      toast.success('Request ID copied');
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-red-200 bg-red-50/60 p-4',
        compact && 'p-3',
        className,
      )}
      role="alert"
      data-testid="error-card"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-100">
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-red-700">{error.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-red-600/90">{error.message}</p>

          {error.requestId && (
            <button
              onClick={copyRequestId}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50 transition-colors"
              title="Copy request ID"
            >
              <Copy className="h-3 w-3" />
              Request ID: {shortRequestId(error.requestId)}
            </button>
          )}
        </div>

        {onRetry && error.retryable && (
          <button
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>

      {hasDetails && (
        <div className="mt-3 border-t border-red-100 pt-2">
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600/80 hover:text-red-700"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDetails && 'rotate-180')} />
            Technical details
          </button>
          {showDetails && (
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-red-50 p-3 text-[10px] leading-relaxed text-red-700/80">
              {typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
