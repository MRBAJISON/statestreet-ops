'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';

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
  socialByChannel: { platform: string; followers: number; reach: number; impressions: number; engagement: number; clicks: number }[];
  webVisits: number;
  campaignByBrand: { brand: string; revenue: number; spend: number; roas: number }[];
  campaigns: { name: string; platform: string; reach: number; engagement: number; leads: number; revenue: number; spend: number; roas: number; status: string }[];
  clienteling: { contacted: number; responses: number; appointments: number; estRevenue: number; responseRate: number };
  customerExperience: {
    count: number;
    avgNps: number;
    recommendRate: number;
    byType: { name: string; value: number }[];
    recent: { type: string; detail: string; frequency: string; store: string; source: string }[];
  };
  actions: { task: string; owner: string; priority: string; status: string; deadline: string }[];
}

export default function MarketingPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const [anchor, setAnchor] = useState('');
  const { data: m } = useMetrics<MarketingLive>('marketing', period, anchor);
  const leadChannelMix = m?.leadChannelMix ?? [];
  const funnel = m?.funnel ?? { reach: 0, engagement: 0, leads: 0, storeVisits: 0, revenueInfluenced: 0 };
  const socialByChannel = m?.socialByChannel ?? [];
  const campaignByBrand = m?.campaignByBrand ?? [];
  const webVisits = m?.webVisits ?? 0;
  const campaigns = m?.campaigns ?? [];
  const cl = m?.clienteling ?? { contacted: 0, responses: 0, appointments: 0, estRevenue: 0, responseRate: 0 };
  const cx = m?.customerExperience ?? { count: 0, avgNps: 0, recommendRate: 0, byType: [], recent: [] };
  const actions = m?.actions ?? [];
  const hasFunnel = !!(funnel.reach || funnel.engagement || funnel.leads || funnel.storeVisits);
  const hasClienteling = !!(cl.contacted || cl.responses || cl.appointments || cl.estRevenue);

  const funnelSteps = [
    { label: 'Reach', value: numOrDash(funnel.reach) },
    { label: 'Engagement', value: numOrDash(funnel.engagement) },
    { label: 'Leads', value: numOrDash(funnel.leads) },
    { label: 'Store Visits', value: numOrDash(funnel.storeVisits) },
    { label: 'Revenue Influenced', value: dash(funnel.revenueInfluenced, fmtGHS) },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="MARKETING COMMAND CENTER"
        subtitle="DEMAND GENERATION. BRAND BUILDING. CUSTOMER ACQUISITION."
        mission="Marketing Mission"
        missionDetail="Generate qualified demand and grow brand equity efficiently."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} date={anchor} onChange={setPeriod} onDateChange={setAnchor} />
      </div>
      <div className="px-6 py-3">
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
              <div className="text-xs text-gray-400 mb-2">Campaign Funnel (all campaigns)</div>
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

        <Section number={2} title="Campaign Performance" subtitle="per campaign">
          {campaigns.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Campaign</th>
                    <th className="text-left py-2 px-2 font-medium">Platform</th>
                    <th className="text-right py-2 px-2 font-medium">Reach</th>
                    <th className="text-right py-2 px-2 font-medium">Leads</th>
                    <th className="text-right py-2 px-2 font-medium">Revenue</th>
                    <th className="text-right py-2 px-2 font-medium">Spend</th>
                    <th className="text-right py-2 px-2 font-medium">ROAS</th>
                    <th className="text-left py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{c.name}</td>
                      <td className="py-2 px-2 capitalize">{c.platform || '—'}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(c.reach)}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(c.leads)}</td>
                      <td className="py-2 px-2 text-right">{c.revenue ? fmtGHS(c.revenue) : '—'}</td>
                      <td className="py-2 px-2 text-right">{c.spend ? fmtGHS(c.spend) : '—'}</td>
                      <td className="py-2 px-2 text-right text-[#c8a951]">{c.roas ? `${c.roas}x` : '—'}</td>
                      <td className="py-2 pl-2 capitalize">{c.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No campaigns yet" hint="Each campaign you submit appears here with its own performance." height={140} />
          )}
          {campaignByBrand.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-gray-400 mb-2">Campaign ROI by Brand</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {campaignByBrand.map((b) => (
                  <div key={b.brand} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                    <div className="text-[0.65rem] text-gray-500 truncate">{b.brand}</div>
                    <div className="text-base font-bold text-[#c8a951]">{b.roas ? `${b.roas}x` : '—'}</div>
                    <div className="text-[0.6rem] text-gray-600">{fmtGHS(b.revenue)} rev</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section number={3} title="Social Media by Channel">
          {socialByChannel.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Channel</th>
                    <th className="text-right py-2 px-2 font-medium">Followers</th>
                    <th className="text-right py-2 px-2 font-medium">Reach</th>
                    <th className="text-right py-2 px-2 font-medium">Impressions</th>
                    <th className="text-right py-2 px-2 font-medium">Engagement</th>
                    <th className="text-right py-2 pl-2 font-medium">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {socialByChannel.map((s) => (
                    <tr key={s.platform} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3 capitalize text-[#c8a951]">{s.platform}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(s.followers)}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(s.reach)}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(s.impressions)}</td>
                      <td className="py-2 px-2 text-right">{numOrDash(s.engagement)}</td>
                      <td className="py-2 pl-2 text-right">{numOrDash(s.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No social metrics yet" hint="Submit Social Media Metrics (per platform) in the Marketing form." height={120} />
          )}
          {webVisits > 0 && (
            <div className="mt-3 text-xs text-gray-400">
              Website visits from social: <span className="text-[#c8a951] font-bold">{webVisits.toLocaleString()}</span>
            </div>
          )}
        </Section>

        <Section number={4} title="Clienteling">
          {hasClienteling ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Contacted</div>
                <div className="text-lg font-bold">{numOrDash(cl.contacted)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Responses</div>
                <div className="text-lg font-bold">{numOrDash(cl.responses)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Response Rate</div>
                <div className="text-lg font-bold">{cl.responseRate ? `${cl.responseRate}%` : '—'}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Appointments</div>
                <div className="text-lg font-bold">{numOrDash(cl.appointments)}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-3">
                <div className="text-[0.65rem] text-[#c8a951] uppercase tracking-wider">Est. Revenue</div>
                <div className="text-lg font-bold text-[#c8a951]">{dash(cl.estRevenue, fmtGHS)}</div>
              </div>
            </div>
          ) : (
            <EmptyState message="No clienteling activity yet" hint="Submit Clienteling Activity in the Marketing form." height={120} />
          )}
        </Section>

        <Section number={5} title="Customer Experience">
          {cx.count ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard label="Responses" value={String(cx.count)} small />
                <KPICard label="Avg NPS" value={cx.avgNps ? String(cx.avgNps) : '—'} small />
                <KPICard label="Recommend Rate" value={cx.recommendRate ? `${cx.recommendRate}%` : '—'} small />
                <KPICard label="Feedback Types" value={cx.byType.length ? String(cx.byType.length) : '—'} small />
              </div>
              <div className="space-y-2">
                {cx.recent.map((c, i) => (
                  <div key={i} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 flex items-start gap-2 text-xs">
                    <span className="text-[#c8a951] capitalize whitespace-nowrap">{c.type || 'feedback'}</span>
                    <span className="text-gray-300 flex-1">{c.detail}</span>
                    {c.source && <span className="text-gray-500 capitalize">{c.source}</span>}
                    {c.frequency && <span className="text-gray-500">{c.frequency}</span>}
                    {c.store && <span className="text-gray-600">{c.store}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="No customer experience feedback yet" hint="Submitted via the Marketing form or the public Customer Experience survey." height={120} />
          )}
        </Section>

        <Section number={6} title="Action Tracker">
          {actions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Task</th>
                    <th className="text-left py-2 px-3 font-medium">Owner</th>
                    <th className="text-left py-2 px-3 font-medium">Priority</th>
                    <th className="text-left py-2 px-3 font-medium">Deadline</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3">{a.task}</td>
                      <td className="py-2 px-3">{a.owner || '—'}</td>
                      <td className="py-2 px-3 capitalize">{a.priority || '—'}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{a.deadline || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{a.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No actions yet" hint="Submit Action Tracker items in the Marketing form." height={120} />
          )}
        </Section>

        <Section number={7} title="Recent Entries">
          <RecentEntries department="marketing" />
        </Section>
      </div>
    </div>
  );
}
