import {notFound} from 'next/navigation';

import GroupViewClient from '@/components/GroupViewClient';
import Header from '@/components/Header';
import {prisma} from '@/lib/prisma';
import {serializeEventRecord} from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface EventGroupPageProps {
  params: {
    eventId: string;
  };
}

export default async function EventGroupPage({params}: EventGroupPageProps) {
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
      <Header actionHref={`/event/${params.eventId}#availability`} actionLabel="Edit Availability" />

      <main className="pb-20 pt-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-12">
          <GroupViewClient initialEvent={serializeEventRecord(event)} />
        </div>
      </main>
    </div>
  );
}
