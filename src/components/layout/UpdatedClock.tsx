'use client';

import { useEffect, useState } from 'react';

function fmt() {
  const n = new Date();
  return {
    d: n.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    t: n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

// Live date + "Updated" time. Refreshes every minute so the dashboard shows the
// real current time instead of a fixed value.
export default function UpdatedClock({ date }: { date?: string }) {
  const [now, setNow] = useState(fmt);

  useEffect(() => {
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right" suppressHydrationWarning>
      <div className="text-xs text-gray-400">{date || now.d}</div>
      <div className="text-[0.6rem] text-gray-600">Updated: {now.t}</div>
    </div>
  );
}
