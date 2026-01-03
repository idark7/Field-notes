import { redirect } from "next/navigation";

export default async function EditorPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolvedSearchParams?.view;
  if (view === "stories") {
    redirect("/editor/basic?view=stories#my-stories");
  }
  redirect("/editor/advanced");
}
