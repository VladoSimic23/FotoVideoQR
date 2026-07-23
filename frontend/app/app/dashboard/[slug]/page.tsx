import { WeddingDashboard } from "@/components/wedding-dashboard";
import { getDashboardSummary, getWeddingEventByAnySlug } from "@/lib/sanity";

export const revalidate = 5;

function normalizeSlug(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback;
  }

  return normalized;
}

export default async function WeddingDashboardPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = normalizeSlug(resolvedParams.slug, "demo");
  const event = await getWeddingEventByAnySlug(slug);
  const summary = await getDashboardSummary(event?._id);
  const dashboardSlug = normalizeSlug(event?.dashboardSlug, slug);
  const guestSlug = normalizeSlug(event?.slug, slug);

  return (
    <WeddingDashboard
      event={
        event ?? {
          title: "Wedding dashboard",
          coupleNames: "Mladenci",
          dashboardSlug: slug,
          guestUploadEnabled: true,
          autoPublishApproved: false,
          moderationMode: "review",
          maxVideoSeconds: 10,
        }
      }
      summary={summary}
      eventId={event?._id}
      dashboardPath={`/dashboard/${dashboardSlug}`}
      guestPath={`/w/${guestSlug}`}
    />
  );
}
