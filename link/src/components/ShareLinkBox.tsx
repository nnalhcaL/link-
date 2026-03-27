'use client';

import {useEffect, useState} from 'react';
import {Link2} from 'lucide-react';

interface ShareLinkBoxProps {
  eventId: string;
}

export default function ShareLinkBox({eventId}: ShareLinkBoxProps) {
  const [fullUrl, setFullUrl] = useState(`/event/${eventId}`);

  useEffect(() => {
    setFullUrl(`${window.location.origin}/event/${eventId}`);
  }, [eventId]);

  return (
    <div className="panel-border rounded-[26px] bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Link2 className="h-4 w-4 text-primary" />
        Share this link
      </div>
      <div
        className="overflow-hidden text-ellipsis whitespace-nowrap rounded-2xl bg-surface-soft px-4 py-3 text-sm text-ink-soft"
        title={fullUrl}
      >
        {fullUrl}
      </div>
      <p className="mt-3 text-sm text-primary">Ready to share</p>
    </div>
  );
}
