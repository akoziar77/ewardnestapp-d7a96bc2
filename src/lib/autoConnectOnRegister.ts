import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-connect a brand's loyalty program when the user clicks Register.
 * Opens the registration URL and creates a connection record.
 */
export async function autoConnectOnRegister({
  brandId,
  providerName,
  registrationUrl,
}: {
  brandId: string;
  providerName: string;
  registrationUrl: string;
}) {
  // Open registration page
  window.open(registrationUrl, "_blank", "noopener");

  // Create connection in background
  try {
    await supabase.functions.invoke("connect-loyalty", {
      body: {
        action: "connect",
        brand_id: brandId,
        provider_name: providerName,
        api_endpoint: null,
        access_token: null,
        external_member_id: null,
        points_balance: null,
      },
    });
  } catch {
    // Silently fail — the user can manually connect later
    console.warn("Auto-connect after register failed for brand", brandId);
  }
}
