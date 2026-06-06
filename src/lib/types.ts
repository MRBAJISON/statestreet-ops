export type Department =
  | 'executive'
  | 'finance'
  | 'commercial'
  | 'marketing'
  | 'operations'
  | 'inventory'
  | 'brand';

export type UserRole =
  | 'owner'
  | 'finance'
  | 'commercial'
  | 'marketing'
  | 'operations'
  | 'inventory'
  | 'brand';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: Department;
}
