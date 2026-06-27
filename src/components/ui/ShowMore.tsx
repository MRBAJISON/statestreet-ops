'use client';

import { useState, type ReactNode } from 'react';

const btn = 'text-xs text-[#c8a951] hover:underline font-medium';

// Table version: shows the first `limit` rows, then a "Show N more" toggle row.
export function ShowMoreRows<T>({ items, limit = 7, colSpan, children }: {
  items: T[]; limit?: number; colSpan: number; children: (item: T, i: number) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(children)}
      {items.length > limit && (
        <tr>
          <td colSpan={colSpan} className="py-2 text-center">
            <button type="button" onClick={() => setExpanded((e) => !e)} className={btn}>
              {expanded ? 'Show less' : `Show ${items.length - limit} more`}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}

// Grid/list version: renders the wrapper, the first `limit` items, then a toggle below.
export function ShowMoreGrid<T>({ items, limit = 7, wrapClass, children }: {
  items: T[]; limit?: number; wrapClass: string; children: (item: T, i: number) => ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <>
      <div className={wrapClass}>{shown.map(children)}</div>
      {items.length > limit && (
        <div className="text-center mt-2">
          <button type="button" onClick={() => setExpanded((e) => !e)} className={btn}>
            {expanded ? 'Show less' : `Show ${items.length - limit} more`}
          </button>
        </div>
      )}
    </>
  );
}
