'use client';

import CustomerTransactionsReview from '@/components/forms/CustomerTransactionsReview';
import { useOrg } from '@/components/providers/OrgProvider';

export default function CommercialCustomerTransactionsPage() {
  const { org } = useOrg();
  return <CustomerTransactionsReview currency={org.currency} backHref="/forms/commercial" title="Customer credit approvals" includeDeposits={false} />;
}
