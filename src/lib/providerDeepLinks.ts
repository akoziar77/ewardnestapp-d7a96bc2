/**
 * Provider deep-link registry — maps loyalty providers to native app schemes,
 * app store URLs, and web fallbacks for the "Open App" flow.
 */

export interface ProviderLink {
  /** iOS URL scheme (e.g. hiltonhonors://) */
  iosScheme?: string;
  /** Android intent or package-based URL */
  androidScheme?: string;
  /** iOS App Store URL */
  appStoreUrl?: string;
  /** Google Play Store URL */
  playStoreUrl?: string;
  /** Web fallback URL */
  webUrl: string;
  /** Human-readable app name */
  appName: string;
  /** Registration / sign-up URL (supports query-param pre-fill) */
  registrationUrl?: string;
}

export interface PreFillData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  zipCode?: string;
}

/**
 * Build a registration URL with pre-filled user data.
 * Falls back to the provider's webUrl if no registrationUrl is defined.
 */
export function buildRegistrationUrl(
  loyaltyProvider: string | null | undefined,
  preFill: PreFillData
): string | null {
  const link = getProviderLink(loyaltyProvider);
  if (!link) return null;

  const base = link.registrationUrl ?? link.webUrl;
  const url = new URL(base);

  // Add common pre-fill params that many registration forms accept
  if (preFill.firstName) url.searchParams.set("firstName", preFill.firstName);
  if (preFill.lastName) url.searchParams.set("lastName", preFill.lastName);
  if (preFill.email) url.searchParams.set("email", preFill.email);
  if (preFill.phone) url.searchParams.set("phone", preFill.phone);
  if (preFill.zipCode) url.searchParams.set("zipCode", preFill.zipCode);

  return url.toString();
}

/**
 * Registry keyed by loyalty_provider name (case-insensitive lookup).
 * Add new providers here as needed.
 */
