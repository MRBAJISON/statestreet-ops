import { BadgeDollarSign, ContactRound, Megaphone, MessageSquareText, MousePointerClick, Radio, UsersRound } from 'lucide-react';
import { ShowMoreButton } from '@/components/ui/show-more-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useExpandable } from '@/hooks/use-expandable';
import type { AnalyticsMeta, MarketingDomain } from '@/lib/contracts/analytics';
import { EmptyPanel, EmptyTableRow, MetricRail, SectionHeading, StatusBadge } from './DashboardPrimitives';
import { ComparisonBarChart, HorizontalBarChart, NamedBarChart } from './Charts';
import { formatCurrency, formatNumber, formatPercent } from './format';

export function MarketingOverview({ meta, domain }: { meta: AnalyticsMeta; domain: MarketingDomain }) {
  const funnel = domain.leadChannels.length || domain.campaigns.length ? [
    { name: 'Reach', value: domain.funnel.reach },
    { name: 'Engagement', value: domain.funnel.engagement },
    { name: 'Leads', value: domain.funnel.leads },
    { name: 'Store visits', value: domain.funnel.storeVisits },
  ] : [];

  const leadChannels = useExpandable(domain.leadChannels);
  const campaigns = useExpandable(domain.campaigns);
  const social = useExpandable(domain.social);
  const feedbackDetail = useExpandable(domain.feedbackDetail);
  const actions = useExpandable(domain.actions);

  return (
    <div className="flex flex-col gap-5">
      <MetricRail items={[
        { label: 'Campaign spend', value: formatCurrency(domain.summary.spend, meta.currency), detail: 'Selected period', icon: BadgeDollarSign, tone: 'coral' },
        { label: 'Influenced revenue', value: formatCurrency(domain.summary.influencedRevenue, meta.currency), detail: `${domain.summary.roas.toFixed(1)}x ROAS`, icon: Megaphone, tone: 'blue' },
        { label: 'Leads', value: formatNumber(domain.summary.leads), detail: `${formatNumber(domain.summary.qualified)} qualified`, icon: ContactRound, tone: 'teal' },
        { label: 'Conversions', value: formatNumber(domain.summary.converted), detail: `${formatCurrency(domain.summary.costPerLead, meta.currency)} per lead`, icon: MousePointerClick, tone: 'green' },
        { label: 'Customer NPS', value: domain.summary.nps === null ? 'No score' : domain.summary.nps.toFixed(0), detail: 'Captured feedback', icon: UsersRound, tone: 'amber' },
      ]} className="2xl:grid-cols-5" />

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface min-w-0 p-5 xl:col-span-5">
          <SectionHeading title="Lead Generation" description="Reach, engagement, leads, and store visits" />
          <HorizontalBarChart data={funnel} />
          <div className="mt-3 border-t pt-3"><p className="data-label">Revenue influenced</p><p className="mt-1 text-lg font-semibold">{formatCurrency(domain.funnel.revenueInfluenced, meta.currency)}</p></div>
        </section>
        <section className="surface min-w-0 overflow-hidden xl:col-span-7">
          <div className="p-5 pb-3"><SectionHeading title="Lead Qualification" description="Total leads to qualified opportunities to conversions" /></div>
          <Table>
            <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Qualified</TableHead><TableHead className="text-right">Converted</TableHead><TableHead className="text-right">Conversion</TableHead></TableRow></TableHeader>
            <TableBody>{domain.leadChannels.length ? leadChannels.visible.map((channel) => <TableRow key={channel.name}><TableCell className="font-medium">{channel.name}</TableCell><TableCell className="text-right">{formatNumber(channel.leads)}</TableCell><TableCell className="text-right">{formatNumber(channel.qualified)}</TableCell><TableCell className="text-right">{formatNumber(channel.converted)}</TableCell><TableCell className="text-right font-semibold">{formatPercent(channel.leads ? (channel.converted / channel.leads) * 100 : 0)}</TableCell></TableRow>) : <EmptyTableRow colSpan={5} message="No lead activity has been submitted for this period" />}</TableBody>
          </Table>
          <ShowMoreButton expanded={leadChannels.expanded} hiddenCount={leadChannels.hiddenCount} canExpand={leadChannels.canExpand} onClick={leadChannels.toggle} />
          <div className="grid grid-cols-3 border-t px-5 py-4 text-center"><div><p className="text-lg font-semibold">{domain.contentCadence.posts}</p><p className="data-label">Posts</p></div><div><p className="text-lg font-semibold">{domain.contentCadence.reels}</p><p className="data-label">Reels</p></div><div><p className="text-lg font-semibold">{domain.contentCadence.stories}</p><p className="data-label">Stories</p></div></div>
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Campaign Performance" description="Spend, influenced revenue, reach, engagement, and return" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Platform</TableHead><TableHead className="text-right">Spend</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Reach</TableHead><TableHead className="text-right">Engagement</TableHead><TableHead className="text-right">ROAS</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{domain.campaigns.length ? campaigns.visible.map((campaign) => <TableRow key={campaign.id}><TableCell><span className="block max-w-48 truncate font-medium">{campaign.name}</span><span className="text-xs text-muted-foreground">{campaign.brandName}</span></TableCell><TableCell className="capitalize text-muted-foreground">{campaign.platform}</TableCell><TableCell className="text-right">{formatCurrency(campaign.spend, meta.currency)}</TableCell><TableCell className="text-right font-medium">{formatCurrency(campaign.revenue, meta.currency)}</TableCell><TableCell className="text-right">{formatNumber(campaign.reach, true)}</TableCell><TableCell className="text-right">{formatPercent(campaign.engagementRate)}</TableCell><TableCell className="text-right font-semibold text-primary">{campaign.roas.toFixed(1)}x</TableCell><TableCell><StatusBadge value={campaign.status} /></TableCell></TableRow>) : <EmptyTableRow colSpan={8} message="No campaign performance has been submitted for this period" />}</TableBody>
        </Table>
        <ShowMoreButton expanded={campaigns.expanded} hiddenCount={campaigns.hiddenCount} canExpand={campaigns.canExpand} onClick={campaigns.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Campaign Performance by Brand" description="Spend and influenced revenue across the portfolio" />
          <ComparisonBarChart data={domain.campaignBrands.map((brand) => ({ name: brand.name, primary: brand.revenue, secondary: brand.spend }))} primaryLabel="Revenue" secondaryLabel="Spend" valueFormatter={(value) => formatCurrency(value, meta.currency)} />
        </section>
        <section className="surface min-w-0 p-5">
          <SectionHeading title="Social Media by Channel" description="Reach across the active social portfolio" />
          <NamedBarChart data={domain.social.map((channel) => ({ name: channel.platform, value: channel.reach }))} />
        </section>
      </div>

      <section className="surface min-w-0 overflow-hidden">
        <div className="p-5 pb-3"><SectionHeading title="Social Media Detail" description="Reach, engagement, traffic, and latest audience position" /></div>
        <Table>
          <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead className="text-right">Reach</TableHead><TableHead className="text-right">Impressions</TableHead><TableHead className="text-right">Engagement</TableHead><TableHead className="text-right">Clicks</TableHead><TableHead className="text-right">Followers</TableHead><TableHead className="text-right">Website visits</TableHead></TableRow></TableHeader>
          <TableBody>{domain.social.length ? social.visible.map((channel) => <TableRow key={channel.platform}><TableCell className="font-medium capitalize"><span className="inline-flex items-center gap-2"><Radio className="size-4 text-chart-5" />{channel.platform}</span></TableCell><TableCell className="text-right">{formatNumber(channel.reach, true)}</TableCell><TableCell className="text-right">{formatNumber(channel.impressions, true)}</TableCell><TableCell className="text-right">{formatNumber(channel.engagement, true)}</TableCell><TableCell className="text-right">{formatNumber(channel.clicks, true)}</TableCell><TableCell className="text-right">{formatNumber(channel.followers, true)}</TableCell><TableCell className="text-right">{formatNumber(channel.websiteVisits, true)}</TableCell></TableRow>) : <EmptyTableRow colSpan={7} message="No social channel snapshots have been submitted" />}</TableBody>
        </Table>
        <ShowMoreButton expanded={social.expanded} hiddenCount={social.hiddenCount} canExpand={social.canExpand} onClick={social.toggle} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="surface min-w-0 overflow-hidden">
          <div className="p-5 pb-3"><SectionHeading title="Clienteling" description="Direct outreach, response, appointments, and revenue" /></div>
          <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead className="text-right">Contacted</TableHead><TableHead className="text-right">Responses</TableHead><TableHead className="text-right">Appointments</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader><TableBody>{domain.clienteling.length ? domain.clienteling.map((activity) => <TableRow key={activity.type}><TableCell className="font-medium capitalize">{activity.type}</TableCell><TableCell className="text-right">{activity.contacted}</TableCell><TableCell className="text-right">{activity.responses}</TableCell><TableCell className="text-right">{activity.appointments}</TableCell><TableCell className="text-right font-medium">{formatCurrency(activity.revenue, meta.currency)}</TableCell></TableRow>) : <EmptyTableRow colSpan={5} message="No clienteling activity has been submitted" />}</TableBody></Table>
        </section>
        <section className="surface p-5">
          <SectionHeading title="Customer Experience" description="Feedback themes and recurring customer signals" />
          {domain.feedbackDetail.length ? <><div className="mt-4 divide-y">{feedbackDetail.visible.map((item) => <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-5/10 text-chart-5"><MessageSquareText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium capitalize">{item.type} / {item.storeName ?? 'Group'}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span><span className="text-xs font-medium text-muted-foreground">{item.frequency ?? item.source}</span></div>)}</div><ShowMoreButton expanded={feedbackDetail.expanded} hiddenCount={feedbackDetail.hiddenCount} canExpand={feedbackDetail.canExpand} onClick={feedbackDetail.toggle} /></> : <EmptyPanel message="No customer feedback has been submitted" />}
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="surface p-5 xl:col-span-4">
          <SectionHeading title="Customer Insights" description="Captured audience attributes and interests" />
          <div className="mt-4 grid grid-cols-2 gap-3 border-b pb-4"><div><p className="data-label">Captured</p><p className="mt-1 text-xl font-semibold">{domain.customerInsights.captured}</p></div><div><p className="data-label">Buyers</p><p className="mt-1 text-xl font-semibold">{domain.customerInsights.buyers}</p></div></div>
          <div className="mt-4"><HorizontalBarChart data={domain.customerInsights.interests} /></div>
        </section>
        <section className="surface p-5 xl:col-span-8">
          <SectionHeading title="Action Tracker & Recent Entries" description="Open marketing commitments, owners, and deadlines" />
          {domain.actions.length ? <><div className="mt-4 divide-y">{actions.visible.map((item) => <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Megaphone className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.ownerName} / {item.storeName ?? 'Group'} / {item.dueDate ?? 'No due date'}</span></span><StatusBadge value={item.priority} /><StatusBadge value={item.status} /></div>)}</div><ShowMoreButton expanded={actions.expanded} hiddenCount={actions.hiddenCount} canExpand={actions.canExpand} onClick={actions.toggle} /></> : <EmptyPanel message="No marketing actions recorded" />}
        </section>
      </div>
    </div>
  );
}
