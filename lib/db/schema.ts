import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const productFamilyEnum = pgEnum("product_family", ["oils", "relief", "home"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);

export const userRoleEnum = pgEnum("user_role", ["owner", "manager", "staff"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const productStatusEnum = pgEnum("product_status", ["active", "draft", "archived"]);
export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "recount",
  "damaged",
  "received",
  "correction",
  "theft",
  "sale",
  "restock",
  "order_edit",
]);
export const collectionTypeEnum = pgEnum("collection_type", ["manual", "automatic"]);
export const ruleMatchEnum = pgEnum("rule_match", ["all", "any"]);
export const discountMethodEnum = pgEnum("discount_method", ["code", "automatic"]);
export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed_amount",
  "free_delivery",
  "buy_x_get_y",
]);
export const discountAppliesToEnum = pgEnum("discount_applies_to", ["order", "products", "collections"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published"]);
export const metafieldTypeEnum = pgEnum("metafield_type", ["text", "number", "rich_text", "boolean", "file"]);
export const orderEventTypeEnum = pgEnum("order_event_type", [
  "created",
  "status",
  "note",
  "edit",
  "tag",
  "discount",
  "customer",
]);
export const abandonedStatusEnum = pgEnum("abandoned_status", ["open", "recovered", "dismissed"]);
export const draftStatusEnum = pgEnum("draft_status", ["open", "completed", "cancelled"]);
export const menuHandleEnum = pgEnum("menu_handle", ["header", "footer"]);

export const ORDER_STATUSES = orderStatusEnum.enumValues;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const USER_ROLES = userRoleEnum.enumValues;
export type UserRole = (typeof USER_ROLES)[number];
export const PRODUCT_STATUSES = productStatusEnum.enumValues;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const INVENTORY_REASONS = inventoryReasonEnum.enumValues;
export type InventoryReason = (typeof INVENTORY_REASONS)[number];
export const DISCOUNT_TYPES = discountTypeEnum.enumValues;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const METAFIELD_TYPES = metafieldTypeEnum.enumValues;
export type MetafieldType = (typeof METAFIELD_TYPES)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------ staff / auth */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    status: userStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdById: uuid("created_by_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.status),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_sessions_token_idx").on(t.tokenHash),
    index("user_sessions_user_idx").on(t.userId),
    index("user_sessions_expires_idx").on(t.expiresAt),
  ],
);

/** One row per failed sign-in. Drives per-email and per-IP lockout. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    scope: text("scope").notNull(), // "email:foo@bar" or "ip:1.2.3.4"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_attempts_scope_idx").on(t.scope, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userEmail: text("user_email").notNull().default(""),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    entityLabel: text("entity_label"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
  ],
);

/** Per-user (or shared, when userId is null) saved list filters. */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(), // "orders" | "products" | "customers"
    name: text("name").notNull(),
    query: text("query").notNull().default(""),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("saved_views_resource_idx").on(t.resource, t.userId)],
);

/* ------------------------------------------------------------------ media */

export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    url: text("url").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull().default("image/webp"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("media_files_url_idx").on(t.url), index("media_files_created_idx").on(t.createdAt)],
);

/* --------------------------------------------------------------- products */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    family: productFamilyEnum("family").notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description").notNull(),
    howToUse: text("how_to_use").array().notNull().default(sql`'{}'::text[]`),
    ingredients: text("ingredients").notNull().default(""),
    benefits: text("benefits").array().notNull().default(sql`'{}'::text[]`),
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    isBestseller: boolean("is_bestseller").notNull().default(false),
    /** Legacy mirror of status === "archived". Kept in sync on every write. */
    isArchived: boolean("is_archived").notNull().default(false),
    status: productStatusEnum("status").notNull().default("active"),
    productType: text("product_type").notNull().default(""),
    vendor: text("vendor").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_family_idx").on(t.family),
    index("products_status_idx").on(t.status),
    index("products_type_idx").on(t.productType),
    index("products_vendor_idx").on(t.vendor),
    index("products_name_idx").on(t.name),
    index("products_deleted_idx").on(t.deletedAt),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    label: text("label").notNull(),
    barcode: text("barcode").notNull().default(""),
    pricePaisa: integer("price_paisa").notNull(),
    compareAtPaisa: integer("compare_at_paisa"),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("product_variants_sku_idx").on(t.sku),
    index("product_variants_product_idx").on(t.productId),
    index("product_variants_stock_idx").on(t.stock),
  ],
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    resultingStock: integer("resulting_stock").notNull(),
    reason: inventoryReasonEnum("reason").notNull(),
    note: text("note").notNull().default(""),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("order_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("inventory_adjustments_variant_idx").on(t.variantId, t.createdAt),
    index("inventory_adjustments_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------ collections */

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    type: collectionTypeEnum("type").notNull().default("manual"),
    rulesMatch: ruleMatchEnum("rules_match").notNull().default("all"),
    /** [{ field, operator, value }] — see lib/collections-rules.ts */
    rules: jsonb("rules").notNull().default(sql`'[]'::jsonb`),
    image: text("image").notNull().default(""),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("collections_slug_idx").on(t.slug), index("collections_type_idx").on(t.type)],
);

