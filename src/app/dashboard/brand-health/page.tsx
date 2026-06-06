'use client';

import DashboardHeader from '@/components/layout/DashboardHeader';
import KPICard from '@/components/ui/KPICard';
import Section from '@/components/ui/Section';
import ProgressBar from '@/components/ui/ProgressBar';
import ScoreGauge from '@/components/ui/ScoreGauge';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import RecentEntries from '@/components/ui/RecentEntries';
import { SimpleBarChart, SimpleDonutChart, SimpleLineChart } from '@/components/charts/Charts';
import { useState } from 'react';
import PeriodTabs from '@/components/ui/PeriodTabs';
import { useMetrics, type Period } from '@/lib/api';

interface BrandLive {
  sentiment: { positive: number; neutral: number; negative: number };
  nps: number;
  momentum: number;
  shareOfConversation: { name: string; value: number }[];
  sentimentTrend: { name: string; value: number }[];
  portfolio: { brand: string; score: number; status: string; trend: string }[];
  healthIndex: number;
  equity: { name: string; value: number }[];
  digitalReputation: { googleRating: number; googleReviews: number; trustpilot: number; responseRate: number; nps: number };
  social: { followers: number; sentiment: number; newReviews: number; negReviews: number };
  risks: { text: string; tag: string }[];
  opportunities: { text: string; tag: string }[];
  ceoAttention: { priority: string; issue: string; impact: string; owner: string; status: string }[];
}

