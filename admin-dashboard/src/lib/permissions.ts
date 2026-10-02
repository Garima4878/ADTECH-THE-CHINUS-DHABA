import type { Role, User } from "@/types";

export type Permission =
  | "orders.view"
  | "orders.update"
  | "orders.cancel"
  | "menu.view"
  | "menu.manage"
  | "categories.manage"
  | "tables.view"
  | "tables.manage"
  | "payments.view"
  | "staff.manage";

const ALL: Permission[] = [
  "orders.view",
  "orders.update",
  "orders.cancel",
  "menu.view",
  "menu.manage",
  "categories.manage",
  "tables.view",
  "tables.manage",
  "payments.view",
  "staff.manage",
];

/** Admin = full control. Manager = runs the floor. Employee = kitchen/hall staff. */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL,
  manager: [
    "orders.view",
    "orders.update",
    "orders.cancel",
    "menu.view",
    "menu.manage",
    "categories.manage",
    "tables.view",
    "tables.manage",
    "payments.view",
  ],
  employee: ["orders.view", "orders.update", "menu.view", "tables.view"],
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  manager: "Manager",
  employee: "Restaurant Employee",
};

export function permissionsFor(role?: Role | string): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as Role] ?? ROLE_PERMISSIONS.employee;
}

export function can(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return permissionsFor(user.role).includes(permission);
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin";
}
