import { Activity, HeartPulse, Lightbulb, MessageCircleMore, ShieldAlert, Star, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyticsMeta, BrandDomain } from '@/lib/contracts/analytics';
import { MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { HorizontalBarChart, NamedBarChart, SentimentTrendChart } from './Charts';
import { formatNumber, formatPercent } from './format';

export function BrandOverview({ domain }: { meta: AnalyticsMeta; domain: BrandDomain }) {
  return (
    <div className="flex flex-col gap-5">
      <MetricRail items={[
        { label: 'Health index', value: formatPercent(domain.summary.healthIndex), detail: 'Across assessed brands', icon: HeartPulse, tone: 'green' },
        { label: 'Momentum', value: formatPercent(domain.summary.momentum), detail: 'Portfolio growth signal', icon: TrendingUp, tone: 'blue' },
        { label: 'Positive sentiment', value: formatPercent(domain.summary.positiveSentiment), detail: 'Share of tracked mentions', icon: MessageCircleMore, tone: 'teal' },
        { label: 'Google rating', value: domain.summary.googleRating === null ? 'No rating' : domain.summary.googleRating.toFixed(2), detail: 'Latest brand snapshots', icon: Star, tone: 'amber' },
        { label: 'Customer NPS', value: domain.summary.nps === null ? 'No score' : domain.summary.nps.toFixed(0), detail: 'Selected period', icon: Activity, tone: 'blue' },
        { label: 'High threats', value: String(domain.summary.highThreats), detail: 'Competitor activity', icon: ShieldAlert, tone: 'coral' },
      ]} />

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-5">
          <SectionHeading title="Brand Health Index & Portfolio" description="Composite brand-health assessment" />
          <NamedBarChart data={domain.brands.map((brand) => ({ name: brand.name, value: brand.health }))} valueFormatter={formatPercent} />
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-7">
          <div className="p-5 pb-3"><SectionHeading title="Brand Portfolio Detail" description="Health, momentum, sentiment, and reputation by brand" /></div>
          <Table><TableHeader><TableRow><TableHead>Brand</TableHead><TableHead className="text-right">Health</TableHead><TableHead className="text-right">Momentum</TableHead><TableHead className="text-right">Sentiment</TableHead><TableHead className="text-right">Rating</TableHead></TableRow></TableHeader><TableBody>{domain.brands.map((brand) => <TableRow key={brand.id}><TableCell className="font-medium">{brand.name}</TableCell><TableCell className="text-right">{formatPercent(brand.health)}</TableCell><TableCell className="text-right">{formatPercent(brand.momentum)}</TableCell><TableCell className="text-right">{formatPercent(brand.positiveSentiment)}</TableCell><TableCell className="text-right">{brand.googleRating?.toFixed(2) ?? 'No data'}</TableCell></TableRow>)}</TableBody></Table>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-4">
          <SectionHeading title="Brand Equity Dimensions" description="Portfolio-level awareness through advocacy" />
          <HorizontalBarChart data={domain.equity} valueFormatter={formatPercent} />
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-8">
          <div className="p-5 pb-3"><SectionHeading title="Equity Detail by Brand" description="Awareness, consideration, preference, satisfaction, loyalty, and advocacy" /></div>
          <Table><TableHeader><TableRow><TableHead>Brand</TableHead><TableHead className="text-right">Awareness</TableHead><TableHead className="text-right">Consideration</TableHead><TableHead className="text-right">Preference</TableHead><TableHead className="text-right">Satisfaction</TableHead><TableHead className="text-right">Loyalty</TableHead><TableHead className="text-right">Advocacy</TableHead></TableRow></TableHeader><TableBody>{domain.brands.map((brand) => <TableRow key={brand.id}><TableCell className="font-medium">{brand.name}</TableCell><TableCell className="text-right">{formatPercent(brand.awareness)}</TableCell><TableCell className="text-right">{formatPercent(brand.consideration)}</TableCell><TableCell className="text-right">{formatPercent(brand.preference)}</TableCell><TableCell className="text-right">{formatPercent(brand.satisfaction)}</TableCell><TableCell className="text-right">{formatPercent(brand.loyalty)}</TableCell><TableCell className="text-right">{formatPercent(brand.advocacy)}</TableCell></TableRow>)}</TableBody></Table>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-8">
          <SectionHeading title="Sentiment" description="Positive, neutral, and negative brand conversation over time" />
          <SentimentTrendChart data={domain.sentimentTrend} />
        </section>
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Current Sentiment Mix" description="Latest portfolio distribution" />
          <div className="mt-5 divide-y">{[['Positive', domain.sentiment.positive, 'text-primary'], ['Neutral', domain.sentiment.neutral, 'text-chart-2'], ['Negative', domain.sentiment.negative, 'text-destructive']].map(([label, value, tone]) => <div key={String(label)} className="flex items-center justify-between py-4 first:pt-0 last:pb-0"><span className="text-sm text-muted-foreground">{label}</span><span className={`text-xl font-semibold ${tone}`}>{formatPercent(Number(value))}</span></div>)}</div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5"><SectionHeading title="Share of Conversation" description="Tracked conversation share by brand" /><NamedBarChart data={domain.shareOfConversation} valueFormatter={formatPercent} /></section>
        <section className="surface min-w-0 p-5"><SectionHeading title="Competitive Watch" description="Share of voice by tracked competitor" /><HorizontalBarChart data={domain.competitors.filter((item) => item.shareOfVoice !== null).map((item) => ({ name: item.competitor, value: item.shareOfVoice ?? 0 }))} valueFormatter={formatPercent} /></section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Competitive Watch Detail" description="Threat level, activity, and recommended response" /></div>
        <Table><TableHeader><TableRow><TableHead>Competitor</TableHead><TableHead>Brand</TableHead><TableHead>Threat</TableHead><TableHead className="text-right">Share of voice</TableHead><TableHead>Activity</TableHead><TableHead>Recommended response</TableHead></TableRow></TableHeader><TableBody>{domain.competitors.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.competitor}</TableCell><TableCell>{item.brandName ?? 'Group'}</TableCell><TableCell><StatusBadge value={item.threatLevel} /></TableCell><TableCell className="text-right">{item.shareOfVoice === null ? 'No data' : formatPercent(item.shareOfVoice)}</TableCell><TableCell className="max-w-64 truncate text-muted-foreground">{item.description}</TableCell><TableCell className="max-w-64 truncate">{item.recommendedResponse ?? 'Not recorded'}</TableCell></TableRow>)}</TableBody></Table>
      </section>

      <section className="surface p-5">
        <SectionHeading title="Digital Reputation & Social" description="Latest review, response, and audience signals" />
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-4 xl:grid-cols-8">
          {[['Google rating', domain.digitalReputation.googleRating?.toFixed(2) ?? 'No data'], ['Google reviews', formatNumber(domain.digitalReputation.googleReviews)], ['Trustpilot', domain.digitalReputation.trustpilotRating?.toFixed(2) ?? 'No data'], ['Response rate', domain.digitalReputation.responseRate === null ? 'No data' : formatPercent(domain.digitalReputation.responseRate)], ['NPS', domain.digitalReputation.nps?.toFixed(0) ?? 'No data'], ['Followers', formatNumber(domain.digitalReputation.followers, true)], ['New reviews', formatNumber(domain.digitalReputation.newReviews)], ['Negative reviews', formatNumber(domain.digitalReputation.negativeReviews)]].map(([label, value]) => <div key={label}><p className="data-label">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface p-5"><SectionHeading title="Risks" description="Current brand risks requiring mitigation" /><div className="mt-4 divide-y">{domain.risks.map((item, index) => <div key={`${item.text}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/10 text-destructive"><ShieldAlert className="size-4" /></span><span className="min-w-0 flex-1 text-sm leading-5">{item.text}</span><StatusBadge value={item.tag} /></div>)}</div></section>
        <section className="surface p-5"><SectionHeading title="Opportunities" description="Brand-growth opportunities worth testing" /><div className="mt-4 divide-y">{domain.opportunities.map((item, index) => <div key={`${item.text}-${index}`} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Lightbulb className="size-4" /></span><span className="min-w-0 flex-1 text-sm leading-5">{item.text}</span><StatusBadge value={item.tag} /></div>)}</div></section>
      </div>

      <section className="surface p-5">
        <SectionHeading title="CEO Attention & Recent Entries" description="Brand decisions and escalations requiring leadership follow-through" />
        <div className="mt-4 grid gap-x-6 md:grid-cols-2">{domain.attention.map((item) => <div key={item.id} className="flex gap-3 border-b py-3 first:pt-0 md:[&:nth-last-child(-n+2)]:border-b-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/10 text-destructive"><ShieldAlert className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.ownerName} / {item.dueDate ?? 'No due date'}</span></span><StatusBadge value={item.priority} /></div>)}</div>
      </section>
    </div>
  );
}
