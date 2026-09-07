'use client';

import CustomerTransactionsReview from '@/components/forms/CustomerTransactionsReview';
import { useOrg } from '@/components/providers/OrgProvider';

export default function InventoryCustomerTransactionsPage() {
  const { org } = useOrg();
  return <CustomerTransactionsReview currency={org.currency} backHref="/forms/inventory" title="Returned item stock decisions" inventoryMode />;
}