export const collectionProducts = pgTable(
  "collection_products",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("collection_products_pair_idx").on(t.collectionId, t.productId),
    index("collection_products_product_idx").on(t.productId),
  ],
);

/* ------------------------------------------------------------- metafields */

export const metafieldDefinitions = pgTable(
  "metafield_definitions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerType: text("owner_type").notNull().default("product"),
    key: text("key").notNull(),
    name: text("name").notNull(),
    type: metafieldTypeEnum("type").notNull().default("text"),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("metafield_definitions_key_idx").on(t.ownerType, t.key)],
);

export const metafieldValues = pgTable(
  "metafield_values",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => metafieldDefinitions.id, { onDelete: "cascade" }),
    ownerType: text("owner_type").notNull().default("product"),
    ownerId: uuid("owner_id").notNull(),
    value: text("value").notNull().default(""),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("metafield_values_owner_idx").on(t.definitionId, t.ownerId),
    index("metafield_values_owner_lookup_idx").on(t.ownerType, t.ownerId),
  ],
);

/* -------------------------------------------------------------- customers */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** Normalised +92XXXXXXXXXX. The identity key for a COD store. */
    phone: text("phone").notNull(),
    name: text("name").notNull().default(""),
    email: text("email"),
    city: text("city").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    internalNote: text("internal_note").notNull().default(""),
    /* Denormalised aggregates, refreshed inside every order transaction. */
    ordersCount: integer("orders_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    cancelledCount: integer("cancelled_count").notNull().default(0),
    returnedCount: integer("returned_count").notNull().default(0),
    totalSpentPaisa: integer("total_spent_paisa").notNull().default(0),
    avgOrderPaisa: integer("avg_order_paisa").notNull().default(0),
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    /** Set when this record was merged into another; keeps history intact. */
    mergedIntoId: uuid("merged_into_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customers_phone_idx").on(t.phone),
    index("customers_name_idx").on(t.name),
    index("customers_city_idx").on(t.city),
    index("customers_spent_idx").on(t.totalSpentPaisa),
    index("customers_last_order_idx").on(t.lastOrderAt),
    index("customers_orders_count_idx").on(t.ordersCount),
  ],
);

export const customerSegments = pgTable(
  "customer_segments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rulesMatch: ruleMatchEnum("rules_match").notNull().default("all"),
    rules: jsonb("rules").notNull().default(sql`'[]'::jsonb`),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("customer_segments_name_idx").on(t.name)],
);

