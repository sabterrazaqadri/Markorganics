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
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const reviewSourceEnum = pgEnum("review_source", ["storefront", "admin"]);
export const expenseCategoryEnum = pgEnum("expense_category", ["ad_spend", "delivery", "other"]);

export const ORDER_STATUSES = orderStatusEnum.enumValues;
export const REVIEW_STATUSES = reviewStatusEnum.enumValues;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
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

/* ------------------------------------------------------------- json shapes */

export interface ProductFaq {
  q: string;
  a: string;
}

/** Urdu copy for one product. Any field left out falls back to English. */
export interface ProductI18nUr {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  howToUse?: string[];
  ingredients?: string;
  benefits?: string[];
  faqs?: ProductFaq[];
}

export interface ProductI18n {
  ur?: ProductI18nUr;
}

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
    /** Question and answer pairs shown in the PDP accordion and as FAQPage markup. */
    faqs: jsonb("faqs").$type<ProductFaq[]>().notNull().default(sql`'[]'::jsonb`),
    /**
     * Urdu copy for the product page. Every field is optional: whatever is
     * missing falls back to the English column, so a half-translated product
     * still renders.
     */
    i18n: jsonb("i18n").$type<ProductI18n>().notNull().default(sql`'{}'::jsonb`),
    /**
     * A bundle sells other products together at one price. Its variants carry
     * the price; bundle_components lists what ships. Stock is derived from the
     * components and the checkout deducts the components, never the bundle.
     */
    isBundle: boolean("is_bundle").notNull().default(false),
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
    /** Weighted-average cost per unit, moved by "received" inventory adjustments. Never touched by a sale. */
    avgCostPaisa: integer("avg_cost_paisa").notNull().default(0),
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

export const bundleComponents = pgTable(
  "bundle_components",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    bundleVariantId: uuid("bundle_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    componentVariantId: uuid("component_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("bundle_components_pair_idx").on(t.bundleVariantId, t.componentVariantId),
    index("bundle_components_component_idx").on(t.componentVariantId),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Set when the reviewer's phone matches a delivered order holding this product. */
    orderId: uuid("order_id"),
    customerName: text("customer_name").notNull(),
    /** E.164 without "+", normalised like orders.phone. Never shown publicly. */
    phone: text("phone"),
    city: text("city").notNull().default(""),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull(),
    lang: text("lang").notNull().default("en"),
    status: reviewStatusEnum("status").notNull().default("pending"),
    source: reviewSourceEnum("source").notNull().default("storefront"),
    isVerified: boolean("is_verified").notNull().default(false),
    reply: text("reply").notNull().default(""),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    ip: text("ip"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("reviews_product_status_idx").on(t.productId, t.status, t.createdAt),
    index("reviews_status_idx").on(t.status, t.createdAt),
    index("reviews_phone_idx").on(t.phone),
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
    /** Only ever set on a positive "received" delta; feeds the variant's weighted-average cost. */
    unitCostPaisa: integer("unit_cost_paisa"),
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

/**
 * Manual costs with no automated source in this app: ad spend and courier
 * charges are neither purchased through nor billed by anything the app talks
 * to yet, so someone types them in here. The analytics report sums whatever
 * falls inside the selected date range into the Net Profit line.
 */
export const expenseEntries = pgTable(
  "expense_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    category: expenseCategoryEnum("category").notNull(),
    amountPaisa: integer("amount_paisa").notNull(),
    occurredOn: timestamp("occurred_on", { withTimezone: true }).notNull(),
    note: text("note").notNull().default(""),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expense_entries_occurred_idx").on(t.occurredOn)],
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
    /** The variant's avg_cost_paisa at the moment of sale, snapshotted so a later cost change never rewrites past P&L. */
    unitCostPaisa: integer("unit_cost_paisa").notNull().default(0),
    quantity: integer("quantity").notNull(),
    lineTotalPaisa: integer("line_total_paisa").notNull(),
    /** Manual per-line discount applied by staff while editing. */
    discountPaisa: integer("discount_paisa").notNull().default(0),
    /** Set on every component line that came from a bundle, so the receipt can group them. */
    bundleSku: text("bundle_sku"),
    bundleName: text("bundle_name"),
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
    /** "en" or "ur". Urdu posts render right-to-left in the Nastaliq stack. */
    lang: text("lang").notNull().default("en"),
    /** Slug of the same article in the other language, when one exists. */
    translationSlug: text("translation_slug"),
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
  reviews: many(reviews),
}));
export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  adjustments: many(inventoryAdjustments),
  components: many(bundleComponents, { relationName: "bundleOf" }),
}));
export const bundleComponentsRelations = relations(bundleComponents, ({ one }) => ({
  bundle: one(productVariants, {
    fields: [bundleComponents.bundleVariantId],
    references: [productVariants.id],
    relationName: "bundleOf",
  }),
  component: one(productVariants, {
    fields: [bundleComponents.componentVariantId],
    references: [productVariants.id],
    relationName: "componentOf",
  }),
}));
export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
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
export type BundleComponent = typeof bundleComponents.$inferSelect;
export type Review = typeof reviews.$inferSelect;
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
export type ExpenseEntry = typeof expenseEntries.$inferSelect;
export const EXPENSE_CATEGORIES = expenseCategoryEnum.enumValues;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type CustomerSegment = typeof customerSegments.$inferSelect;
export type MetafieldDefinition = typeof metafieldDefinitions.$inferSelect;
export type MetafieldValue = typeof metafieldValues.$inferSelect;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type SavedView = typeof savedViews.$inferSelect;

