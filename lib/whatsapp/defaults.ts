/**
 * The templates MARK expects to exist.
 *
 * These are mirrors, not sources of truth: the wording has to be submitted to
 * Meta's Business Manager and approved there before anything sends. Seeding
 * them here means the app knows the names, the categories and the variable
 * order before the first approval lands.
 */

export interface DefaultTemplate {
  name: string;
  language: string;
  category: "utility" | "marketing" | "authentication" | "service";
  trigger: string;
  body: string;
  variables: string[];
}

export const DEFAULT_WHATSAPP_TEMPLATES: DefaultTemplate[] = [
  {
    name: "mark_order_placed",
    language: "en",
    category: "utility",
    trigger: "order_placed",
    body: "Assalam o Alaikum {{1}}, thank you for your order {{2}} from MARKORGANICS. Total {{3}}, cash on delivery. We will call to confirm shortly.",
    variables: ["customer_name", "order_number", "order_total"],
  },
  {
    name: "mark_order_confirmed",
    language: "en",
    category: "utility",
    trigger: "order_confirmed",
    body: "Your MARKORGANICS order {{1}} is confirmed. Total {{2}}, cash on delivery. We will hand it to the courier shortly.",
    variables: ["order_number", "order_total"],
  },
  {
    name: "mark_order_shipped",
    language: "en",
    category: "utility",
    trigger: "order_shipped",
    body: "Good news {{1}} — your MARKORGANICS order {{2}} has shipped with {{3}}. Track it here: {{4}}",
    variables: ["customer_name", "order_number", "courier_name", "tracking_url"],
  },
  {
    name: "mark_out_for_delivery",
    language: "en",
    category: "utility",
    trigger: "out_for_delivery",
    body: "Your MARKORGANICS order {{1}} is out for delivery today. Please keep {{2}} ready for the rider.",
    variables: ["order_number", "order_total"],
  },
  {
    name: "mark_order_delivered",
    language: "en",
    category: "utility",
    trigger: "order_delivered",
    body: "Your MARKORGANICS order {{1}} has been delivered. Thank you, {{2}}. If anything is wrong, reply to this message and we will fix it.",
    variables: ["order_number", "customer_name"],
  },
  {
    name: "mark_order_cancelled",
    language: "en",
    category: "utility",
    trigger: "order_cancelled",
    body: "Your MARKORGANICS order {{1}} has been cancelled. If this was a mistake, reply here and we will place it again.",
    variables: ["order_number"],
  },
  {
    name: "mark_abandoned_cart",
    language: "en",
    category: "marketing",
    trigger: "abandoned_checkout",
    body: "Assalam o Alaikum {{1}}, you left {{2}} in your MARKORGANICS cart. Cash on delivery across Pakistan — finish here: {{3}}",
    variables: ["customer_name", "cart_summary", "checkout_url"],
  },
];
