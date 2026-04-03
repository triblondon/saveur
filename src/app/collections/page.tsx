import { redirect } from "next/navigation";
import { CollectionsTableView } from "@/components/CollectionsTableView";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCollectionsForUser } from "@/lib/store";

export default async function CollectionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/collections");
  }

  const collections = await listCollectionsForUser(user.id);

  return <CollectionsTableView collections={collections} />;
}