const PROVIDER_LINKS: Record<string, ProviderLink> = {
  // ── Hotels ──────────────────────────────────────────
  "hilton honors": {
    iosScheme: "hiltonhonors://",
    appStoreUrl: "https://apps.apple.com/app/hilton-honors/id635150066",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.hilton.android.hilton",
    webUrl: "https://www.hilton.com/en/hilton-honors/",
    appName: "Hilton Honors",
    registrationUrl: "https://www.hilton.com/en/hilton-honors/join/",
  },
  "marriott bonvoy": {
    iosScheme: "marriott://",
    appStoreUrl: "https://apps.apple.com/app/marriott-bonvoy/id455004730",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.marriott.mrt",
    webUrl: "https://www.marriott.com/loyalty.mi",
    appName: "Marriott Bonvoy",
    registrationUrl: "https://www.marriott.com/loyalty/createAccount/createAccountPage1.mi",
  },
  "world of hyatt": {
    appStoreUrl: "https://apps.apple.com/app/world-of-hyatt/id632850498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.hyatt.android.hyattguest",
    webUrl: "https://world.hyatt.com/",
    appName: "World of Hyatt",
  },
  "ihg one rewards": {
    iosScheme: "ihg://",
    appStoreUrl: "https://apps.apple.com/app/ihg-hotels-rewards/id368217498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.ihg.apps.android",
    webUrl: "https://www.ihg.com/onerewards/",
    appName: "IHG One Rewards",
  },
  "wyndham rewards": {
    appStoreUrl: "https://apps.apple.com/app/wyndham-rewards/id620498102",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.wyndham.rewards",
    webUrl: "https://www.wyndhamrewards.com/",
    appName: "Wyndham Rewards",
  },
  "best western rewards": {
    appStoreUrl: "https://apps.apple.com/app/best-western/id371796165",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.bestwestern.app",
    webUrl: "https://www.bestwestern.com/en_US/rewards.html",
    appName: "Best Western Rewards",
  },
  "choice privileges": {
    appStoreUrl: "https://apps.apple.com/app/choice-hotels/id457498498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.choicehotels.android",
    webUrl: "https://www.choicehotels.com/choice-privileges",
    appName: "Choice Hotels",
  },
  "accor live limitless": {
    appStoreUrl: "https://apps.apple.com/app/all-com-accor-live-limitless/id330455402",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.accor.appli.hybrid",
    webUrl: "https://all.accor.com/loyalty-program",
    appName: "ALL – Accor Live Limitless",
  },

  // ── Airlines ────────────────────────────────────────
  "aadvantage": {
    iosScheme: "aa://",
    appStoreUrl: "https://apps.apple.com/app/american-airlines/id382698565",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.aa.android",
    webUrl: "https://www.aa.com/aadvantage",
    appName: "American Airlines",
  },
  "skymiles": {
    iosScheme: "deltaair://",
    appStoreUrl: "https://apps.apple.com/app/fly-delta/id388491656",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.delta.mobile.android",
    webUrl: "https://www.delta.com/skymiles",
    appName: "Delta Air Lines",
  },
  "mileageplus": {
    appStoreUrl: "https://apps.apple.com/app/united-airlines/id449945214",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.united.mobile.android",
    webUrl: "https://www.united.com/ual/en/us/fly/mileageplus.html",
    appName: "United Airlines",
  },
  "rapid rewards": {
    appStoreUrl: "https://apps.apple.com/app/southwest-airlines/id381667706",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.southwestairlines.mobile",
    webUrl: "https://www.southwest.com/rapidrewards/",
    appName: "Southwest Airlines",
  },
  "mileage plan": {
    appStoreUrl: "https://apps.apple.com/app/alaska-airlines/id356143498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.alaskaairlines.android",
    webUrl: "https://www.alaskaair.com/mileage-plan",
    appName: "Alaska Airlines",
  },
  "jetblue trueblue": {
    appStoreUrl: "https://apps.apple.com/app/jetblue/id348427165",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.jetblue.JetBlueAndroid",
    webUrl: "https://trueblue.jetblue.com/",
    appName: "JetBlue",
  },

  // ── Coffee & Dining ────────────────────────────────
  "starbucks rewards": {
    iosScheme: "starbucks://",
    appStoreUrl: "https://apps.apple.com/app/starbucks/id331177714",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.starbucks.mobilecard",
    webUrl: "https://www.starbucks.com/rewards",
    appName: "Starbucks",
    registrationUrl: "https://www.starbucks.com/account/create",
  },
  "chipotle rewards": {
    appStoreUrl: "https://apps.apple.com/app/chipotle/id327228455",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.chipotle.ordering",
    webUrl: "https://www.chipotle.com/rewards",
    appName: "Chipotle",
  },
  "chick-fil-a one": {
    appStoreUrl: "https://apps.apple.com/app/chick-fil-a/id488818498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.chickfila.cfaone",
    webUrl: "https://www.chick-fil-a.com/one",
    appName: "Chick-fil-A",
  },
  "mymcdonald's rewards": {
    iosScheme: "mcdonalds://",
    appStoreUrl: "https://apps.apple.com/app/mcdonalds/id922103212",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.mcdonalds.app",
    webUrl: "https://www.mcdonalds.com/us/en-us/mymcdonalds.html",
    appName: "McDonald's",
    registrationUrl: "https://www.mcdonalds.com/us/en-us/mymcdonalds.html",
  },
  "royal perks": {
    appStoreUrl: "https://apps.apple.com/app/burger-king-app/id652603901",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.emn8.mobilem8.nativeapp.bk",
    webUrl: "https://www.bk.com/rewards",
    appName: "Burger King",
  },
  "dunkin' rewards": {
    iosScheme: "dunkindonuts://",
    appStoreUrl: "https://apps.apple.com/app/dunkin/id1056891880",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.dunkinbrands.otgo",
    webUrl: "https://www.dunkindonuts.com/en/dd-perks",
    appName: "Dunkin'",
  },
  "panera bread rewards": {
    appStoreUrl: "https://apps.apple.com/app/panera-bread/id702027530",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.panerabread.mypanera",
    webUrl: "https://www.panerabread.com/en-us/mypanera.html",
    appName: "Panera Bread",
  },
  "domino's piece of the pie rewards": {
    appStoreUrl: "https://apps.apple.com/app/dominos-pizza-usa/id436491861",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.dominospizza",
    webUrl: "https://www.dominos.com/pages/rewards",
    appName: "Domino's",
  },

  // ── Retail ──────────────────────────────────────────
  "target circle": {
    appStoreUrl: "https://apps.apple.com/app/target/id368677368",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.target.ui",
    webUrl: "https://www.target.com/circle",
    appName: "Target",
    registrationUrl: "https://www.target.com/account/create",
  },
  "walmart+": {
    appStoreUrl: "https://apps.apple.com/app/walmart-shopping-grocery/id338137227",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.walmart.android",
    webUrl: "https://www.walmart.com/plus",
    appName: "Walmart",
  },
  "beauty insider": {
    appStoreUrl: "https://apps.apple.com/app/sephora-buy-makeup-skincare/id393328150",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.sephora",
    webUrl: "https://www.sephora.com/beauty/beauty-insider",
    appName: "Sephora",
  },
  "ultamate rewards": {
    appStoreUrl: "https://apps.apple.com/app/ulta-beauty-makeup-skincare/id504539717",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.ulta",
    webUrl: "https://www.ulta.com/ulta/myaccount/learnmore_program.jsp",
    appName: "Ulta Beauty",
  },
  "nike membership": {
    iosScheme: "nike://",
    appStoreUrl: "https://apps.apple.com/app/nike-shoes-apparel-stories/id1095459556",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.nike.omega",
    webUrl: "https://www.nike.com/membership",
    appName: "Nike",
  },
  "my best buy": {
    appStoreUrl: "https://apps.apple.com/app/best-buy/id314855255",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.bestbuy.android",
    webUrl: "https://www.bestbuy.com/loyalty",
    appName: "Best Buy",
  },

  // ── Pharmacy & Grocery ─────────────────────────────
  "extracare rewards": {
    appStoreUrl: "https://apps.apple.com/app/cvs-pharmacy/id395545555",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.cvs.launchers.cvs",
    webUrl: "https://www.cvs.com/extracare",
    appName: "CVS Pharmacy",
  },
  "balance rewards": {
    appStoreUrl: "https://apps.apple.com/app/walgreens/id335364882",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.walgreens.app",
    webUrl: "https://www.walgreens.com/mywalgreens",
    appName: "Walgreens",
  },
  "kroger plus": {
    appStoreUrl: "https://apps.apple.com/app/kroger/id395498591",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.kroger.mobile",
    webUrl: "https://www.kroger.com/d/fuel-points",
    appName: "Kroger",
  },

  // ── Gas & Car Rental ───────────────────────────────
  "shell fuel rewards": {
    appStoreUrl: "https://apps.apple.com/app/shell-recharge-fuel/id327516263",
    playStoreUrl: "https://play.google.com/store/apps/details?id=au.com.shell.shellaustralia",
    webUrl: "https://www.fuelrewards.com/",
    appName: "Shell",
  },
  "hertz gold plus rewards": {
    appStoreUrl: "https://apps.apple.com/app/hertz-car-rental/id357433498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.hertz.android.phone",
    webUrl: "https://www.hertz.com/goldplus",
    appName: "Hertz",
  },
  "national car rental emerald club": {
    appStoreUrl: "https://apps.apple.com/app/national-car-rental/id387068167",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.nationalcar.aem.mobile",
    webUrl: "https://www.nationalcar.com/en/car-rental/loyalty.html",
    appName: "National Car Rental",
  },

  // ── Entertainment ──────────────────────────────────
  "amc stubs": {
    appStoreUrl: "https://apps.apple.com/app/amc-theatres-movies-more/id509498498",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.amc",
    webUrl: "https://www.amctheatres.com/amcstubs",
    appName: "AMC Theatres",
  },

  // ── Rideshare & Delivery ───────────────────────────
  "uber rewards": {
    iosScheme: "uber://",
    appStoreUrl: "https://apps.apple.com/app/uber-request-a-ride/id368677368",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.ubercab",
    webUrl: "https://www.uber.com/us/en/u/rewards/",
    appName: "Uber",
  },
  "uber one": {
    iosScheme: "uber://",
    appStoreUrl: "https://apps.apple.com/app/uber-request-a-ride/id368677368",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.ubercab",
    webUrl: "https://www.uber.com/us/en/u/uber-one/",
    appName: "Uber",
  },
  "lyft rewards": {
    iosScheme: "lyft://",
    appStoreUrl: "https://apps.apple.com/app/lyft/id529379082",
    playStoreUrl: "https://play.google.com/store/apps/details?id=me.lyft.android",
    webUrl: "https://www.lyft.com/rider/rewards",
    appName: "Lyft",
  },
  "doordash rewards": {
    appStoreUrl: "https://apps.apple.com/app/doordash-food-delivery/id719972451",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.dd.doordash",
    webUrl: "https://www.doordash.com/consumer/rewards/",
    appName: "DoorDash",
  },
  "dashpass": {
    appStoreUrl: "https://apps.apple.com/app/doordash-food-delivery/id719972451",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.dd.doordash",
    webUrl: "https://www.doordash.com/dashpass/",
    appName: "DoorDash",
  },
  "grubhub+": {
    appStoreUrl: "https://apps.apple.com/app/grubhub-food-delivery/id302920553",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.grubhub.android",
    webUrl: "https://www.grubhub.com/plus",
    appName: "Grubhub",
  },
  "instacart+": {
    appStoreUrl: "https://apps.apple.com/app/instacart-grocery-delivery/id545599256",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.instacart.client",
    webUrl: "https://www.instacart.com/instacart-plus",
    appName: "Instacart",
  },

  // ── Fitness & Wellness ─────────────────────────────
  "planet fitness black card": {
    appStoreUrl: "https://apps.apple.com/app/planet-fitness-workouts/id399857015",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.planetfitness.home",
    webUrl: "https://www.planetfitness.com/upgrade",
    appName: "Planet Fitness",
  },

  // ── Streaming & Subscriptions ──────────────────────
  "costco membership": {
    appStoreUrl: "https://apps.apple.com/app/costco/id535509415",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.costco.app.android",
    webUrl: "https://www.costco.com/join-costco.html",
    appName: "Costco",
  },
  "amazon prime": {
    appStoreUrl: "https://apps.apple.com/app/amazon-shopping/id297606951",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.amazon.mShop.android.shopping",
    webUrl: "https://www.amazon.com/amazonprime",
    appName: "Amazon",
  },
  "sam's club membership": {
    appStoreUrl: "https://apps.apple.com/app/sams-club/id397538465",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.rfi.sams.android",
    webUrl: "https://www.samsclub.com/join",
    appName: "Sam's Club",
  },

  // ── More Dining ────────────────────────────────────
  "subway mvp rewards": {
    appStoreUrl: "https://apps.apple.com/app/subway/id901329000",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.subway.mobile.subwayapp03",
    webUrl: "https://www.subway.com/en-us/menunutrition/rewards",
    appName: "Subway",
  },
  "wendy's rewards": {
    appStoreUrl: "https://apps.apple.com/app/wendys/id540518599",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.wendys.nutritiontool",
    webUrl: "https://www.wendys.com/rewards",
    appName: "Wendy's",
  },
  "taco bell rewards": {
    appStoreUrl: "https://apps.apple.com/app/taco-bell-fast-food-delivery/id497387361",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.tacobell.ordering",
    webUrl: "https://www.tacobell.com/rewards",
    appName: "Taco Bell",
  },
  "popeyes rewards": {
    appStoreUrl: "https://apps.apple.com/app/popeyes/id1481aborr665283",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.popeyes.ordering",
    webUrl: "https://www.popeyes.com/rewards",
    appName: "Popeyes",
  },
  "papa johns rewards": {
    appStoreUrl: "https://apps.apple.com/app/papa-johns-pizza-delivery/id340930606",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.papajohns",
    webUrl: "https://www.papajohns.com/rewards",
    appName: "Papa Johns",
  },
  "pizza hut rewards": {
    appStoreUrl: "https://apps.apple.com/app/pizza-hut-delivery-takeout/id321438666",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.pizzahut.consumer.phoenix",
    webUrl: "https://www.pizzahut.com/hut-rewards.html",
    appName: "Pizza Hut",
  },
};