/* ============================================================================
 * Integrations layer: job queue, courier, WhatsApp, and the outbound call log.
 * Everything below is additive. Nothing above it depends on any of it, so an
 * integration that is off (or broken) can never reach the order path.
 * ==========================================================================*/

export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "dead"]);
export const JOB_STATUSES = jobStatusEnum.enumValues;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const integrationDirectionEnum = pgEnum("integration_direction", ["outbound", "inbound"]);
export const waDirectionEnum = pgEnum("wa_direction", ["outbound", "inbound"]);
export const waMessageStatusEnum = pgEnum("wa_message_status", [
  "queued",
  "sent",
  "delivered",
  "read",
  "failed",
  "skipped",
  "received",
]);

/**
 * Durable work queue. Every outbound side effect goes through here, so the
 * order transaction commits before anything external is attempted and a
 * failure retries instead of vanishing.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    /** Unique per logical action, so a retry never books the same shipment twice. */
    idempotencyKey: text("idempotency_key"),
    lastError: text("last_error"),
    result: jsonb("result"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("jobs_idempotency_idx").on(t.idempotencyKey),
    index("jobs_claim_idx").on(t.status, t.runAfter),
    index("jobs_type_idx").on(t.type, t.createdAt),
    index("jobs_status_created_idx").on(t.status, t.createdAt),
  ],
);

/**
 * One row per provider. Secrets live in `secrets` as AES-256-GCM envelopes and
 * are never returned to the browser: the UI only ever sees the last 4 chars.
 */
export const integrations = pgTable("integrations", {
  provider: text("provider").primaryKey(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  /** Per-provider override. The global switch in settings wins when it is on. */
  dryRun: boolean("dry_run").notNull().default(true),
  /** Non-secret configuration: ids, toggles, defaults. Safe to render. */
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  /** { field: { cipher, iv, tag, last4 } }. Never selected into a client component. */
  secrets: jsonb("secrets").notNull().default(sql`'{}'::jsonb`),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestOk: boolean("last_test_ok"),
  lastTestMessage: text("last_test_message"),
  /** Set by the call logger; drives the dashboard health strip. */
  lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  ...timestamps,
});

/** Last-N call log per provider. Bodies are stored already redacted. */
export const integrationEvents = pgTable(
  "integration_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    direction: integrationDirectionEnum("direction").notNull().default("outbound"),
    operation: text("operation").notNull().default(""),
    method: text("method").notNull().default("GET"),
    endpoint: text("endpoint").notNull().default(""),
    requestBody: jsonb("request_body"),
    requestHeaders: jsonb("request_headers"),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    ok: boolean("ok").notNull().default(false),
    dryRun: boolean("dry_run").notNull().default(false),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    jobId: uuid("job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("integration_events_provider_idx").on(t.provider, t.createdAt),
    index("integration_events_created_idx").on(t.createdAt),
    index("integration_events_ok_idx").on(t.ok, t.createdAt),
  ],
);

/**
 * MARK city to courier city id. Every courier names cities differently, and a
 * wrong id is the single most common booking failure, so each row is confirmed
 * by a human before it is used.
 */
export const courierCities = pgTable(
  "courier_cities",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    markCity: text("mark_city").notNull(),
    courierCityId: text("courier_city_id").notNull(),
    courierCityName: text("courier_city_name").notNull().default(""),
    confirmedById: uuid("confirmed_by_id").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("courier_cities_pair_idx").on(t.provider, t.markCity),
    index("courier_cities_provider_idx").on(t.provider),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    trackingNumber: text("tracking_number").notNull(),
    /** MARK's own vocabulary. See lib/courier/status.ts. */
    status: text("status").notNull().default("booked"),
    /** Exactly what the courier said, kept so a mapping bug stays recoverable. */
    rawStatus: text("raw_status").notNull().default(""),
    labelUrl: text("label_url"),
    pickupAddressCode: text("pickup_address_code").notNull().default(""),
    courierCityId: text("courier_city_id").notNull().default(""),
    codAmountPaisa: integer("cod_amount_paisa").notNull().default(0),
    /** What the courier actually remitted, filled in during reconciliation. */
    remittedPaisa: integer("remitted_paisa").notNull().default(0),
    remittanceId: uuid("remittance_id"),
    bookedById: uuid("booked_by_id").references(() => users.id, { onDelete: "set null" }),
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("shipments_tracking_idx").on(t.provider, t.trackingNumber),
    index("shipments_order_idx").on(t.orderId),
    index("shipments_status_idx").on(t.status, t.lastSyncAt),
    index("shipments_provider_idx").on(t.provider, t.bookedAt),
    index("shipments_delivered_idx").on(t.deliveredAt),
  ],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("unknown"),
    rawStatus: text("raw_status").notNull().default(""),
    message: text("message").notNull().default(""),
    location: text("location").notNull().default(""),
    /** "poll" | "webhook" | "manual" */
    source: text("source").notNull().default("poll"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shipment_events_dedupe_idx").on(t.shipmentId, t.rawStatus, t.occurredAt),
    index("shipment_events_shipment_idx").on(t.shipmentId, t.occurredAt),
  ],
);

