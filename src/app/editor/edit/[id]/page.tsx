import { redirect } from "next/navigation";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  redirect(`/editor/advanced/edit/${resolvedParams.id}`);
}
