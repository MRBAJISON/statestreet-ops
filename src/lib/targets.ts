// Business targets / goals. Set these to your real numbers; 0 means "no target"
// (no target line or RAG status is shown until you set one). These are config the
// business owns — not operational data — so they live here, editable in one place.
export const TARGETS = {
  finance: { revenueMtd: 0, grossMargin: 0, netMargin: 0 },
  commercial: { groupSales: 0, grossMargin: 0, convRate: 0, sellThrough: 0 },
  operations: { opsScore: 0, vmScore: 0, readiness: 0, sopCompliance: 0, cxScore: 0 },
  inventory: { accuracy: 0, deadPct: 0 },
  brand: { healthIndex: 0, nps: 0 },
  marketing: { roas: 0 },
} as const;

export type RAG = 'green' | 'yellow' | 'red' | undefined;

// Returns a RAG status vs a target. higherIsBetter=false flips it (e.g. dead-stock %).
export function ragStatus(value: number, target: number, higherIsBetter = true): RAG {
  if (!target) return undefined;
  const ratio = value / target;
  if (higherIsBetter) return ratio >= 1 ? 'green' : ratio >= 0.9 ? 'yellow' : 'red';
  return value <= target ? 'green' : value <= target * 1.1 ? 'yellow' : 'red';
}
