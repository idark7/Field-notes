import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="page-shell py-16">
      <ProfileForm initialName={user.name} initialImage={user.image} email={user.email} initialBio={user.bio ?? ""} />
    </main>
  );
}
