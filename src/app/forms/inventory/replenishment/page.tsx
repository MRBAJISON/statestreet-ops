import { InventoryDocumentForm } from '@/components/forms/InventoryDocumentForm';

export default function ReplenishmentPage() {
  return <InventoryDocumentForm document="replenishment" backHref="/forms/inventory" />;
}