/* ----------------------------------------------------------------- orders */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderNumber: text("order_number").notNull(),
    status: orderStatusEnum("status").notNull().default("pending"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    altPhone: text("alt_phone"),
    city: text("city").notNull(),
    address: text("address").notNull(),
    notes: text("notes"),
    internalNote: text("internal_note"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    subtotalPaisa: integer("subtotal_paisa").notNull(),
    discountPaisa: integer("discount_paisa").notNull().default(0),
    discountCode: text("discount_code"),
    discountId: uuid("discount_id"),
    deliveryPaisa: integer("delivery_paisa").notNull(),
    totalPaisa: integer("total_paisa").notNull(),
    itemCount: integer("item_count").notNull().default(0),
    /** Staff member who last changed anything on this order. */
    lastActorId: uuid("last_actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Set when the order was created from a draft. */
    draftOrderId: uuid("draft_order_id"),
    cancelReason: text("cancel_reason"),
    returnReason: text("return_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("orders_order_number_idx").on(t.orderNumber),
    index("orders_phone_idx").on(t.phone),
    index("orders_created_at_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_customer_idx").on(t.customerId),
    index("orders_city_idx").on(t.city),
    index("orders_total_idx").on(t.totalPaisa),
    index("orders_last_actor_idx").on(t.lastActorId),
    index("orders_deleted_idx").on(t.deletedAt),
    index("orders_status_created_idx").on(t.status, t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productSlug: text("product_slug").notNull(),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    sku: text("sku").notNull(),
    unitPricePaisa: integer("unit_price_paisa").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalPaisa: integer("line_total_paisa").notNull(),
    /** Manual per-line discount applied by staff while editing. */
    discountPaisa: integer("discount_paisa").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_variant_idx").on(t.variantId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: orderEventTypeEnum("type").notNull().default("status"),
    fromStatus: orderStatusEnum("from_status"),
    /** Null for non-status events (notes, edits, tag changes). */
    toStatus: orderStatusEnum("to_status"),
    message: text("message"),
    note: text("note"),
    meta: jsonb("meta"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

/* ----------------------------------------------------------- draft orders */

export const draftOrders = pgTable(
  "draft_orders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().default(""),
    status: draftStatusEnum("status").notNull().default("open"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    altPhone: text("alt_phone"),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    notes: text("notes"),
    internalNote: text("internal_note"),
    subtotalPaisa: integer("subtotal_paisa").notNull().default(0),
    discountPaisa: integer("discount_paisa").notNull().default(0),
    discountReason: text("discount_reason"),
    deliveryPaisa: integer("delivery_paisa").notNull().default(0),
    totalPaisa: integer("total_paisa").notNull().default(0),
    convertedOrderId: uuid("converted_order_id").references(() => orders.id, { onDelete: "set null" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("draft_orders_status_idx").on(t.status, t.createdAt), index("draft_orders_phone_idx").on(t.phone)],
);

export const draftOrderItems = pgTable(
  "draft_order_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    draftOrderId: uuid("draft_order_id")
      .notNull()
      .references(() => draftOrders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    productSlug: text("product_slug").notNull().default(""),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    sku: text("sku").notNull().default(""),
    unitPricePaisa: integer("unit_price_paisa").notNull(),
    quantity: integer("quantity").notNull().default(1),
    lineTotalPaisa: integer("line_total_paisa").notNull(),
  },
  (t) => [index("draft_order_items_draft_idx").on(t.draftOrderId)],
);

/* ---------------------------------------------------- abandoned checkouts */

export const abandonedCheckouts = pgTable(
  "abandoned_checkouts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    /** Client-generated key so repeated keystrokes update one row. */
    sessionKey: text("session_key").notNull(),
    name: text("name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    /** [{ variantId, productName, variantLabel, sku, unitPricePaisa, quantity }] */
    cart: jsonb("cart").notNull().default(sql`'[]'::jsonb`),
    itemCount: integer("item_count").notNull().default(0),
    subtotalPaisa: integer("subtotal_paisa").notNull().default(0),
    status: abandonedStatusEnum("status").notNull().default("open"),
    recoveredOrderId: uuid("recovered_order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("abandoned_checkouts_session_idx").on(t.sessionKey),
    index("abandoned_checkouts_status_idx").on(t.status, t.createdAt),
    index("abandoned_checkouts_phone_idx").on(t.phone),
  ],
);

/* -------------------------------------------------------------- discounts */

export const discounts = pgTable(
  "discounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    /** Uppercase. Null for automatic discounts. */
    code: text("code"),
    method: discountMethodEnum("method").notNull().default("code"),
    type: discountTypeEnum("type").notNull().default("percentage"),
    /** percentage: basis points (1000 = 10%). fixed_amount: paisa. */
    value: integer("value").notNull().default(0),
    appliesTo: discountAppliesToEnum("applies_to").notNull().default("order"),
    minSubtotalPaisa: integer("min_subtotal_paisa").notNull().default(0),
    minQuantity: integer("min_quantity").notNull().default(0),
    firstTimeOnly: boolean("first_time_only").notNull().default(false),
    segmentId: uuid("segment_id").references(() => customerSegments.id, { onDelete: "set null" }),
    usageLimit: integer("usage_limit"),
    oncePerCustomer: boolean("once_per_customer").notNull().default(false),
    /** buy_x_get_y only. */
    buyQuantity: integer("buy_quantity").notNull().default(0),
    getQuantity: integer("get_quantity").notNull().default(0),
    getDiscountBp: integer("get_discount_bp").notNull().default(10000), // 100% = free
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    usageCount: integer("usage_count").notNull().default(0),
    revenuePaisa: integer("revenue_paisa").notNull().default(0),
    discountedPaisa: integer("discounted_paisa").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("discounts_code_idx").on(t.code),
    index("discounts_method_idx").on(t.method),
    index("discounts_enabled_idx").on(t.isEnabled, t.startsAt),
  ],
);

export const discountTargets = pgTable(
  "discount_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    /** "applies" | "buy" | "get" */
    role: text("role").notNull().default("applies"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "cascade" }),
  },
  (t) => [index("discount_targets_discount_idx").on(t.discountId)],
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discounts.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    phone: text("phone").notNull().default(""),
    amountPaisa: integer("amount_paisa").notNull().default(0),
    orderTotalPaisa: integer("order_total_paisa").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discount_redemptions_discount_idx").on(t.discountId),
    index("discount_redemptions_phone_idx").on(t.discountId, t.phone),
  ],
);

/* ---------------------------------------------------------------- content */

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    status: contentStatusEnum("status").notNull().default("draft"),
    /** Reserved pages back a fixed storefront route and cannot be deleted. */
    isSystem: boolean("is_system").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("pages_slug_idx").on(t.slug), index("pages_status_idx").on(t.status)],
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    body: text("body").notNull().default(""),
    coverImage: text("cover_image").notNull().default(""),
    authorName: text("author_name").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    status: contentStatusEnum("status").notNull().default("draft"),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("blog_posts_slug_idx").on(t.slug),
    index("blog_posts_published_idx").on(t.status, t.publishedAt),
  ],
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    handle: menuHandleEnum("handle").notNull(),
    title: text("title").notNull().default(""),
    ...timestamps,
  },
  (t) => [uniqueIndex("menus_handle_idx").on(t.handle)],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    label: text("label").notNull(),
    url: text("url").notNull().default("/"),
    /** "custom" | "collection" | "product" | "page" */
    resourceType: text("resource_type").notNull().default("custom"),
    resourceId: text("resource_id"),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("menu_items_menu_idx").on(t.menuId, t.position)],
);

