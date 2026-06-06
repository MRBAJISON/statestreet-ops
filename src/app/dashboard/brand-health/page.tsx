'use client';

import { brandData } from '@/lib/data';
import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import StatusBadge from '@/components/ui/StatusBadge';
import ScoreGauge from '@/components/ui/ScoreGauge';
import ProgressBar from '@/components/ui/ProgressBar';
import { SimpleLineChart, SimpleBarChart, SimpleDonutChart } from '@/components/charts/Charts';
import { useMetrics } from '@/lib/api';

interface BrandLive {
  sentiment: { positive: number; neutral: number; negative: number };
  nps: number;
  momentum: number;
  shareOfConversation: { name: string; value: number }[];
  sentimentTrend: { name: string; value: number }[];
  portfolio: { brand: string; score: number; status: string; trend: string }[];
  healthIndex: number;
}

const fmt = (n: number, prefix = 'GHS ') => {
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${n.toLocaleString()}`;
};

const trendArrow = (trend: string) =>
  trend === 'up' ? <span className="text-green-400">&#9650;</span>
  : trend === 'down' ? <span className="text-red-400">&#9660;</span>
  : <span className="text-gray-500">&#9644;</span>;

const equityLabel = (score: number) => score >= 75 ? 'Strong' : score >= 60 ? 'Watch' : 'At Risk';

const weatherIcon = (weather: string) => {
  const w = weather.toLowerCase();
  if (w === 'sunny') return <span className="text-2xl">&#9728;&#65039;</span>;
  if (w === 'partly cloudy') return <span className="text-2xl">&#9925;</span>;
  if (w === 'cloudy') return <span className="text-2xl">&#9729;&#65039;</span>;
  if (w === 'improving') return <span className="text-2xl">&#127780;&#65039;</span>;
  return <span className="text-2xl">&#9728;&#65039;</span>;
};

export default function BrandHealthPage() {
  const d = brandData;
  const { data: m } = useMetrics<BrandLive>('brand');
  const liveSentiment = m?.sentiment ?? { positive: 0, neutral: 0, negative: 0 };
  const nps = m?.nps ?? 0;
  const momentum = m?.momentum ?? 0;
  const healthIndex = m?.healthIndex ?? 0;
  const portfolio = m?.portfolio ?? [];

  // Chart data
  const socData = (m?.shareOfConversation?.length ? m.shareOfConversation : []);
  const sentimentDonut = [
    { name: 'Positive', value: liveSentiment.positive },
    { name: 'Neutral', value: liveSentiment.neutral },
    { name: 'Negative', value: liveSentiment.negative },
  ];
  const sentimentTrend = m?.sentimentTrend ?? [];
  const momentumData = d.momentumDrivers.map(m => ({ name: m.driver, value: m.score }));

  // vs last month deltas for momentum (simulated)
  const momentumDeltas: Record<string, number> = {
    'Marketing Campaigns': 5, 'Traffic Generation': -2, 'Conversion Improvement': 3,
    'Customer Engagement': 1, 'Online Visibility': -1, 'Sales Momentum': 4, 'Brand Advocacy': -3,
  };

  // Merchandise brand health arrow
  const merchTrend = (score: number, idx: number): 'up' | 'down' | 'stable' => {
    if (idx === 0 || idx === 1 || idx === 4) return 'up';
    if (idx === 3 || idx === 5) return 'down';
    return 'stable';
  };

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="STATESTREET BRAND HEALTH COMMAND CENTER"
        subtitle="MEASURE BRAND EQUITY. DRIVE DEMAND. GROW VALUE."
        mission="Brand Health Mission"
        missionDetail="Stronger Brands. Deeper Connections. Sustainable Growth."
      />

      {/* TOP AREA: Brand Health Index + Portfolio + Summary */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Brand Health Index Gauge */}
          <div className="lg:col-span-3 bg-[#111] border border-[#2a2a2a] rounded-lg p-4 flex flex-col items-center justify-center">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-2">StateStreet Brand Health Index</div>
            <ScoreGauge score={healthIndex} size="lg" color="#c8a951" />
            <StatusBadge status={healthIndex >= 75 ? 'HEALTHY' : healthIndex >= 60 ? 'WATCH' : 'AT RISK'} size="md" />
            <div className="flex gap-4 mt-3 text-[0.65rem]">
              <div className="text-center">
                <div className="text-gray-500">Brands Tracked</div>
                <div className="text-[#c8a951] font-bold">{portfolio.length}</div>
              </div>
            </div>
          </div>

          {/* Brand Portfolio Health */}
          <div className="lg:col-span-4 bg-[#111] border border-[#2a2a2a] rounded-lg p-4">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-3">Brand Portfolio Health</div>
            <div className="space-y-2">
              {portfolio.map(b => (
                <div key={b.brand} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">{b.brand}</span>
                      {trendArrow(b.trend)}
                    </div>
                    <ProgressBar value={b.score} max={100} color={b.score >= 80 ? '#22c55e' : b.score >= 70 ? '#eab308' : '#ef4444'} height={5} />
                  </div>
                  <span className="text-sm font-bold min-w-[2rem] text-right">{b.score}</span>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Summary (MTD) */}
          <div className="lg:col-span-5">
            <div className="text-[0.65rem] text-gray-400 uppercase tracking-wider mb-2 px-1">Portfolio Summary (MTD)</div>
            <div className="grid grid-cols-3 gap-2">
              <KPICard label="Total Revenue" value="4.9M" prefix="GHS " status="green" small />
              <KPICard label="Total Traffic" value="23,842" status="green" small />
              <KPICard label="Conversion Rate" value="25.8" suffix="%" status="green" small />
              <KPICard label="Avg Transaction Value" value="3,185" prefix="GHS " status="green" small />
              <KPICard label="NPS" value={nps} status="green" small />
              <KPICard label="Brand Momentum Score" value={momentum} status="green" small />
            </div>
          </div>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="px-6 pb-8 space-y-6">

        {/* 1. Brand Equity Overview */}
        <Section number={1} title="Brand Equity Overview" subtitle="Portfolio Average">
          <div className="grid grid-cols-5 gap-4">
            {([
              { key: 'awareness' as const, label: 'Awareness', trend: 'up' },
              { key: 'consideration' as const, label: 'Consideration', trend: 'up' },
              { key: 'preference' as const, label: 'Preference', trend: 'stable' },
              { key: 'loyalty' as const, label: 'Loyalty', trend: 'up' },
              { key: 'advocacy' as const, label: 'Advocacy', trend: 'down' },
            ] as const).map(m => (
              <div key={m.key} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 flex flex-col items-center">
                <ScoreGauge score={d.equity[m.key]} size="md" />
                <div className="text-xs font-medium mt-2">{m.label}</div>
                <div className="flex items-center gap-1 mt-1">
                  <StatusBadge status={equityLabel(d.equity[m.key])} />
                  {trendArrow(m.trend)}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 2. Share of Conversation */}
        <Section number={2} title="Share of Conversation" subtitle="vs Competitors">
          <SimpleBarChart data={socData} height={260} horizontal color="#c8a951" />
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mt-3">
            {d.shareOfConversation.map(s => (
              <div key={s.brand} className="text-center">
                <div className="text-sm font-bold text-[#c8a951]">{s.pct}%</div>
                <div className="text-[0.6rem] text-gray-500 truncate">{s.brand}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* 3. Brand Sentiment */}
        <Section number={3} title="Brand Sentiment" subtitle="Social & Customer Feedback">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut */}
            <div>
              <SimpleDonutChart
                data={sentimentDonut}
                height={220}
                innerRadius={60}
                outerRadius={85}
                centerLabel="Overall"
                centerValue={`${liveSentiment.positive}%`}
                colors={['#22c55e', '#6b7280', '#ef4444']}
              />
              <div className="flex justify-center gap-6 mt-3">
                <div className="text-center">
                  <div className="text-green-400 text-lg font-bold">{liveSentiment.positive}%</div>
                  <div className="text-[0.6rem] text-gray-500">Positive</div>
                  <div className="text-[0.6rem] text-green-400">+6pp</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400 text-lg font-bold">{liveSentiment.neutral}%</div>
                  <div className="text-[0.6rem] text-gray-500">Neutral</div>
                  <div className="text-[0.6rem] text-yellow-400">-2pp</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 text-lg font-bold">{liveSentiment.negative}%</div>
                  <div className="text-[0.6rem] text-gray-500">Negative</div>
                  <div className="text-[0.6rem] text-green-400">-4pp</div>
                </div>
              </div>
            </div>

            {/* Sentiment Trend */}
            <div>
              <div className="text-xs text-gray-400 mb-2">Sentiment Trend (Last 6 Months)</div>
              <SimpleLineChart data={sentimentTrend} height={220} color="#22c55e" area />
            </div>
          </div>
        </Section>

        {/* 4. Market Position */}
        <Section number={4} title="Market Position" subtitle="Competitive Map">
          <div className="text-[0.65rem] text-gray-500 mb-2 flex justify-between">
            <span>Price Positioning &rarr;</span>
            <span>Perceived Quality &uarr;</span>
          </div>
          <div className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg" style={{ height: 320 }}>
            {/* Grid lines */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-px h-full bg-[#1a1a1a]" />
            </div>
            <div className="absolute inset-0 flex items-center">
              <div className="h-px w-full bg-[#1a1a1a]" />
            </div>
            {/* Axis labels */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[0.55rem] text-gray-600">PRICE POSITIONING</div>
            <div className="absolute top-1 left-2 text-[0.55rem] text-gray-600">HIGH QUALITY</div>
            <div className="absolute bottom-1 left-2 text-[0.55rem] text-gray-600">LOW QUALITY</div>
            <div className="absolute top-1 right-2 text-[0.55rem] text-gray-600">PREMIUM</div>
            <div className="absolute top-1 left-12 text-[0.55rem] text-gray-600">VALUE</div>

            {/* Brands plotted */}
            {d.marketPosition.map(b => {
              const x = (b.pricePosition / 100) * 85 + 5;
              const y = 100 - ((b.perceivedQuality / 100) * 85 + 5);
              const isOwn = !b.isCompetitor;
              return (
                <div
                  key={b.brand}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div
                    className={`w-3 h-3 rounded-full ${isOwn ? 'bg-[#c8a951] shadow-[0_0_8px_rgba(200,169,81,0.5)]' : 'bg-gray-500'}`}
                  />
                  <span className={`text-[0.55rem] mt-0.5 whitespace-nowrap ${isOwn ? 'text-[#c8a951]' : 'text-gray-500'}`}>
                    {b.brand}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-[0.6rem] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#c8a951] inline-block" /> Our Brands
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Competitors
            </span>
          </div>
        </Section>

        {/* 5. Brand Momentum Drivers */}
        <Section number={5} title="Brand Momentum Drivers" subtitle="Group Score">
          <div className="space-y-3">
            {d.momentumDrivers.map(m => {
              const delta = momentumDeltas[m.driver] ?? 0;
              return (
                <div key={m.driver} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-44 truncate">{m.driver}</span>
                  <div className="flex-1">
                    <ProgressBar value={m.score} max={100} color={m.score >= 80 ? '#22c55e' : m.score >= 60 ? '#eab308' : '#ef4444'} height={8} />
                  </div>
                  <span className="text-sm font-bold min-w-[2.5rem] text-right">{m.score}</span>
                  <span className={`text-[0.65rem] min-w-[3.5rem] text-right ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    vs LM {delta >= 0 ? '+' : ''}{delta}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* 6. Merchandise Brand Health */}
        <Section number={6} title="Merchandise Brand Health" subtitle="Top Brands">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Brand</th>
                  <th className="text-center py-2 px-2 font-medium">Awareness</th>
                  <th className="text-center py-2 px-2 font-medium">Consideration</th>
                  <th className="text-center py-2 px-2 font-medium">Preference</th>
                  <th className="text-center py-2 px-2 font-medium">Satisfaction</th>
                  <th className="text-center py-2 px-2 font-medium">Momentum</th>
                  <th className="text-center py-2 px-2 font-medium">Health Score</th>
                  <th className="text-center py-2 pl-2 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {d.merchandiseBrandHealth.map((b, idx) => {
                  const trend = merchTrend(b.score, idx);
                  return (
                    <tr key={b.brand} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50">
                      <td className="py-2 pr-3 font-medium">{b.brand}</td>
                      <td className="py-2 px-2 text-center">{b.awareness}</td>
                      <td className="py-2 px-2 text-center">{b.consideration}</td>
                      <td className="py-2 px-2 text-center">{b.preference}</td>
                      <td className="py-2 px-2 text-center">{b.satisfaction}</td>
                      <td className="py-2 px-2 text-center">{b.momentum}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-bold ${b.score >= 80 ? 'text-green-400' : b.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {b.score}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-center">
                        {trend === 'up' && <span className="text-green-400 text-[0.6rem]">&#9650; Improved</span>}
                        {trend === 'down' && <span className="text-red-400 text-[0.6rem]">&#9660; Declined</span>}
                        {trend === 'stable' && <span className="text-gray-500 text-[0.6rem]">&#9644; No Change</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 7. Customer Voice */}
        <Section number={7} title="Customer Voice" subtitle="Insights">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Compliments */}
            <div className="bg-[#0d0d0d] border border-green-500/20 rounded-lg p-4">
              <div className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Top Compliments</div>
              <ul className="space-y-2">
                {d.customerVoice.compliments.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-green-400 mt-0.5 flex-shrink-0">&#10003;</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Frustrations */}
            <div className="bg-[#0d0d0d] border border-red-500/20 rounded-lg p-4">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Top Frustrations</div>
              <ul className="space-y-2">
                {d.customerVoice.frustrations.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">&#10007;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Emerging Themes */}
            <div className="bg-[#0d0d0d] border border-[#c8a951]/20 rounded-lg p-4">
              <div className="text-xs font-bold text-[#c8a951] uppercase tracking-wider mb-3">Emerging Themes</div>
              <ul className="space-y-2">
                {d.customerVoice.emergingThemes.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="text-[#c8a951] mt-0.5 flex-shrink-0">&#9733;</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 8. Category Health */}
        <Section number={8} title="Category Health" subtitle="Group">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-3 font-medium">Category</th>
                  <th className="text-center py-2 px-2 font-medium">Health Score</th>
                  <th className="py-2 px-2 font-medium text-left">Health Bar</th>
                  <th className="text-center py-2 pl-2 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody>
                {d.categoryHealth.map(c => (
                  <tr key={c.category} className="border-b border-[#1a1a1a]">
                    <td className="py-2 pr-3 font-medium">{c.category}</td>
                    <td className="py-2 px-2 text-center">
                      <span className={`font-bold ${c.health >= 80 ? 'text-green-400' : c.health >= 65 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {c.health}
                      </span>
                    </td>
                    <td className="py-2 px-2 w-40">
                      <ProgressBar value={c.health} max={100} height={6} />
                    </td>
                    <td className="py-2 pl-2 text-center">
                      {trendArrow(c.trend)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 9. Digital Reputation */}
        <Section number={9} title="Digital Reputation">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Digital KPIs */}
            <div>
              <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Online Reputation</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#c8a951]">{d.digitalReputation.googleRating}</div>
                  <div className="text-[0.6rem] text-gray-500">Google Rating</div>
                  <div className="text-[0.55rem] text-gray-600">out of 5.0</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{d.digitalReputation.instaSentiment}%</div>
                  <div className="text-[0.6rem] text-gray-500">Instagram Sentiment</div>
                  <div className="text-[0.55rem] text-gray-600">Positive</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{d.digitalReputation.responseRate}%</div>
                  <div className="text-[0.6rem] text-gray-500">Response Rate</div>
                  <div className="text-[0.55rem] text-gray-600">within 24hrs</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-[#c8a951]">{d.digitalReputation.nps}</div>
                  <div className="text-[0.6rem] text-gray-500">NPS Score</div>
                  <div className="text-[0.55rem] text-gray-600">Net Promoter</div>
                </div>
              </div>
            </div>

            {/* Social Media Performance */}
            <div>
              <div className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wider">Social Media Performance (MTD)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-[0.65rem] text-gray-500">Reach</div>
                  <div className="text-xl font-bold">{fmt(d.socialMedia.reach, '')}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-[0.65rem] text-gray-500">Engagement</div>
                  <div className="text-xl font-bold">{fmt(d.socialMedia.engagement, '')}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-[0.65rem] text-gray-500">Website Visits</div>
                  <div className="text-xl font-bold">{fmt(d.socialMedia.webVisits, '')}</div>
                </div>
                <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4">
                  <div className="text-[0.65rem] text-gray-500">Leads Generated</div>
                  <div className="text-xl font-bold">{d.socialMedia.leadsGenerated.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 10. Brand Weather Forecast */}
        <Section number={10} title="Brand Weather Forecast" subtitle="Next 4 Weeks Outlook">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {d.brandWeather.map(b => (
              <div key={b.brand} className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-center">
                <div className="text-xs font-medium mb-2">{b.brand}</div>
                {weatherIcon(b.weather)}
                <div className="mt-1">
                  <StatusBadge status={b.weather.toUpperCase()} size="sm" />
                </div>
                <div className="mt-3 text-left">
                  <div className="text-[0.6rem] text-gray-500">Forecast Impact</div>
                  <div className="text-[0.65rem] text-gray-300 mt-0.5">{b.impact}</div>
                  <div className="text-[0.6rem] text-gray-500 mt-1.5">Driver</div>
                  <div className="text-[0.65rem] text-[#c8a951] mt-0.5">{b.driver}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 11. Key Risks & Opportunities */}
        <Section number={11} title="Key Risks & Opportunities">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Risks */}
            <div className="bg-[#0d0d0d] border border-red-500/20 rounded-lg p-4">
              <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Top Risks</div>
              <ul className="space-y-2.5">
                {d.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="bg-red-500/20 text-red-400 text-[0.6rem] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Opportunities */}
            <div className="bg-[#0d0d0d] border border-green-500/20 rounded-lg p-4">
              <div className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Top Opportunities</div>
              <ul className="space-y-2.5">
                {d.opportunities.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                    <span className="bg-green-500/20 text-green-400 text-[0.6rem] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* 12. CEO Attention Index */}
        <Section number={12} title="CEO Attention Index">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-gray-500">
                  <th className="text-left py-2 pr-2 font-medium">Priority</th>
                  <th className="text-left py-2 px-2 font-medium">Issue</th>
                  <th className="text-center py-2 px-2 font-medium">Impact</th>
                  <th className="text-left py-2 px-2 font-medium">Owner</th>
                  <th className="text-center py-2 px-2 font-medium">Due Date</th>
                  <th className="text-center py-2 pl-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.ceoAttention.map((item, i) => (
                  <tr key={i} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]/50">
                    <td className="py-2 pr-2">
                      <span className={`font-bold ${
                        item.priority === 'P1' ? 'text-red-400' : item.priority === 'P2' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-2 px-2">{item.issue}</td>
                    <td className="py-2 px-2 text-center">
                      <StatusBadge status={item.impact.includes('High') || item.impact.includes('Cash') ? 'High' : item.impact.includes('Long') ? 'Medium' : 'Medium'} />
                    </td>
                    <td className="py-2 px-2 text-gray-400">{item.owner}</td>
                    <td className="py-2 px-2 text-center text-gray-400">{item.dueDate}</td>
                    <td className="py-2 pl-2 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

      </div>
    </div>
  );
}
