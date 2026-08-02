import { useState } from 'react';

export function useExpandable<T>(items: readonly T[], initialCount = 7) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  return {
    visible,
    hiddenCount: items.length - visible.length,
    expanded,
    canExpand: items.length > initialCount,
    toggle: () => setExpanded((current) => !current),
  };
}
