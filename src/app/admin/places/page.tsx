import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlacesAdmin from "./PlacesAdmin";

export default async function AdminPlacesPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/admin/login");

  const { data: isAdmin } = await supabase.rpc("is_admin_user");
  if (!isAdmin) redirect("/admin/login");

  const { data: places } = await supabase
    .from("places")
    .select("*")
    .order("name");

  return <PlacesAdmin initialPlaces={places ?? []} adminEmail={user.email} />;
}