/* --------------------------------------------------------------- settings */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    name: text("name").notNull(),
    channel: text("channel").notNull().default("whatsapp"),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    isEnabled: boolean("is_enabled").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("notification_templates_key_idx").on(t.key)],
);

/* ------------------------------------------------------- legacy (kept) */

/** Superseded by user_sessions. Left in place so old deployments keep working. */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_sessions_token_idx").on(t.tokenHash)],
);

/* -------------------------------------------------------------- relations */

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  collectionLinks: many(collectionProducts),
}));
export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  adjustments: many(inventoryAdjustments),
}));
export const inventoryAdjustmentsRelations = relations(inventoryAdjustments, ({ one }) => ({
  variant: one(productVariants, {
    fields: [inventoryAdjustments.variantId],
    references: [productVariants.id],
  }),
  user: one(users, { fields: [inventoryAdjustments.userId], references: [users.id] }),
}));
export const collectionsRelations = relations(collections, ({ many }) => ({
  productLinks: many(collectionProducts),
}));
export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionProducts.collectionId],
    references: [collections.id],
  }),
  product: one(products, { fields: [collectionProducts.productId], references: [products.id] }),
}));
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  events: many(orderEvents),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  lastActor: one(users, { fields: [orders.lastActorId], references: [users.id] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
  user: one(users, { fields: [orderEvents.userId], references: [users.id] }),
}));
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));
export const draftOrdersRelations = relations(draftOrders, ({ many, one }) => ({
  items: many(draftOrderItems),
  customer: one(customers, { fields: [draftOrders.customerId], references: [customers.id] }),
}));
export const draftOrderItemsRelations = relations(draftOrderItems, ({ one }) => ({
  draft: one(draftOrders, { fields: [draftOrderItems.draftOrderId], references: [draftOrders.id] }),
}));
export const discountsRelations = relations(discounts, ({ many }) => ({
  targets: many(discountTargets),
  redemptions: many(discountRedemptions),
}));
export const discountTargetsRelations = relations(discountTargets, ({ one }) => ({
  discount: one(discounts, { fields: [discountTargets.discountId], references: [discounts.id] }),
}));
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
}));
export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, { fields: [userSessions.userId], references: [users.id] }),
}));
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));
export const menusRelations = relations(menus, ({ many }) => ({ items: many(menuItems) }));
export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  menu: one(menus, { fields: [menuItems.menuId], references: [menus.id] }),
}));
export const metafieldValuesRelations = relations(metafieldValues, ({ one }) => ({
  definition: one(metafieldDefinitions, {
    fields: [metafieldValues.definitionId],
    references: [metafieldDefinitions.id],
  }),
}));

/* ------------------------------------------------------------------ types */

export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type ProductWithVariants = Product & { variants: ProductVariant[] };
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Collection = typeof collections.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type DiscountTarget = typeof discountTargets.$inferSelect;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type DraftOrder = typeof draftOrders.$inferSelect;
export type DraftOrderItem = typeof draftOrderItems.$inferSelect;
export type AbandonedCheckout = typeof abandonedCheckouts.$inferSelect;
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;
export type CustomerSegment = typeof customerSegments.$inferSelect;
export type MetafieldDefinition = typeof metafieldDefinitions.$inferSelect;
export type MetafieldValue = typeof metafieldValues.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type SavedView = typeof savedViews.$inferSelect;
