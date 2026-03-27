import Link from 'next/link';

interface HeaderProps {
  actionHref?: string;
  actionLabel?: string;
}

export default function Header({actionHref = '#create-link', actionLabel = 'Create Link'}: HeaderProps) {
  return (
    <header className="glass-nav fixed inset-x-0 top-0 z-50 border-b border-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-12">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link className="font-headline text-xl font-extrabold tracking-tight text-ink sm:text-2xl" href="/">
            Link!
          </Link>
          <p className="hidden text-sm text-ink-soft md:block">Find a time that works for everyone</p>
        </div>
        {actionHref ? (
          <Link
            className="rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#5c439d] sm:rounded-full sm:px-5 sm:py-2.5 sm:text-sm"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
