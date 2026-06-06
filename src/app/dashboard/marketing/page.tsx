'use client';

import { marketingData, brandData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
import ScoreGauge from '@/components/ui/ScoreGauge';
import { SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

interface MarketingLive {
  leadChannelMix: { name: string; value: number }[];
  totalLeads: number;
  funnel: { reach: number; engagement: number; leads: number; storeVisits: number; revenueInfluenced: number };
}

/* ─── helpers ──────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString();
const pct = (n: number) => `${n}%`;
const ghc = (n: number) =>
  n >= 1_000_000
    ? `GHS ${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `GHS ${(n / 1_000).toFixed(1)}K`
      : `GHS ${n.toLocaleString()}`;

/* ─── derived data ─────────────────────────────────────────── */
const md = marketingData;
const bd = brandData;

const shareOfConversation = [
  { brand: 'Statestreet', pct: 42 },
  { brand: 'Boggi', pct: 14 },
  { brand: 'Hugo Boss', pct: 10 },
  { brand: 'Zara', pct: 15 },
  { brand: 'LC Waikiki', pct: 8 },
  { brand: 'Others', pct: 8 },
];

const brandSentimentDonut = [
  { name: 'Positive', value: 72 },
  { name: 'Neutral', value: 21 },
  { name: 'Negative', value: 8 },
];

const brandExecution = {
  reels: 28,
  photoshoots: 4,
  videos: 6,
  graphics: 52,
  stories: 3,
  ctr: 3.2,
  engagementRate: 4.8,
  roas: 6.4,
};

/* ─── page ─────────────────────────────────────────────────── */
export default function MarketingDashboard() {
  const { data: m } = useMetrics<MarketingLive>('marketing');
  const leadChannelMix = m?.leadChannelMix ?? [];
  const totalLeads = m?.totalLeads ?? 0;
  const funnel = m?.funnel ?? { reach: 0, engagement: 0, leads: 0, storeVisits: 0, revenueInfluenced: 0 };
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DashboardHeader
        title="MARKETING COMMAND CENTER"
        subtitle="DRIVING DEMAND. BUILDING BRANDS. GROWING CUSTOMERS."
        mission="Marketing Mission"
        missionDetail="Create Demand. Build Desire. Bring Customers In."
      />

      <div className="p-4 space-y-4">
        {/* ━━━ 1  BRAND HEALTH COMMAND ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Section number={1} title="Brand Health Command" subtitle="Equity & Perception">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Brand Equity Score table */}
            <div className="lg:col-span-1">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Brand Equity Score</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#2a2a2a] text-gray-500">
                      <th className="text-left py-1.5 pr-2 font-medium">Brand</th>
                      <th className="text-center py-1.5 px-1 font-medium">Awareness</th>
                      <th className="text-center py-1.5 px-1 font-medium">Preference</th>
                      <th className="text-center py-1.5 px-1 font-medium">Sentiment</th>
                      <th className="text-center py-1.5 px-1 font-medium">Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {md.brandHealth.map((b) => (
                      <tr key={b.brand} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                        <td className="py-1.5 pr-2 text-white font-medium">{b.brand}</td>
                        <td className="text-center py-1.5 px-1 text-gray-300">{b.awareness}</td>
                        <td className="text-center py-1.5 px-1 text-gray-300">{b.preference}</td>
                        <td className="text-center py-1.5 px-1 text-gray-300">{b.sentiment}</td>
                        <td className="text-center py-1.5 px-1">
                          <span className={`font-bold ${b.score >= 80 ? 'text-green-400' : b.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {b.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Share of Conversation */}
            <div className="lg:col-span-1">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Share of Conversation</h4>
              <div className="space-y-2">
                {shareOfConversation.map((s) => (
                  <div key={s.brand} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-20 shrink-0 truncate">{s.brand}</span>
                    <div className="flex-1">
                      <ProgressBar
                        value={s.pct}
                        max={50}
                        color={s.brand === 'Statestreet' ? '#c8a951' : '#3b82f6'}
                        height={8}
                      />
                    </div>
                    <span className="text-xs text-white font-semibold min-w-[2rem] text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Brand Sentiment donut */}
            <div className="lg:col-span-1 flex flex-col items-center">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold self-start">Brand Sentiment</h4>
              <SimpleDonutChart
                data={brandSentimentDonut}
                height={170}
                innerRadius={42}
                outerRadius={62}
                centerValue="72%"
                centerLabel="Positive"
                colors={['#22c55e', '#eab308', '#ef4444']}
              />
              <div className="flex gap-4 mt-1 text-[0.65rem]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Positive 72%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Neutral 21%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Negative 8%</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ 2  CAMPAIGN COMMAND CENTER ━━━━━━━━━━━━━━━━━━━━━ */}
        <Section number={2} title="Campaign Command Center" subtitle="Active Campaigns">
          {/* Campaign cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {md.campaigns.map((c) => (
              <div key={c.name} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg overflow-hidden">
                {/* campaign image placeholder */}
                <div className="h-20 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] flex items-center justify-center border-b border-[#2a2a2a]">
                  <span className="text-[0.6rem] text-gray-600 uppercase tracking-wider">{c.brand}</span>
                </div>
                <div className="p-3">
                  <h5 className="text-xs font-bold text-white leading-tight mb-0.5">&ldquo;{c.name}&rdquo;</h5>
                  <p className="text-[0.6rem] text-[#c8a951] mb-2">{c.brand}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.65rem]">
                    <div className="flex justify-between"><span className="text-gray-500">Reach</span><span className="text-white font-medium">{fmt(c.reach)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Engagement</span><span className="text-white font-medium">{fmt(c.engagement)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Leads</span><span className="text-white font-medium">{fmt(c.leads)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="text-white font-medium">{ghc(c.revenue)}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Campaign Funnel */}
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
            <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-3 font-semibold">Campaign Funnel</h4>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {[
                { label: 'Reach', value: funnel.reach },
                { label: 'Engagement', value: funnel.engagement },
                { label: 'Leads', value: funnel.leads },
                { label: 'Store Visits', value: funnel.storeVisits },
                { label: 'Revenue Influenced', value: funnel.revenueInfluenced },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-2">
                  <div className="text-center min-w-[100px]">
                    <div className="text-lg font-bold text-white">{fmt(step.value)}</div>
                    <div className="text-[0.6rem] text-gray-500 uppercase">{step.label}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-[#c8a951] text-lg">&#8594;</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ━━━ 3  CUSTOMER ACQUISITION COMMAND ━━━━━━━━━━━━━━━━ */}
        <Section number={3} title="Customer Acquisition Command" subtitle="Leads & Conversion">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lead Sources */}
            <div className="lg:col-span-1">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Lead Sources</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'WhatsApp Leads', value: md.acquisition.whatsappLeads, icon: '💬' },
                  { label: 'Instagram Leads', value: md.acquisition.instagramLeads, icon: '📸' },
                  { label: 'Website Leads', value: md.acquisition.websiteLeads, icon: '🌐' },
                  { label: 'Walk-In Leads', value: md.acquisition.walkInLeads, icon: '🚶' },
                  { label: 'Corporate Leads', value: md.acquisition.corporateLeads, icon: '🏢' },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5">
                    <div className="text-[0.6rem] text-gray-500 uppercase">{s.label}</div>
                    <div className="text-lg font-bold text-white">{fmt(s.value)}</div>
                  </div>
                ))}
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <KPICard label="Total Leads" value={fmt(totalLeads)} small />
                <KPICard label="Cost Per Lead" value={`GHS ${md.acquisition.costPerLead}`} small />
                <KPICard label="New Customers (MTD)" value={md.acquisition.newCustomers} small />
                <KPICard label="Client Database" value={`+${fmt(md.acquisition.clientDatabase)}`} small />
              </div>
            </div>

            {/* New vs Repeat donut */}
            <div className="lg:col-span-1 flex flex-col items-center">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold self-start">New vs Repeat Customers</h4>
              <SimpleDonutChart
                data={[
                  { name: `New (${md.newVsRepeat.new})`, value: md.newVsRepeat.new },
                  { name: `Repeat (${md.newVsRepeat.repeat})`, value: md.newVsRepeat.repeat },
                ]}
                height={180}
                innerRadius={45}
                outerRadius={65}
                centerValue={`${Math.round((md.newVsRepeat.repeat / (md.newVsRepeat.new + md.newVsRepeat.repeat)) * 100)}%`}
                centerLabel="Repeat"
                colors={['#c8a951', '#3b82f6']}
              />
              <div className="flex gap-4 mt-1 text-[0.65rem]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#c8a951]" />New {md.newVsRepeat.new} (38%)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Repeat {md.newVsRepeat.repeat} (62%)</span>
              </div>
            </div>

            {/* Acquisition channel bar */}
            <div className="lg:col-span-1">
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Lead Channel Mix</h4>
              <SimpleBarChart
                data={leadChannelMix}
                height={180}
                color="#c8a951"
              />
              <div className="mt-2 bg-[#0d0d0d] border border-[#c8a951]/30 rounded-lg p-2 text-center">
                <span className="text-[0.65rem] text-gray-400">Top Acquisition Channel: </span>
                <span className="text-xs text-[#c8a951] font-bold">{md.topChannel} 40.2%</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ 4  CLIENTELING SUPPORT COMMAND ━━━━━━━━━━━━━━━━━ */}
        <Section number={4} title="Clienteling Support Command" subtitle="VIP & Relationship Marketing">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Clienteling KPIs */}
            <div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <KPICard label="VIP Events Held" value={md.clienteling.vipEvents} small />
                <KPICard label="Lookbooks Sent" value={md.clienteling.lookbooks} small />
                <KPICard label="Broadcasts" value={md.clienteling.broadcasts} small />
                <KPICard label="Invitations Sent" value={md.clienteling.invitations} small />
                <KPICard label="RSVP Rate" value={pct(md.clienteling.rsvpRate)} small />
                <KPICard label="Appointments" value={md.clienteling.appointments} small />
              </div>
            </div>

            {/* VIP Engagement & Dormant Reactivation */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">VIP Engagement Metrics</h4>
              <div className="space-y-2">
                {[
                  { label: 'VIP Response Rate', value: 64 },
                  { label: 'Repeat Purchase Rate (VIP)', value: 72 },
                  { label: 'Appointment Conversion', value: 58 },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-48 shrink-0">{m.label}</span>
                    <ProgressBar value={m.value} height={6} />
                    <span className="text-xs font-bold text-white min-w-[2.5rem] text-right">{m.value}%</span>
                  </div>
                ))}
              </div>

              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mt-4 mb-2 font-semibold">Dormant Client Reactivation</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2 text-center">
                  <div className="text-[0.6rem] text-gray-500">Identified</div>
                  <div className="text-sm font-bold text-white">214</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2 text-center">
                  <div className="text-[0.6rem] text-gray-500">Contacted</div>
                  <div className="text-sm font-bold text-white">148</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2 text-center">
                  <div className="text-[0.6rem] text-gray-500">Reactivated</div>
                  <div className="text-sm font-bold text-green-400">37</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ 5  CUSTOMER INTELLIGENCE COMMAND ━━━━━━━━━━━━━━━ */}
        <Section number={5} title="Customer Intelligence Command" subtitle="Insights & Objections">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Objections */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Top Customer Objections</h4>
              <div className="space-y-2">
                {md.customerIntelligence.topObjections.map((o) => (
                  <div key={o.reason} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-32 shrink-0 truncate">{o.reason}</span>
                    <div className="flex-1">
                      <ProgressBar value={o.pct} max={40} color="#ef4444" height={8} />
                    </div>
                    <span className="text-xs text-white font-semibold min-w-[2rem] text-right">{o.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitor Mentions */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Competitor Mentions</h4>
              <div className="space-y-2">
                {md.customerIntelligence.competitorMentions.map((c) => (
                  <div key={c.brand} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-24 shrink-0 truncate">{c.brand}</span>
                    <div className="flex-1">
                      <ProgressBar value={c.pct} max={35} color="#3b82f6" height={8} />
                    </div>
                    <span className="text-xs text-white font-semibold min-w-[2rem] text-right">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Product Requests & Key Insights */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Top Product Requests</h4>
              <ul className="space-y-1.5 mb-4">
                {md.customerIntelligence.topProductRequests.map((r, i) => (
                  <li key={r} className="flex items-center gap-2 text-xs">
                    <span className="text-[#c8a951] font-bold">{i + 1}.</span>
                    <span className="text-gray-300">{r}</span>
                  </li>
                ))}
              </ul>

              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Key Insights</h4>
              <ul className="space-y-1.5">
                {[
                  'Price sensitivity is the #1 barrier to conversion',
                  'WhatsApp is the dominant lead channel at 40%',
                  'Competitors Boggi & Zara most frequently compared',
                  'Loafers and linen shirts in high demand',
                ].map((insight) => (
                  <li key={insight} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-[#c8a951] mt-0.5">&#9679;</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* ━━━ 6  BRAND EXECUTION COMMAND ━━━━━━━━━━━━━━━━━━━━━ */}
        <Section number={6} title="Brand Execution Command" subtitle="Content & Digital Performance">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Content Output */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Content Production (MTD)</h4>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Reels', value: brandExecution.reels },
                  { label: 'Photoshoots', value: brandExecution.photoshoots },
                  { label: 'Videos', value: brandExecution.videos },
                  { label: 'Graphics', value: brandExecution.graphics },
                  { label: 'Stories', value: brandExecution.stories },
                ].map((c) => (
                  <div key={c.label} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-white">{c.value}</div>
                    <div className="text-[0.6rem] text-gray-500 uppercase">{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Store Marketing & Digital */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Store Marketing</h4>
              <div className="space-y-2 mb-4">
                {[
                  { label: 'VM Compliance', value: 84 },
                  { label: 'Campaign POS Deployed', value: 78 },
                  { label: 'Window Display Updated', value: 90 },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-44 shrink-0">{m.label}</span>
                    <ProgressBar value={m.value} height={6} />
                    <span className="text-xs font-bold text-white min-w-[2.5rem] text-right">{m.value}%</span>
                  </div>
                ))}
              </div>

              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Digital Marketing</h4>
              <div className="space-y-2">
                {[
                  { label: 'Social Media Reach', value: '1.24M' },
                  { label: 'Engagement', value: '142K' },
                  { label: 'Web Visits', value: '89K' },
                  { label: 'Leads Generated', value: '1,551' },
                ].map((m) => (
                  <div key={m.label} className="flex justify-between text-xs py-1 border-b border-[#1a1a1a]">
                    <span className="text-gray-400">{m.label}</span>
                    <span className="text-white font-medium">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h4 className="text-xs text-[#c8a951] uppercase tracking-wider mb-2 font-semibold">Performance Metrics</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center">
                  <ScoreGauge score={Math.round(brandExecution.ctr * 10)} label="CTR" size="md" color="#c8a951" />
                  <span className="text-xs font-bold text-white mt-1">{brandExecution.ctr}%</span>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreGauge score={Math.round(brandExecution.engagementRate * 10)} label="Eng. Rate" size="md" color="#22c55e" />
                  <span className="text-xs font-bold text-white mt-1">{brandExecution.engagementRate}%</span>
                </div>
                <div className="flex flex-col items-center">
                  <ScoreGauge score={Math.round(brandExecution.roas * 10)} label="ROAS" size="md" color="#3b82f6" />
                  <span className="text-xs font-bold text-white mt-1">{brandExecution.roas}x</span>
                </div>
              </div>

              <div className="mt-4 bg-[#0d0d0d] border border-[#c8a951]/20 rounded-lg p-3">
                <h5 className="text-[0.65rem] text-[#c8a951] uppercase tracking-wider mb-1 font-semibold">Content Calendar Status</h5>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Scheduled Posts</span>
                  <span className="text-white font-medium">24 / 30</span>
                </div>
                <ProgressBar value={80} height={4} color="#c8a951" />
              </div>
            </div>
          </div>
        </Section>

        {/* ━━━ MARKETING PRIORITIES & ACTION TRACKER ━━━━━━━━━━ */}
        <Section title="Marketing Priorities & Action Tracker">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Task</th>
                  <th className="text-left py-2 pr-3 font-medium">Key Actions</th>
                  <th className="text-left py-2 pr-3 font-medium">Owner</th>
                  <th className="text-left py-2 pr-3 font-medium">Deadline</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {md.priorities.map((p, i) => (
                  <tr key={p.task} className="border-b border-[#1a1a1a] hover:bg-[#151515]">
                    <td className="py-2 pr-3 text-[#c8a951] font-bold">{i + 1}</td>
                    <td className="py-2 pr-3 text-white font-medium max-w-[250px]">{p.task}</td>
                    <td className="py-2 pr-3 text-gray-400 max-w-[200px]">{p.keyAction}</td>
                    <td className="py-2 pr-3 text-gray-300">{p.owner}</td>
                    <td className="py-2 pr-3 text-gray-400">{p.deadline}</td>
                    <td className="py-2 pr-3"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ━━━ MARKETING TEAM PERFORMANCE (MTD) ━━━━━━━━━━━━━━ */}
        <Section title="Marketing Team Performance" subtitle="MTD">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {md.teamPerformance.map((t) => (
              <div key={t.metric} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3 flex flex-col items-center gap-2">
                <ScoreGauge score={t.value} label={t.metric} size="lg" />
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
