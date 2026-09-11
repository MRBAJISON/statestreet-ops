'use client';

import CustomerTransactionsReview from '@/components/forms/CustomerTransactionsReview';
import { useOrg } from '@/components/providers/OrgProvider';

export default function FinanceCustomerTransactionsPage() {
  const { org } = useOrg();
  return <CustomerTransactionsReview currency={org.currency} backHref="/forms/finance" title="Customer transaction approvals" allowCreditPayments />;
}
