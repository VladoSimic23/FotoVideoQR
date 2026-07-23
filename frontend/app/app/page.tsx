import { GuestBooth } from "../components/guest-booth";
import { getActiveWeddingEvent } from "../lib/sanity";

export const revalidate = 60;

function normalizeSlug(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback;
  }

  return normalized;
}

export default async function Home() {
  const event = await getActiveWeddingEvent();
  const guestSlug = normalizeSlug(event?.slug, "demo");
  const dashboardSlug = normalizeSlug(event?.dashboardSlug, guestSlug);

  return (
    <GuestBooth
      title={event?.title ?? "Wedding QR booth"}
      coupleNames={event?.coupleNames ?? "Mladenci"}
      eventSlug={guestSlug}
      guestPath={`/w/${guestSlug}`}
      dashboardPath={`/dashboard/${dashboardSlug}`}
      maxVideoSeconds={event?.maxVideoSeconds ?? 10}
    />
  );
}
