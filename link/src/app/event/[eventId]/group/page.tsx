import {redirect} from 'next/navigation';

export const dynamic = 'force-dynamic';

interface EventGroupPageProps {
  params: {
    eventId: string;
  };
}

export default function EventGroupPage({params}: EventGroupPageProps) {
  redirect(`/event/${params.eventId}#group`);
}
