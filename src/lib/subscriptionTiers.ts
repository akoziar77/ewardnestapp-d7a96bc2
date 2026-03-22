export const TIERS = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "$0",
    description: "Get started with the basics",
    features: [
      "Up to 3 brand connections",
      "Basic visit tracking",
      "Standard rewards catalog",
    ],
  },
  pro: {
    name: "Pro",
    price: 499,
    priceLabel: "$4.99",
    price_id: "price_1TDpYq47g1uazsxNUa5Txa3k",
    product_id: "prod_UCE0Gqv3DUAJ2M",
    description: "For power users who want more",
    features: [
      "Unlimited brand connections",
      "Advanced analytics & insights",
      "Premium rewards & geofence alerts",
      "Priority point tracking",
    ],
  },
  business: {
    name: "Business",
    price: 1499,
    priceLabel: "$14.99",
    price_id: "price_1TDpZc47g1uazsxNxOwnTNdk",
    product_id: "prod_UCE1skWcfEsX9p",
    description: "For teams and power users",
    features: [
      "Everything in Pro",
      "Team analytics dashboard",
      "Custom integrations",
      "Priority support",
      "API access",
    ],
  },
} as const;

export type TierKey = keyof typeof TIERS;

export function getTierByProductId(productId: string | null): TierKey {
  if (productId === TIERS.pro.product_id) return "pro";
  if (productId === TIERS.business.product_id) return "business";
  return "free";
}
