'use client';

import { useTransition } from 'react';
import { Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccessibleStore } from '@/lib/store-access';
import { selectActingStore } from './store-tab-action';

/**
 * Which store the manager is recording against.
 *
 * Only rendered for an account covering more than one shop. Everything filed
 * while a tab is active belongs to that store — so the strip states that plainly
 * rather than relying on the reader to infer it from a highlighted tab.
 */
export function StoreTabs({ stores, activeStoreId }: { stores: AccessibleStore[]; activeStoreId: number }) {
  const [pending, startTransition] = useTransition();
  if (stores.length < 2) return null;

  const active = stores.find((store) => store.id === activeStoreId) ?? stores[0];

  return (
    <div className="border-b bg-card px-4 pt-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Store">
        {stores.map((store) => {
          const selected = store.id === active.id;
          return (
            <button
              key={store.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={pending}
              onClick={() => startTransition(() => void selectActingStore(store.id))}
              className={cn(
                'rounded-t-md border border-b-0 px-4 py-2 text-sm transition-colors disabled:opacity-60',
                selected
                  ? 'border-border bg-background font-semibold text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {store.name}
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
        <Store className="size-3.5" />
        Recording for <span className="font-medium text-foreground">{active.name}</span>. Everything you file — daily
        report, weekly review, customer capture, stock transfer — belongs to this store until you switch.
      </p>
    </div>
  );
}
