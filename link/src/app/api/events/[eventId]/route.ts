import {NextResponse} from 'next/server';

import {prisma} from '@/lib/prisma';
import {serializeEventRecord} from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    eventId: string;
  };
}

export async function GET(_: Request, {params}: RouteContext) {
  const event = await prisma.event.findUnique({
    where: {id: params.eventId},
    include: {
      responses: true,
    },
  });

  if (!event) {
    return NextResponse.json({error: 'This link does not exist.'}, {status: 404});
  }

  return NextResponse.json(serializeEventRecord(event));
}

