'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_ORG, mergeOrg, type OrgSettings } from '@/lib/org';

interface OrgCtx {
  org: OrgSettings;
  refresh: () => void;
}
const OrgContext = createContext<OrgCtx>({ org: DEFAULT_ORG, refresh: () => {} });

export function useOrg() {
  return useContext(OrgContext);
}

export default function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<OrgSettings>(DEFAULT_ORG);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/org', { cache: 'no-store' });
      if (res.ok) setOrg(mergeOrg(await res.json()));
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <OrgContext.Provider value={{ org, refresh }}>{children}</OrgContext.Provider>;
}