/** What a courier actually paid out, against what it collected. */
export const codRemittances = pgTable(
  "cod_remittances",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    reference: text("reference").notNull().default(""),
    paidOn: timestamp("paid_on", { withTimezone: true }).notNull().defaultNow(),
    amountPaisa: integer("amount_paisa").notNull().default(0),
    /** Sum of the attached lines; a gap against amountPaisa is a red flag. */
    allocatedPaisa: integer("allocated_paisa").notNull().default(0),
    note: text("note").notNull().default(""),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("cod_remittances_provider_idx").on(t.provider, t.paidOn)],
);

export const codRemittanceLines = pgTable(
  "cod_remittance_lines",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    remittanceId: uuid("remittance_id")
      .notNull()
      .references(() => codRemittances.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    trackingNumber: text("tracking_number").notNull().default(""),
    expectedPaisa: integer("expected_paisa").notNull().default(0),
    paidPaisa: integer("paid_paisa").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cod_remittance_lines_pair_idx").on(t.remittanceId, t.trackingNumber),
    index("cod_remittance_lines_shipment_idx").on(t.shipmentId),
  ],
);

/**
 * Mirrors the templates approved in Meta's Business Manager. Authoring and
 * approval happen there; this table only tells the app what it may send.
 */
export const whatsappTemplates = pgTable(
  "whatsapp_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    language: text("language").notNull().default("en"),
    /** Meta's billing category: utility | marketing | authentication | service */
    category: text("category").notNull().default("utility"),
    body: text("body").notNull().default(""),
    /** Ordered variable names for {{1}}, {{2}}, ... */
    variables: text("variables").array().notNull().default(sql`'{}'::text[]`),
    /** approved | pending | rejected | local */
    approvalStatus: text("approval_status").notNull().default("local"),
    /** Which lifecycle trigger sends this, or null for manual only. */
    trigger: text("trigger"),
    isEnabled: boolean("is_enabled").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("whatsapp_templates_name_idx").on(t.name, t.language),
    index("whatsapp_templates_trigger_idx").on(t.trigger),
  ],
);

/** Every send and every inbound message. Drives the monthly cost estimate. */
export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    direction: waDirectionEnum("direction").notNull().default("outbound"),
    phone: text("phone").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    templateName: text("template_name").notNull().default(""),
    category: text("category").notNull().default("utility"),
    trigger: text("trigger").notNull().default(""),
    body: text("body").notNull().default(""),
    /** Meta's message id, used to reconcile status webhooks. */
    wamid: text("wamid"),
    status: waMessageStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    /** Meta bills per conversation, not per message; this flags the billable ones. */
    billable: boolean("billable").notNull().default(true),
    isRead: boolean("is_read").notNull().default(false),
    dryRun: boolean("dry_run").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("whatsapp_messages_phone_idx").on(t.phone, t.createdAt),
    index("whatsapp_messages_customer_idx").on(t.customerId, t.createdAt),
    index("whatsapp_messages_order_idx").on(t.orderId),
    index("whatsapp_messages_unread_idx").on(t.direction, t.isRead),
    index("whatsapp_messages_cost_idx").on(t.direction, t.category, t.createdAt),
    uniqueIndex("whatsapp_messages_wamid_idx").on(t.wamid),
  ],
);

/* ------------------------------------------- integration relations & types */

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  events: many(shipmentEvents),
}));
export const shipmentEventsRelations = relations(shipmentEvents, ({ one }) => ({
  shipment: one(shipments, { fields: [shipmentEvents.shipmentId], references: [shipments.id] }),
}));
export const codRemittancesRelations = relations(codRemittances, ({ many }) => ({
  lines: many(codRemittanceLines),
}));
export const codRemittanceLinesRelations = relations(codRemittanceLines, ({ one }) => ({
  remittance: one(codRemittances, {
    fields: [codRemittanceLines.remittanceId],
    references: [codRemittances.id],
  }),
  shipment: one(shipments, { fields: [codRemittanceLines.shipmentId], references: [shipments.id] }),
}));

export type Job = typeof jobs.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type CourierCity = typeof courierCities.$inferSelect;
export type Shipment = typeof shipments.$inferSelect;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type CodRemittance = typeof codRemittances.$inferSelect;
export type CodRemittanceLine = typeof codRemittanceLines.$inferSelect;
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
