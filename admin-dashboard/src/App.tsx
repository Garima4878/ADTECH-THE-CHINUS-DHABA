import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { can, isAdmin, type Permission } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import KitchenPage from "@/pages/KitchenPage";
import TablesPage from "@/pages/TablesPage";
import MenuPage from "@/pages/MenuPage";
import CategoriesPage from "@/pages/CategoriesPage";
import PaymentsPage from "@/pages/PaymentsPage";
import StaffPage from "@/pages/StaffPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function RequirePermission({
  permission,
  adminOnly,
  children,
}: {
  permission?: Permission;
  adminOnly?: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (adminOnly && !isAdmin(user)) return <Navigate to="/dashboard" replace />;
  if (permission && !can(user, permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/orders"
          element={
            <RequirePermission permission="orders.view">
              <OrdersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequirePermission permission="orders.view">
              <OrderDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/kitchen"
          element={
            <RequirePermission permission="orders.view">
              <KitchenPage />
            </RequirePermission>
          }
        />
        <Route
          path="/tables"
          element={
            <RequirePermission permission="tables.view">
              <TablesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/menu"
          element={
            <RequirePermission permission="menu.view">
              <MenuPage />
            </RequirePermission>
          }
        />
        <Route
          path="/categories"
          element={
            <RequirePermission permission="categories.manage">
              <CategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/payments"
          element={
            <RequirePermission permission="payments.view">
              <PaymentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/staff"
          element={
            <RequirePermission adminOnly>
              <StaffPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
