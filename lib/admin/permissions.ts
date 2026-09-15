import type { UserRole } from "@/lib/db/schema";

/**
 * The permission matrix. Every Server Action names one of these, and
 * requirePermission() checks it against the signed-in user's role, so hiding a
 * button is never the thing that keeps someone out.
 */
export const PERMISSIONS = [
  "orders:read",
  "orders:write", // status, tags, internal notes
  "orders:edit", // line items, manual discount, delivery fee
  "orders:export",
  "drafts:read",
  "drafts:write",
  "abandoned:read",
  "abandoned:write",
  "products:read",
  "products:write",
  "collections:read",
  "collections:write",
  "inventory:read",
  "inventory:write",
  "files:read",
  "files:write",
  "customers:read",
  "customers:write",
  "discounts:read",
  "discounts:write",
  "content:read",
  "content:write",
  "reviews:read",
  "reviews:write",
  "analytics:read",
  "settings:read",
  "settings:write",
  "staff:read",
  "staff:write",
  "activity:read",
  // Owner only: credentials, dry-run switches and the job queue.
  "integrations:read",
  "integrations:write",
  "jobs:read",
  "jobs:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER: Permission[] = [
  "orders:read",
  "orders:write",
  "orders:edit",
  "orders:export",
  "drafts:read",
  "drafts:write",
  "abandoned:read",
  "abandoned:write",
  "products:read",
  "products:write",
  "collections:read",
  "collections:write",
  "inventory:read",
  "inventory:write",
  "files:read",
  "files:write",
  "customers:read",
  "customers:write",
  "discounts:read",
  "discounts:write",
  "content:read",
  "content:write",
  "reviews:read",
  "reviews:write",
  "analytics:read",
  "activity:read",
];

/** Orders and customers only; products are read-only. */
const STAFF: Permission[] = [
  "orders:read",
  "orders:write",
  "orders:export",
  "drafts:read",
  "abandoned:read",
  "abandoned:write",
  "products:read",
  "collections:read",
  "inventory:read",
  "files:read",
  "customers:read",
  "customers:write",
  "reviews:read",
  "reviews:write",
];

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  owner: new Set(PERMISSIONS),
  manager: new Set(MANAGER),
  staff: new Set(STAFF),
};

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_BLURB: Record<UserRole, string> = {
  owner: "Everything, including staff and settings.",
  manager: "Orders, products, customers, discounts and content. No settings or staff.",
  staff: "Orders and customers. Products are read-only.",
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Any of — used for nav visibility where a section has several actions. */
export function canAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}