/**
 * Look up a provider's deep-link config.
 * Matches by loyalty_provider name (case-insensitive).
 */
export function getProviderLink(loyaltyProvider: string | null | undefined): ProviderLink | null {
  if (!loyaltyProvider) return null;
  return PROVIDER_LINKS[loyaltyProvider.toLowerCase()] ?? null;
}

/**
 * Detect platform and return the best URL for the "Open App" action.
 * Priority: native app scheme → app store → web fallback.
 */
export function getOpenAppUrl(provider: ProviderLink): string {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  // On mobile, prefer app store links (deep schemes are unreliable in webviews)
  if (isIOS) return provider.appStoreUrl ?? provider.webUrl;
  if (isAndroid) return provider.playStoreUrl ?? provider.webUrl;

  // Desktop falls back to web
  return provider.webUrl;
}

/**
 * Get all available links for a provider (for showing options to the user).
 */
export function getProviderLinks(loyaltyProvider: string | null | undefined): {
  appUrl: string | null;
  webUrl: string | null;
  appName: string | null;
} {
  const link = getProviderLink(loyaltyProvider);
  if (!link) return { appUrl: null, webUrl: null, appName: null };

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  let appUrl: string | null = null;
  if (isIOS) appUrl = link.appStoreUrl ?? null;
  else if (isAndroid) appUrl = link.playStoreUrl ?? null;

  return {
    appUrl,
    webUrl: link.webUrl,
    appName: link.appName,
  };
}
