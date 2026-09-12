/** Receipt-based FIFO allocation. No database, clock, prices or manager opinions. */
export interface StockLot {
  quantity: number;
  receiptDate: string | null;
  assumed: boolean;
}
export interface StockEvent {
  key: string;
  storeId: number;
  productId: number;
  date: string;
  quantity: number;
  kind: string;
  receiptDate?: string | null;
  transferKey?: string | null;
  lots?: StockLot[];
  order?: number;
}
export interface StockPosition {
  lots: StockLot[];
  quantity: number;
  discrepancies: string[];
  inStockSince: string | null;
}
export const OPENING_RECEIPT_DATE = '2026-07-01';
export const INACTIVITY_DAYS = 30;
export const RISK_AGE_DAYS = 90;
/** Allocate today's known balance without posting movements or claiming historic on-hand.
 * Put the inferred opening quantity into FIFO before replaying documented changes,
 * so historical sales do not incorrectly consume newer verified receipt lots first.
 */
export function reconcileOpeningLots(
  levels: readonly { storeId: number; productId: number; quantity: number }[],
  events: readonly StockEvent[],
  asOf: string
): Map<string, StockLot[]> {
  const eligible = [
    ...new Map(
      events.filter((e) => e.date <= asOf).map((e) => [e.key, e])
    ).values(),
  ];
  const openings: StockEvent[] = levels.map((level) => {
    const related = eligible.filter(
      (e) => e.storeId === level.storeId && e.productId === level.productId
    );
    const quantity = Math.max(
      0,
      level.quantity - related.reduce((sum, e) => sum + e.quantity, 0)
    );
    return {
      ...level,
      quantity,
      key: `inferred-opening:${level.storeId}:${level.productId}`,
      kind: 'baseline',
      date: related.reduce(
        (date, e) => (e.date < date ? e.date : date),
        OPENING_RECEIPT_DATE
      ),
      order: -1,
      lots: [{ quantity, receiptDate: OPENING_RECEIPT_DATE, assumed: true }],
    };
  });
  const replay = replayStock([...openings, ...eligible], asOf);
  return new Map(
    levels.map((level) => {
      const key = `${level.storeId}:${level.productId}`;
      const lots = (replay.get(key)?.lots ?? []).map((l) => ({ ...l }));
      const total = lots.reduce((sum, l) => sum + l.quantity, 0);
      if (total > level.quantity) take(lots, total - level.quantity);
      if (total < level.quantity)
        lots.push({
          quantity: level.quantity - total,
          receiptDate: OPENING_RECEIPT_DATE,
          assumed: true,
        });
      return [
        key,
        lots
          .filter((l) => l.quantity > 0)
          .map((l) =>
            l.receiptDate
              ? l
              : { ...l, receiptDate: OPENING_RECEIPT_DATE, assumed: true }
          ),
      ];
    })
  );
}
export const elapsedDays = (from: string, to: string) =>
  Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000
  );

function take(lots: StockLot[], quantity: number): StockLot[] {
  const taken: StockLot[] = [];
  lots.sort((a, b) =>
    (a.receiptDate ?? '0000').localeCompare(b.receiptDate ?? '0000')
  );
  for (const lot of lots) {
    const units = Math.min(lot.quantity, quantity);
    if (units > 0) taken.push({ ...lot, quantity: units });
    lot.quantity -= units;
    quantity -= units;
    if (!quantity) break;
  }
  return taken;
}

