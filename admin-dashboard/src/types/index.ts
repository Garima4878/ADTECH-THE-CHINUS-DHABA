export type Role = "admin" | "manager" | "employee";

export type OrderStatus =
  | "Pending"
  | "Accepted"
  | "Preparing"
  | "Ready"
  | "Completed"
  | "Cancelled";

export type PaymentStatus = "Paid"  | "Unpaid" | "Refunded" | "Partial";

export type PaymentMethod = "Cash" | "Card" | "UPI" | "NetBanking" | "Wallet" | null;

export type TableStatus = "Free" | "Occupied" | "Reserved" | "Cleaning";

export type OrderType = "DineIn" | "Takeaway" | "Delivery";

export interface User {
  id: string;
  name: string;
  username: string;
  role: Role;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface OrderItem {
  id: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string | null;
}

export interface Payment {
  id: string;
  orderId?: string;
  orderNumber?: number | string;
  tableNumber?: string | null;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  paidAmount?: number;
  transactionId?: string | null;
  paidAt?: string | null;
}

export interface Order {
  id: string;
  orderNumber: number | string;
  tableId?: string | null;
  tableNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  orderType: OrderType;
  items: OrderItem[];
  totalAmount: number;
  discountAmount?: number;
  taxAmount?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payment?: Payment | null;
  placedAt: string;
  notes?: string | null;
  statusHistory?: { status: OrderStatus; at: string; by?: string }[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  sortOrder?: number;
  itemCount?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  categoryName?: string;
  imageUrl?: string | null;
  isVeg?: boolean;
  isAvailable: boolean;
  isSpicy?: boolean;
  sortOrder?: number;
}

export interface DiningTable {
  id: string;
  number: string;
  capacity: number;
  status: TableStatus;
  isActive: boolean;
  currentOrderId?: string | null;
}

export interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  unpaidAmount: number;
  occupiedTables: number;
  totalTables: number;
  lowStockItems?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
