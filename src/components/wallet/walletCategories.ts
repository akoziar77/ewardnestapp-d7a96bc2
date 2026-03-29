export interface DocTypeItem {
  type: string;
  label: string;
  icon: string;     // lucide icon name
  color: string;    // tailwind bg class
}

export interface DocCategory {
  label: string;
  items: DocTypeItem[];
}

export const WALLET_CATEGORIES: DocCategory[] = [
  {
    label: "Travel",
    items: [
      { type: "ticket", label: "Ticket or Booking", icon: "Plane", color: "bg-blue-500" },
    ],
  },
  {
    label: "Identification",
    items: [
      { type: "drivers_license", label: "Driver's License", icon: "Car", color: "bg-indigo-500" },
      { type: "passport", label: "Passport", icon: "Globe", color: "bg-blue-600" },
      { type: "identity_card", label: "Identity Card", icon: "CreditCard", color: "bg-indigo-600" },
      { type: "residence_permit", label: "Residence Permit", icon: "FileText", color: "bg-indigo-500" },
    ],
  },
  {
    label: "Payment",
    items: [
      { type: "payment_card", label: "Payment Card", icon: "CreditCard", color: "bg-purple-500" },
      { type: "gift_card", label: "Gift Card", icon: "Gift", color: "bg-purple-600" },
    ],
  },
  {
    label: "Loyalty",
    items: [
      { type: "discount_card", label: "Discount Card", icon: "ShoppingBag", color: "bg-amber-500" },
      { type: "club_card", label: "Club Card", icon: "Users", color: "bg-amber-600" },
    ],
  },
  {
    label: "Medical",
    items: [
      { type: "medical_card", label: "Medical Card", icon: "Cross", color: "bg-red-500" },
      { type: "health_insurance", label: "Health Insurance", icon: "Shield", color: "bg-red-500" },
    ],
  },
  {
    label: "Certificates",
    items: [
      { type: "birth_certificate", label: "Birth Certificate", icon: "Baby", color: "bg-violet-500" },
      { type: "marriage_certificate", label: "Marriage Certificate", icon: "Heart", color: "bg-violet-600" },
    ],
  },
  {
    label: "Digital",
    items: [
      { type: "sim_card", label: "SIM Card", icon: "Smartphone", color: "bg-green-500" },
      { type: "password", label: "Password", icon: "KeyRound", color: "bg-green-600" },
    ],
  },
  {
    label: "Other",
    items: [
      { type: "custom", label: "Custom", icon: "FileBox", color: "bg-gray-500" },
    ],
  },
];

export function getDocType(type: string): DocTypeItem | undefined {
  for (const cat of WALLET_CATEGORIES) {
    const found = cat.items.find((i) => i.type === type);
    if (found) return found;
  }
  return undefined;
}
