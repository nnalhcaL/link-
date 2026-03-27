import Link from 'next/link';

interface HeaderProps {
  actionHref?: string;
  actionLabel?: string;
}

export default function Header({actionHref = '#create-link', actionLabel = 'Create Link'}: HeaderProps) {
  return (
    <header className="glass-nav fixed inset-x-0 top-0 z-50 border-b border-white/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-8">
          <Link className="font-headline text-2xl font-extrabold tracking-tight text-ink" href="/">
            Link!
          </Link>
          <p className="hidden text-sm text-ink-soft md:block">Find a time that works for everyone</p>
        </div>
        {actionHref ? (
          <Link
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d]"
            href={actionHref}
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

