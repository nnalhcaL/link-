import {notFound} from 'next/navigation';

import EventPageClient from '@/components/EventPageClient';
import Header from '@/components/Header';
import {prisma} from '@/lib/prisma';
import {serializeEventRecord} from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface EventPageProps {
  params: {
    eventId: string;
  };
}

export default async function EventPage({params}: EventPageProps) {
  const event = await prisma.event.findUnique({
    where: {id: params.eventId},
    include: {
      responses: true,
    },
  });

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Header actionHref="" />

      <main className="pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-12">
          <EventPageClient initialEvent={serializeEventRecord(event)} />
        </div>
      </main>
    </div>
  );
}
