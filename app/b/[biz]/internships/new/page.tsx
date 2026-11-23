import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getSettings } from "@/lib/invoices";
import { internshipsEnabled, newPayload } from "@/lib/internships";
import InternshipEditor from "@/components/InternshipEditor";

export const dynamic = "force-dynamic";

export default async function NewInternship({ params }: { params: Promise<{ biz: string }> }) {
  const { biz } = await params;
  if (!internshipsEnabled(biz)) notFound();
  await requireAccess(biz, "editor");
  const settings = await getSettings(biz);
  return <InternshipEditor biz={biz} initial={newPayload(settings)} canEdit />;
}
