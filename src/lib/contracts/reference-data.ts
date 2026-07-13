export interface ReferenceOption {
  id: number;
  code: string;
  name: string;
}

export interface ReferenceDataResponse {
  organization: { name: string; currency: string; weekStart: string };
  capabilities: { canDecideWeeklyReviews: boolean };
  stores: Array<ReferenceOption & { type: string }>;
  assignedStore: (ReferenceOption & { type: string }) | null;
  brands: ReferenceOption[];
  categories: ReferenceOption[];
  subcategories: Array<ReferenceOption & { categoryId: number }>;
  brandStores: Array<{ brandId: number; storeId: number }>;
  brandCategories: Array<{ brandId: number; categoryId: number }>;
  paymentMethods: ReferenceOption[];
  expenseCategories: Array<ReferenceOption & { group: string }>;
  suppliers: ReferenceOption[];
  cashAccounts: Array<ReferenceOption & { type: string }>;
  users: Array<{ id: number; name: string; role: string; store: string | null }>;
}