export default function BrandHealthPage() {
  const [period, setPeriod] = useState<Period>('mtd');
  const { data: m } = useMetrics<BrandLive>('brand', period);
  const sentiment = m?.sentiment ?? { positive: 0, neutral: 0, negative: 0 };
  const portfolio = m?.portfolio ?? [];
  const sentimentTrend = m?.sentimentTrend ?? [];
  const soc = m?.shareOfConversation ?? [];
  const healthIndex = m?.healthIndex ?? 0;
  const equity = (m?.equity ?? []).filter((e) => e.value > 0);
  const hasSentiment = !!(sentiment.positive || sentiment.neutral || sentiment.negative);
  const dr = m?.digitalReputation ?? { googleRating: 0, googleReviews: 0, trustpilot: 0, responseRate: 0, nps: 0 };
  const social = m?.social ?? { followers: 0, sentiment: 0, newReviews: 0, negReviews: 0 };
  const hasDigital = !!(dr.googleRating || dr.trustpilot || dr.responseRate || social.followers);
  const risks = m?.risks ?? [];
  const opportunities = m?.opportunities ?? [];
  const ceoAttention = m?.ceoAttention ?? [];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="BRAND HEALTH COMMAND CENTER"
        subtitle="MEASURE BRAND EQUITY. DRIVE DEMAND. GROW VALUE."
        mission="Brand Health Mission"
        missionDetail="Stronger brands, deeper connections, sustainable growth."
      />

      <div className="px-6 pt-4 flex justify-end">
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>
      <div className="px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard label="Brand Health Index" value={healthIndex ? String(healthIndex) : '—'} status="green" small />
          <KPICard label="NPS" value={(m?.nps ?? 0) ? String(m?.nps) : '—'} small />
          <KPICard label="Brand Momentum" value={(m?.momentum ?? 0) ? String(m?.momentum) : '—'} small />
          <KPICard label="Positive Sentiment" value={sentiment.positive ? `${sentiment.positive}%` : '—'} small />
        </div>
      </div>

      <div className="px-6 pb-8 space-y-6">
        <Section number={1} title="Brand Health Index & Portfolio">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[#111] border border-[#2a2a2a] rounded-lg p-4 flex flex-col items-center justify-center">
              {healthIndex ? (
                <>
                  <ScoreGauge score={healthIndex} size="lg" color="#c8a951" />
                  <StatusBadge status={healthIndex >= 75 ? 'HEALTHY' : healthIndex >= 60 ? 'WATCH' : 'AT RISK'} size="md" />
                  <div className="text-[0.65rem] text-gray-500 mt-2">{portfolio.length} brand(s) tracked</div>
                </>
              ) : (
                <EmptyState message="No brand scores yet" hint="Submit Brand Health Score in the Brand form." height={180} />
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Portfolio Health</div>
              {portfolio.length ? (
                <div className="space-y-2">
                  {portfolio.map((b) => (
                    <div key={b.brand} className="flex items-center gap-3">
                      <span className="text-xs font-medium truncate flex-1">{b.brand}</span>
                      <div className="flex-1">
                        <ProgressBar value={b.score} max={100} color={b.score >= 80 ? '#22c55e' : b.score >= 70 ? '#eab308' : '#ef4444'} height={5} />
                      </div>
                      <span className="text-sm font-bold min-w-[2rem] text-right">{b.score}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState height={180} />
              )}
            </div>
          </div>
        </Section>

        <Section number={2} title="Brand Equity Dimensions">
          {equity.length ? (
            <SimpleBarChart data={equity} height={200} color="#c8a951" />
          ) : (
            <EmptyState message="No brand equity data yet" hint="Submit Brand Health Score (awareness, consideration, etc.) in the Brand form." height={160} />
          )}
        </Section>

        <Section number={3} title="Sentiment">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Sentiment Split</div>
              {hasSentiment ? (
                <SimpleDonutChart
                  data={[
                    { name: 'Positive', value: sentiment.positive },
                    { name: 'Neutral', value: sentiment.neutral },
                    { name: 'Negative', value: sentiment.negative },
                  ]}
                  height={200}
                  centerLabel="Positive"
                  centerValue={`${sentiment.positive}%`}
                  colors={['#22c55e', '#6b7280', '#ef4444']}
                />
              ) : (
                <EmptyState message="No sentiment data yet" hint="Submit Brand Sentiment in the Brand form." height={200} />
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="text-xs text-gray-400 mb-2">Positive Sentiment Trend</div>
              {sentimentTrend.length ? (
                <SimpleLineChart data={sentimentTrend} height={200} color="#22c55e" area />
              ) : (
                <EmptyState message="Trend builds as monthly sentiment is recorded" height={200} />
              )}
            </div>
          </div>
        </Section>

        <Section number={4} title="Share of Conversation">
          {soc.length ? (
            <SimpleBarChart data={soc} height={200} color="#c8a951" horizontal />
          ) : (
            <EmptyState message="No competitor data yet" hint="Submit Competitor Analysis in the Brand form." height={160} />
          )}
        </Section>

        <Section number={5} title="Digital Reputation & Social">
          {hasDigital ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Google Rating</div>
                <div className="text-lg font-bold">{dr.googleRating ? `${dr.googleRating}★` : '—'}</div>
                <div className="text-[0.6rem] text-gray-600 mt-0.5">{dr.googleReviews || 0} reviews</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Trustpilot</div>
                <div className="text-lg font-bold">{dr.trustpilot ? `${dr.trustpilot}★` : '—'}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">Response Rate</div>
                <div className="text-lg font-bold">{dr.responseRate ? `${dr.responseRate}%` : '—'}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">IG Followers</div>
                <div className="text-lg font-bold">{social.followers ? social.followers.toLocaleString() : '—'}</div>
              </div>
              <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-3">
                <div className="text-[0.65rem] text-gray-500 uppercase tracking-wider">New / Neg Reviews</div>
                <div className="text-lg font-bold">
                  <span className="text-green-400">{social.newReviews || 0}</span>
                  <span className="text-gray-600"> / </span>
                  <span className="text-red-400">{social.negReviews || 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="No digital reputation data yet" hint="Submit Digital Reputation in the Brand form." height={120} />
          )}
        </Section>

        <Section number={6} title="Risks & Opportunities">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-2">Risks</div>
              {risks.length ? (
                <div className="space-y-2">
                  {risks.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                      <span className="text-red-400 mt-0.5">▲</span>
                      <span className="text-gray-300 flex-1">{r.text}</span>
                      {r.tag && <span className="text-gray-500 text-[0.6rem]">{r.tag}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No risks flagged" hint="Customer Voice (frustrations) & competitor threats appear here." height={120} />
              )}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">Opportunities</div>
              {opportunities.length ? (
                <div className="space-y-2">
                  {opportunities.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
                      <span className="text-green-400 mt-0.5">▲</span>
                      <span className="text-gray-300 flex-1">{o.text}</span>
                      {o.tag && <span className="text-gray-500 text-[0.6rem]">{o.tag}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No opportunities flagged" hint="Customer Voice (compliments/requests) appear here." height={120} />
              )}
            </div>
          </div>
        </Section>

        <Section number={7} title="CEO Attention Index">
          {ceoAttention.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] text-gray-500">
                    <th className="text-left py-2 pr-3 font-medium">Priority</th>
                    <th className="text-left py-2 px-3 font-medium">Issue</th>
                    <th className="text-left py-2 px-3 font-medium">Impact</th>
                    <th className="text-left py-2 px-3 font-medium">Owner</th>
                    <th className="text-left py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ceoAttention.map((c, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      <td className="py-2 pr-3 capitalize">{c.priority || '—'}</td>
                      <td className="py-2 px-3">{c.issue}</td>
                      <td className="py-2 px-3 capitalize">{c.impact || '—'}</td>
                      <td className="py-2 px-3">{c.owner || '—'}</td>
                      <td className="py-2 pl-3 capitalize">{c.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No CEO attention items" hint="Submit CEO Attention Items in the Brand form." height={120} />
          )}
        </Section>

        <Section number={8} title="Recent Entries">
          <RecentEntries department="brand" />
        </Section>
      </div>
    </div>
  );
}
