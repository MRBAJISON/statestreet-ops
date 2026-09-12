export interface SummaryStore {
  name: string;
  netRevenue: number;
  target: number;
  units: number;
  transactions: number;
  footfall: number;
}
export interface SummaryEvidence {
  id: string;
  label: string;
  text: string;
}
export function generateMonthlySummary(input: {
  currency?: string;
  label: string;
  stores: SummaryStore[];
  evidence: SummaryEvidence[];
  bestProduct?: string;
  lowProduct?: string;
  riskValue: string | null;
  nonMovingCount: number;
  weeks?: { label: string; sales: number }[];
  categories?: { name: string; sales: number }[];
  customerRequests?: number;
  actions?: number;
}) {
  const money = (v: number) =>
    `${input.currency ?? 'GHS'} ${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const sales = input.stores.reduce((sum, s) => sum + s.netRevenue, 0),
    target = input.stores.reduce((sum, s) => sum + s.target, 0);
  const facts = [
    `${input.label}: recorded net sales were ${money(sales)} against ${money(target)} target${target > 0 ? ` (${((sales / target) * 100).toFixed(1)}% achievement)` : ' (no target set)'}.`,
    ...input.stores.map(
      (s) =>
        `${s.name}: ${money(s.netRevenue)} sales; ${s.target > 0 ? ((100 * s.netRevenue) / s.target).toFixed(1) + '% of target' : 'no target set'}; ${s.units} units and ${s.transactions} transactions.`
    ),
    `${input.nonMovingCount} product/store positions meet the 30-day inactivity rule. Stock exposure is ${input.riskValue === null ? 'not fully valued because prices/history are incomplete' : money(Number(input.riskValue))}; this is not an actual loss.`,
  ];
  if (input.bestProduct)
    facts.push(
      `The highest-selling recorded product by units was ${input.bestProduct}.`
    );
  if (input.lowProduct)
    facts.push(
      `The lowest positive recorded seller was ${input.lowProduct}. Zero-selling products are listed separately; this rank alone does not establish stock risk.`
    );
  for (const [index, week] of (input.weeks ?? []).entries()) {
    const previous = input.weeks?.[index - 1];
    facts.push(
      `${week.label}: ${money(week.sales)} within the reporting month${previous ? `; ${money(week.sales - previous.sales)} change from the preceding displayed week` : ''}. Boundary weeks may contain fewer trading days.`
    );
  }
  const leaders = [...(input.categories ?? [])]
    .filter((c) => c.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 3);
  if (leaders.length)
    facts.push(
      `Leading recorded categories: ${leaders.map((c) => `${c.name} (${money(c.sales)})`).join('; ')}. Customer-ledger adjustments are reconciled separately.`
    );
  if (input.customerRequests !== undefined)
    facts.push(
      `${input.customerRequests} customer request(s) and ${input.actions ?? 0} action(s) are recorded in this month's source records and overlapping submitted reviews.`
    );
  return {
    facts,
    evidence: input.evidence,
    explanation: input.evidence.length
      ? input.evidence
          .slice(0, 12)
          .map(
            (e) =>
              `${e.label}: ${e.text.slice(0, 500)}${e.text.length > 500 ? '… [Full review in appendix]' : ''}`
          )
          .join('\n\n')
      : 'No supporting weekly explanation has been recorded. Causes cannot be established from sales figures alone.',
  };
}
