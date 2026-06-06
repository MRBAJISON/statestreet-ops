'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

const fmtGHS = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
    ? `GHS ${(n / 1_000).toFixed(0)}K`
    : `GHS ${Math.round(n).toLocaleString()}`;
const dash = (n: number, f: (x: number) => string) => (n ? f(n) : '—');
const numOrDash = (n: number) => (n ? n.toLocaleString() : '—');

interface MarketingLive {
  leadChannelMix: { name: string; value: number }[];
  totalLeads: number;
  converted: number;
  totalReach: number;
  campaignRevenue: number;
  spend: number;
  roas: number;
  funnel: { reach: number; engagement: number; leads: number; storeVisits: number; revenueInfluenced: number };
  social: { followers: number; reach: number; impressions: number; engagement: number; clicks: number };
}

export default function MarketingPage() {
  const { data: m } = useMetrics<MarketingLive>('marketing');
  const leadChannelMix = m?.leadChannelMix ?? [];
  const funnel = m?.funnel ?? { reach: 0, engagement: 0, leads: 0, storeVisits: 0, revenueInfluenced: 0 };
  const social = m?.social ?? { followers: 0, reach: 0, impressions: 0, engagement: 0, clicks: 0 };
  const hasFunnel = !!(funnel.reach || funnel.engagement || funnel.leads || funnel.storeVisits);
  const hasSocial = !!(social.followers || social.reach || social.impressions || social.engagement || social.clicks);

  const funnelSteps = [
    { label: 'Reach', value: numOrDash(funnel.reach) },
    { label: 'Engagement', value: numOrDash(funnel.engagement) },
    { label: 'Leads', value: numOrDash(funnel.leads) },
    { label: 'Store Visits', value: numOrDash(funnel.storeVisits) },
    { label: 'Revenue Influenced', value: dash(funnel.revenueInfluenced, fmtGHS) },
  ];
  const socialStats = [
    { label: 'Followers', value: numOrDash(social.followers) },
    { label: 'Reach', value: numOrDash(social.reach) },
    { label: 'Impressions', value: numOrDash(social.impressions) },
    { label: 'Engagement', value: numOrDash(social.engagement) },
    { label: 'Clicks', value: numOrDash(social.clicks) },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="MARKETING COMMAND CENTER"
        subtitle="DEMAND GENERATION. BRAND BUILDING. CUSTOMER ACQUISITION."
        mission="Marketing Mission"
        missionDetail="Generate qualified demand and grow brand equity efficiently."
      />

      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Total Leads" value={numOrDash(m?.totalLeads ?? 0)} status="green" small />
          <KPICard label="Converted" value={numOrDash(m?.converted ?? 0)} small />
          <KPICard label="Campaign Revenue" value={dash(m?.campaignRevenue ?? 0, fmtGHS)} small />
          <KPICard label="Marketing Spend" value={dash(m?.spend ?? 0, fmtGHS)} small />
          <KPICard label="ROAS" value={(m?.roas ?? 0) ? `${m?.roas}x` : '—'} status={(m?.roas ?? 0) >= 1 ? 'green' : 'yellow'} small />
          <KPICard label="Total Reach" value={numOrDash(m?.totalReach ?? 0)} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Lead Generation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Lead Channel Mix</div>
              {leadChannelMix.length ? (
                <SimpleBarChart data={leadChannelMix} height={220} color="#c8a951" />
              ) : (
                <EmptyState message="No leads recorded yet" hint="Submit Lead Entry in the Marketing form." height={220} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Campaign Funnel</div>
              {hasFunnel ? (
                <div className="space-y-2">
                  {funnelSteps.map((s) => (
                    <div key={s.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-400">{s.label}</span>
                      <span className="text-sm font-bold text-[#c8a951]">{s.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No campaigns recorded yet" hint="Submit Campaign Performance in the Marketing form." height={220} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Social Media">
          {hasSocial ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {socialStats.map((s) => (
                <div key={s.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                  <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">{s.label}</div>
                  <div className="text-lg font-bold mt-1">{s.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No social metrics yet" hint="Submit Social Media Metrics in the Marketing form." height={120} />
          )}
        </Section>

        <Section number={3} title="Recent Entries">
          <RecentEntries department="marketing" />
        </Section>
      </div>
    </div>
  );
}
