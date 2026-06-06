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

export default function BrandHealthPage() {
  const { data: m } = useMetrics<BrandLive>('brand');
  const sentiment = m?.sentiment ?? { positive: 0, neutral: 0, negative: 0 };
  const portfolio = m?.portfolio ?? [];
  const sentimentTrend = m?.sentimentTrend ?? [];
  const soc = m?.shareOfConversation ?? [];
  const healthIndex = m?.healthIndex ?? 0;
  const hasSentiment = !!(sentiment.positive || sentiment.neutral || sentiment.negative);

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white">
      <DashboardHeader
        title="BRAND HEALTH COMMAND CENTER"
        subtitle="MEASURE BRAND EQUITY. DRIVE DEMAND. GROW VALUE."
        mission="Brand Health Mission"
        missionDetail="Stronger brands, deeper connections, sustainable growth."
      />

      <div className="px-6 py-4">
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

        <Section number={2} title="Sentiment">
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

        <Section number={3} title="Share of Conversation">
          {soc.length ? (
            <SimpleBarChart data={soc} height={200} color="#c8a951" horizontal />
          ) : (
            <EmptyState message="No competitor data yet" hint="Submit Competitor Analysis in the Brand form." height={160} />
          )}
        </Section>

        <Section number={4} title="Recent Entries">
          <RecentEntries department="brand" />
        </Section>
      </div>
    </div>
  );
}
