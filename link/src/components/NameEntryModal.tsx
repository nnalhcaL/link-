'use client';

import {type FormEvent, useEffect, useState} from 'react';
import {UserRound} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';

interface NameEntryModalProps {
  open: boolean;
  initialName: string;
  eventTitle: string;
  onSave: (name: string) => void;
}

export default function NameEntryModal({open, initialName, eventTitle, onSave}: NameEntryModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      setError('Your name helps Link! match you to your response.');
      return;
    }

    setError('');
    onSave(trimmed);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{opacity: 1}}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 py-6"
          exit={{opacity: 0}}
          initial={{opacity: 0}}
        >
          <motion.div
            animate={{opacity: 1, y: 0, scale: 1}}
            className="panel-border w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_40px_90px_rgba(20,24,40,0.2)]"
            exit={{opacity: 0, y: 14, scale: 0.98}}
            initial={{opacity: 0, y: 18, scale: 0.96}}
            transition={{duration: 0.22}}
          >
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-headline text-2xl font-bold tracking-tight text-ink">Enter your name</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  This is required before you can choose availability for{' '}
                  <span className="font-semibold text-ink">{eventTitle}</span>.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <span>Your name</span>
                  <span className="rounded-md bg-danger/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-danger">
                    Required
                  </span>
                </span>
                <input
                  autoFocus
                  className="w-full rounded-2xl border border-transparent bg-surface-soft px-4 py-3.5 text-sm text-ink outline-none transition-all duration-150 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex Rivera"
                  value={name}
                />
              </label>
              {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
              <button
                className="mt-5 w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#5c439d]"
                type="submit"
              >
                Continue to availability
              </button>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
