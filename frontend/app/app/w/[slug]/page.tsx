import { GuestBooth } from "../../../components/guest-booth";
import { getWeddingEventByAnySlug } from "../../../lib/sanity";

export const revalidate = 60;

function normalizeSlug(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback;
  }

  return normalized;
}

export default async function GuestWeddingPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = normalizeSlug(resolvedParams.slug, "demo");
  const event = await getWeddingEventByAnySlug(slug);
  const guestSlug = normalizeSlug(event?.slug, slug);
  const dashboardSlug = normalizeSlug(event?.dashboardSlug, slug);

  return (
    <GuestBooth
      title={event?.title ?? "Wedding QR booth"}
      coupleNames={event?.coupleNames ?? "Mladenci"}
      eventSlug={guestSlug}
      guestPath={`/w/${guestSlug}`}
      dashboardPath={`/dashboard/${dashboardSlug}`}
    />
  );
}
