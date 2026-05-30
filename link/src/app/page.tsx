import {Fragment} from 'react';
import {CalendarRange, CloudSun, Lock, RefreshCw, Sparkles} from 'lucide-react';

import CreateEventForm from '@/components/CreateEventForm';
import Header from '@/components/Header';

const sampleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const sampleTimes = ['09:00', '10:00', '11:00', '12:00'];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="pb-16 pt-24 sm:pt-28">
        <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              Find a time that works for everyone
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft sm:text-lg">
              Create one link, share it with your group, and see the strongest overlap as responses come in.
            </p>
          </div>

          <CreateEventForm />
        </section>

        <section className="mx-auto mt-16 grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-12">
          <div className="panel-border bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Next Week&apos;s Sync</p>
                <p className="mt-1 text-sm text-ink-soft">Paint availability and let the overlap emerge.</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <CalendarRange className="h-5 w-5" />
              </div>
            </div>

            <div className="grid grid-cols-[62px_repeat(5,minmax(0,1fr))] gap-2 sm:grid-cols-[70px_repeat(5,minmax(0,1fr))] sm:gap-3">
              <div className="text-xs font-semibold text-ink-soft">Time</div>
              {sampleDays.map((day) => (
                <div className="text-center text-xs font-semibold text-ink-soft" key={day}>
                  {day}
                </div>
              ))}

              {sampleTimes.map((time, rowIndex) => (
                <Fragment key={time}>
                  <div className="flex items-center text-xs font-medium text-ink-soft">
                    {time}
                  </div>
                  {sampleDays.map((day, columnIndex) => {
                    const isSelected = rowIndex === 0 && columnIndex === 1;
                    const isSuggested = rowIndex === 2 && columnIndex === 2;

                    return (
                      <div
                        className={`h-11 rounded-xl border transition-all sm:h-12 ${
                          isSelected
                            ? 'border-primary/30 bg-primary/10'
                            : isSuggested
                              ? 'border-tertiary/30 bg-tertiary-soft'
                              : 'border-white bg-surface-soft'
                        }`}
                        key={`${day}-${time}`}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-tertiary-soft/80 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-white p-2 text-tertiary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-tertiary">Optimal time found</p>
                  <p className="mt-1 text-sm text-tertiary/80">Tuesday at 9:00 AM looks like the easiest alignment.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/80 sm:col-span-2">
              <div className="flex items-center gap-3 text-primary">
                <CloudSun className="h-5 w-5" />
                <p className="font-headline text-xl font-bold tracking-tight">Weather-aware planning</p>
              </div>
              <p className="mt-3 leading-7 text-ink-soft">
                Link! keeps room for richer scheduling help, including weather context for location-based events,
                without making the core flow feel heavy.
              </p>
            </div>

            <div className="rounded-2xl bg-secondary-soft/50 p-6 shadow-soft ring-1 ring-line/80">
              <RefreshCw className="h-6 w-6 text-secondary" />
              <p className="mt-4 font-headline text-xl font-bold tracking-tight text-ink">Instant sync</p>
              <p className="mt-2 leading-7 text-ink-soft">
                Share one link and watch availability accumulate as your group responds.
              </p>
            </div>

            <div className="rounded-2xl bg-tertiary-soft/50 p-6 shadow-soft ring-1 ring-line/80">
              <Lock className="h-6 w-6 text-tertiary" />
              <p className="mt-4 font-headline text-xl font-bold tracking-tight text-ink">No sign-up required</p>
              <p className="mt-2 leading-7 text-ink-soft">
                Everyone participates with just a name and a shared link.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-soft ring-1 ring-line/80 sm:col-span-2">
              <p className="font-headline text-xl font-bold tracking-tight text-ink">Built for real-world coordination</p>
              <p className="mt-3 leading-7 text-ink-soft">
                Use it for team offsites, investor updates, volunteer rosters, family visits, or any plan where “just reply
                all with what works” has already failed.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/70 bg-white/70 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-sm text-ink-soft lg:flex-row lg:px-12">
          <p>No sign-up required</p>
          <p>Link! MVP for fast group scheduling</p>
        </div>
      </footer>
    </div>
  );
}