export function replayStock(
  events: readonly StockEvent[],
  asOf: string
): Map<string, StockPosition> {
  const positions = new Map<string, StockPosition>();
  const transfers = new Map<string, StockLot[]>();
  const seen = new Set<string>();
  const sorted = [...events]
    .filter((e) => e.date <= asOf)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.key.localeCompare(b.key)
    );
  for (const event of sorted) {
    if (seen.has(event.key)) continue;
    seen.add(event.key);
    const key = `${event.storeId}:${event.productId}`;
    const position = positions.get(key) ?? {
      lots: [],
      quantity: 0,
      discrepancies: [],
      inStockSince: null,
    };
    const previousQuantity = position.quantity;
    positions.set(key, position);
    if (event.kind === 'baseline') {
      position.lots = (
        event.lots ?? [
          {
            quantity: event.quantity,
            receiptDate: event.receiptDate ?? null,
            assumed: true,
          },
        ]
      ).map((l) => ({ ...l }));
    } else if (event.quantity < 0) {
      const taken = take(position.lots, -event.quantity);
      const removed = taken.reduce((sum, lot) => sum + lot.quantity, 0);
      if (removed !== -event.quantity)
        position.discrepancies.push(
          `Insufficient recorded stock: ${event.key}`
        );
      if (event.transferKey)
        transfers.set(`${event.transferKey}:${event.productId}`, taken);
    } else if (event.quantity > 0) {
      const transfer = event.transferKey
        ? transfers.get(`${event.transferKey}:${event.productId}`)
        : undefined;
      if (transfer) {
        const copied = take(transfer, event.quantity);
        position.lots.push(...copied);
        const shortfall =
          event.quantity - copied.reduce((sum, lot) => sum + lot.quantity, 0);
        if (shortfall)
          position.lots.push({
            quantity: shortfall,
            receiptDate: null,
            assumed: false,
          });
      } else {
        position.lots.push({
          quantity: event.quantity,
          receiptDate: event.receiptDate ?? null,
          assumed: false,
        });
      }
    }
    position.lots = position.lots.filter((l) => l.quantity > 0);
    position.quantity = position.lots.reduce(
      (sum, lot) => sum + lot.quantity,
      0
    );
    if (!position.quantity) position.inStockSince = null;
    else if (!previousQuantity) position.inStockSince = event.date;
  }
  return positions;
}

export function classifyStock(input: {
  lots: StockLot[];
  asOf: string;
  lastSale: string | null;
  observedFrom: string | null;
  historyComplete: boolean;
  sellingPrice: string | null;
}) {
  const bands = {
    days0to30: 0,
    days31to60: 0,
    days61to90: 0,
    over90: 0,
    unknown: 0,
  };
  let oldestAge: number | null = null;
  for (const lot of input.lots) {
    const age = lot.receiptDate
      ? elapsedDays(lot.receiptDate, input.asOf)
      : null;
    if (age === null || age < 0) bands.unknown += lot.quantity;
    else {
      oldestAge = Math.max(oldestAge ?? 0, age);
      if (age <= 30) bands.days0to30 += lot.quantity;
      else if (age <= 60) bands.days31to60 += lot.quantity;
      else if (age <= 90) bands.days61to90 += lot.quantity;
      else bands.over90 += lot.quantity;
    }
  }
  const quantity = input.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const observationDays = input.observedFrom
    ? elapsedDays(input.observedFrom, input.asOf)
    : 0;
  const daysSinceSale = input.lastSale
    ? elapsedDays(input.lastSale, input.asOf)
    : null;
  const nonMoving =
    input.historyComplete &&
    quantity > 0 &&
    observationDays >= INACTIVITY_DAYS &&
    (daysSinceSale === null || daysSinceSale >= INACTIVITY_DAYS);
  const riskQuantity = nonMoving ? quantity : bands.over90;
  // Money is represented as exact decimal strings at the reporting boundary.
  const [whole, fraction = ''] = (input.sellingPrice ?? '0').split('.');
  const cents =
    input.sellingPrice === null
      ? null
      : BigInt(whole) * BigInt(100) +
        BigInt(fraction.padEnd(2, '0').slice(0, 2));
  const total = cents === null ? null : cents * BigInt(riskQuantity);
  const riskValue =
    total === null
      ? null
      : `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, '0')}`;
  return {
    quantity,
    bands,
    oldestAge,
    observationDays,
    daysSinceSale,
    nonMoving,
    riskQuantity,
    riskValue,
  };
}
