import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PROTOTYPE_NO_LOGIN, RESTAURANT_NAME, RESTAURANT_TAGLINE } from "@/config";
import { can, isAdmin, ROLE_LABEL, type Permission } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission?: Permission;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/orders", label: "Orders", icon: "🧾", permission: "orders.view" },
  { to: "/kitchen", label: "Kitchen Screen", icon: "👨‍🍳", permission: "orders.view" },
  { to: "/tables", label: "Tables", icon: "🪑", permission: "tables.view" },
  { to: "/menu", label: "Menu", icon: "🍗", permission: "menu.view" },
  { to: "/categories", label: "Categories", icon: "🗂️", permission: "menu.manage" },
  { to: "/payments", label: "Payments", icon: "💳", permission: "payments.view" },
  { to: "/staff", label: "Staff & Roles", icon: "👥", permission: "staff.manage", adminOnly: true },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin(user)) return false;
    if (item.permission && !can(user, item.permission)) return false;
    return true;
  });

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  const initials = (user?.name ?? user?.username ?? "G")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-full">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-stone-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-stone-200 bg-brand-600 px-4 py-4 text-white">
            <p className="text-sm font-extrabold leading-tight">The Chinu Family</p>
            <p className="text-xs font-medium text-brand-100">Restaurant &amp; Dhaba</p>
            <p className="mt-2 rounded-md bg-brand-700/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">
              Admin Dashboard
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  }`
                }
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-stone-200 p-3">
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-stone-50 p-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-800">
                  {user?.name ?? user?.username}
                </p>
                <p className="truncate text-xs text-stone-500">
                  {ROLE_LABEL[user?.role ?? "employee"]}
                </p>
              </div>
            </div>
            {!PROTOTYPE_NO_LOGIN && (
              <button type="button" onClick={handleSignOut} className="btn-ghost w-full">
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-stone-900/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="btn-ghost px-2 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-800">
              {RESTAURANT_NAME}
            </p>
            <p className="truncate text-xs text-stone-500">{RESTAURANT_TAGLINE}</p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 sm:inline">
            {ROLE_LABEL[user?.role ?? "employee"]}
          </span>
        </header>

        <main key={location.pathname} className="flex-1 animate-slide-in p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
