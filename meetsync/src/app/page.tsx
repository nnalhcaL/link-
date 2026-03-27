import {CalendarRange, CloudSun, Lock, RefreshCw, Sparkles} from 'lucide-react';

import CreateEventForm from '@/components/CreateEventForm';
import Header from '@/components/Header';

const sampleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const sampleTimes = ['09:00', '10:00', '11:00', '12:00'];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="pb-20 pt-28">
        <section className="mx-auto grid max-w-7xl gap-16 px-6 lg:grid-cols-[1.05fr,0.95fr] lg:px-12">
          <div className="space-y-10">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full bg-secondary-soft px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
                AI-Powered Scheduling
              </span>
              <div className="space-y-4">
                <h1 className="max-w-2xl font-headline text-5xl font-extrabold tracking-tight text-ink sm:text-6xl lg:text-7xl">
                  Find a time that <span className="italic text-primary">works</span> for everyone
                </h1>
                <p className="max-w-xl text-lg leading-8 text-ink-soft">
                  Create a poll, share the link, and see when everyone is free without the thread spiral, timezone math,
                  or spreadsheet gymnastics.
                </p>
              </div>
            </div>

            <CreateEventForm />

            <div className="flex items-center gap-5">
              <div className="flex -space-x-3">
                {['AR', 'SK', 'LW'].map((initials, index) => (
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-background text-xs font-bold text-white ${
                      index === 0 ? 'bg-primary' : index === 1 ? 'bg-secondary' : 'bg-tertiary'
                    }`}
                    key={initials}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium text-ink-soft">
                Joined by <span className="font-semibold text-ink">busy teams, wedding parties, and friend groups</span>
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-8 top-6 h-64 rounded-full bg-primary/15 blur-3xl" />
            <div className="panel-border panel-shadow relative overflow-hidden rounded-[30px] bg-white p-6 sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Next Week&apos;s Sync</p>
                  <p className="mt-1 text-sm text-ink-soft">Paint your availability and let the overlap emerge.</p>
                </div>
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <CalendarRange className="h-5 w-5" />
                </div>
              </div>

              <div className="grid grid-cols-[70px_repeat(5,minmax(0,1fr))] gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft">Time</div>
                {sampleDays.map((day) => (
                  <div className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink-soft" key={day}>
                    {day}
                  </div>
                ))}

                {sampleTimes.map((time, rowIndex) => (
                  <>
                    <div className="flex items-center text-xs font-medium text-ink-soft" key={`${time}-label`}>
                      {time}
                    </div>
                    {sampleDays.map((day, columnIndex) => {
                      const isSelected = rowIndex === 0 && columnIndex === 1;
                      const isSuggested = rowIndex === 2 && columnIndex === 2;

                      return (
                        <div
                          className={`h-14 rounded-2xl border transition-all ${
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
                  </>
                ))}
              </div>

              <div className="mt-8 rounded-3xl bg-tertiary-soft/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-white p-2 text-tertiary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-tertiary">Optimal time found</p>
                    <p className="mt-1 text-sm text-tertiary/80">Tuesday at 9:00 AM looks like the easiest alignment.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-24 grid max-w-7xl gap-6 px-6 lg:grid-cols-3 lg:px-12">
          <div className="rounded-[28px] bg-white p-8 shadow-soft ring-1 ring-line/80 lg:col-span-2">
            <div className="flex items-center gap-3 text-primary">
              <CloudSun className="h-6 w-6" />
              <p className="font-headline text-2xl font-bold tracking-tight">Weather-aware planning</p>
            </div>
            <p className="mt-4 max-w-2xl leading-7 text-ink-soft">
              Link! keeps room for richer scheduling help, including weather context for location-based events, without
              making the core flow feel heavy.
            </p>
          </div>

          <div className="rounded-[28px] bg-secondary-soft/50 p-8 shadow-soft ring-1 ring-line/80">
            <RefreshCw className="h-7 w-7 text-secondary" />
            <p className="mt-5 font-headline text-2xl font-bold tracking-tight text-ink">Instant sync</p>
            <p className="mt-3 leading-7 text-ink-soft">
              Share one link and watch availability accumulate in real time as your group responds.
            </p>
          </div>

          <div className="rounded-[28px] bg-tertiary-soft/50 p-8 shadow-soft ring-1 ring-line/80">
            <Lock className="h-7 w-7 text-tertiary" />
            <p className="mt-5 font-headline text-2xl font-bold tracking-tight text-ink">No sign-up required</p>
            <p className="mt-3 leading-7 text-ink-soft">
              Everyone participates with just a name and a shared link. No accounts, no inbox choreography.
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-8 shadow-soft ring-1 ring-line/80 lg:col-span-2">
            <p className="font-headline text-2xl font-bold tracking-tight text-ink">Built for real-world coordination</p>
            <p className="mt-4 max-w-3xl leading-7 text-ink-soft">
              Use it for team offsites, investor updates, volunteer rosters, family visits, or any plan where “just reply
              all with what works” has already failed.
            </p>
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
