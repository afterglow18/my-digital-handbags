/**
 * RevenueCat client — wraps @revenuecat/purchases-capacitor.
 *
 * Works in browser (test store) and native iOS (App Store).
 * Entitlement: "unlock"
 * Packages:    $rc_monthly | $rc_annual | $rc_lifetime
 */
import { Purchases } from "@revenuecat/purchases-capacitor";
import type { PurchasesPackage, PurchasesOfferings } from "@revenuecat/purchases-capacitor";
import type { PurchaseProduct, Tier } from "@/types/local";

const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string;
const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string;

export const ENTITLEMENT_ID = "unlock";

/** Map app product keys → RevenueCat package identifiers */
const PACKAGE_ID: Record<PurchaseProduct, string> = {
  monthly:  "$rc_monthly",
  yearly:   "$rc_annual",
  lifetime: "$rc_lifetime",
  premium:  "$rc_lifetime", // premium uses lifetime package as fallback
};

/** Which tier each product unlocks */
export const PRODUCT_TIER_MAP: Record<PurchaseProduct, Tier> = {
  monthly:  "unlock",
  yearly:   "unlock",
  lifetime: "unlock",
  premium:  "premium",
};

let _initialised = false;
let _configurePromise: Promise<void> | null = null;

/** Initialise RevenueCat and return a promise that resolves when the SDK is ready. */
export function initRevenueCat(): Promise<void> {
  if (_initialised && _configurePromise) return _configurePromise;
  _initialised = true;

  // In browser / dev → use test store key; in native iOS → use App Store key.
  // Capacitor automatically handles web vs native context.
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const apiKey   = isNative ? (IOS_KEY ?? TEST_KEY) : (TEST_KEY ?? IOS_KEY);

  if (!apiKey) {
    console.warn("[RevenueCat] No API key found — purchases disabled");
    _configurePromise = Promise.resolve();
    return _configurePromise;
  }

  _configurePromise = Purchases.configure({ apiKey })
    .then(() => console.log("[RevenueCat] Configured"))
    .catch((e: unknown) => console.error("[RevenueCat] Configure error:", e));

  return _configurePromise;
}

/** Fetch the current offering and find the package for a given product. */
export async function getPackageForProduct(
  product: PurchaseProduct,
): Promise<PurchasesPackage | null> {
  const pkgId = PACKAGE_ID[product];
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return (
    current.availablePackages.find((p: PurchasesPackage) => p.packageType === pkgId || p.identifier === pkgId) ??
    null
  );
}

/** Check whether the user currently has the "unlock" entitlement active. */
export async function getActiveEntitlement(): Promise<boolean> {
  const { customerInfo } = await Purchases.getCustomerInfo();
  return ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
}

/** Restore previous purchases and return whether "unlock" is now active. */
export async function restoreAndCheck(): Promise<boolean> {
  const { customerInfo } = await Purchases.restorePurchases();
  return ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
}

/**
 * Check the current customer's entitlements immediately after SDK init and
 * return true if "unlock" is active.  Call this on every cold launch so
 * localStorage stays in sync with RevenueCat's source of truth.
 */
export async function syncEntitlementOnStartup(): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
  } catch {
    return false;
  }
}
