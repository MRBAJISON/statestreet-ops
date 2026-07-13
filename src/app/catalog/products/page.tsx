import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { canReadUnitCost } from '@/lib/access';
import { getOrgSettings } from '@/lib/org-server';
import ProductsClient from './ProductsClient';

const PRODUCT_EDITORS = new Set(['owner', 'commercial', 'operations', 'inventory']);

export default async function ProductsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!PRODUCT_EDITORS.has(session.user.role)) redirect('/dashboard');
  const organization = await getOrgSettings();
  return <ProductsClient currency={organization.currency} canReadCost={canReadUnitCost(session.user.role)} />;
}
