'use client';

import {useEffect, useState} from 'react';
import {Check, Copy, Link2} from 'lucide-react';

interface ShareLinkBoxProps {
  eventId: string;
}

export default function ShareLinkBox({eventId}: ShareLinkBoxProps) {
  const [fullUrl, setFullUrl] = useState(`/event/${eventId}`);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    setFullUrl(`${window.location.origin}/event/${eventId}`);
  }, [eventId]);

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }

  return (
    <div className="panel-border rounded-[26px] bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Link2 className="h-4 w-4 text-primary" />
        Share this link
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-soft px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{fullUrl}</p>
        <button
          aria-label="Copy event link"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink transition-colors duration-150 hover:border-primary/30 hover:text-primary"
          onClick={handleCopy}
          type="button"
        >
          {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-3 text-sm text-primary">
        {copyState === 'copied' ? 'Link copied' : copyState === 'error' ? 'Copy failed. Try again.' : 'Ready to share'}
      </p>
    </div>
  );
}
