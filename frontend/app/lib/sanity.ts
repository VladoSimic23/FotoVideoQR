import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "33lo3roy";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-07-23";

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

export type WeddingEvent = {
  _id: string;
  title: string;
  coupleNames?: string;
  slug?: string;
  dashboardSlug?: string;
  welcomeCopy?: string;
  ceremonyDate?: string;
  guestUploadEnabled?: boolean;
  autoPublishApproved?: boolean;
  moderationMode?: string;
  maxVideoSeconds?: number;
  accentColor?: string;
  isActive?: boolean;
  notes?: string;
  heroImage?: {
    alt?: string;
    asset?: {
      url?: string;
      metadata?: {
        lqip?: string;
      };
    };
  };
};

export type GalleryMedia = {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  approvedAt?: string;
  guestName?: string;
  mediaKind?: "image" | "video";
  status?: string;
  visibleInGallery?: boolean;
  caption?: string;
  reviewNote?: string;
  durationSeconds?: number;
  image?: {
    alt?: string;
    asset?: {
      url?: string;
      metadata?: {
        lqip?: string;
        dimensions?: {
          width?: number;
          height?: number;
        };
      };
    };
  };
  video?: {
    asset?: {
      url?: string;
      mimeType?: string;
      originalFilename?: string;
      size?: number;
    };
  };
};

export type DashboardSummary = {
  total: number;
  pending: number;
  approved: number;
  hidden: number;
  rejected: number;
  recent: GalleryMedia[];
};

const eventProjection = `{
  _id,
  title,
  coupleNames,
  "slug": slug.current,
  "dashboardSlug": dashboardSlug.current,
  welcomeCopy,
  ceremonyDate,
  guestUploadEnabled,
  autoPublishApproved,
  moderationMode,
  maxVideoSeconds,
  accentColor,
  isActive,
  notes,
  "heroImage": heroImage{
    alt,
    asset->{
      url,
      metadata{lqip}
    }
  }
}`;

const mediaProjection = `{
  _id,
  _createdAt,
  _updatedAt,
  approvedAt,
  guestName,
  mediaKind,
  status,
  visibleInGallery,
  caption,
  reviewNote,
  durationSeconds,
  "image": image{
    alt,
    asset->{
      url,
      metadata{lqip, dimensions}
    }
  },
  "video": video{
    asset->{
      url,
      mimeType,
      originalFilename,
      size
    }
  }
}`;

async function safeFetch<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export async function getActiveWeddingEvent() {
  return safeFetch(
    sanityClient.fetch<WeddingEvent | null>(
      `*[_type == "weddingEvent" && isActive == true] | order(_updatedAt desc)[0]${eventProjection}`,
    ),
    null,
  );
}

export async function getWeddingEventBySlug(slug: string) {
  return safeFetch(
    sanityClient.fetch<WeddingEvent | null>(
      `*[_type == "weddingEvent" && slug.current == $slug][0]${eventProjection}`,
      { slug },
    ),
    null,
  );
}

export async function getWeddingEventByAnySlug(slug: string) {
  return safeFetch(
    sanityClient.fetch<WeddingEvent | null>(
      `*[_type == "weddingEvent" && (slug.current == $slug || dashboardSlug.current == $slug)][0]${eventProjection}`,
      { slug },
    ),
    null,
  );
}

export async function getGalleryForEvent(eventId?: string | null) {
  if (!eventId) {
    return [];
  }

  return safeFetch(
    sanityClient.fetch<GalleryMedia[]>(
      `*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && weddingEvent->guestUploadEnabled == true && visibleInGallery == true && status in ["approved", "published"]] | order(coalesce(approvedAt, _createdAt) desc)[0...24]${mediaProjection}`,
      { eventId },
    ),
    [],
  );
}

export async function getDashboardSummary(
  eventId?: string | null,
): Promise<DashboardSummary> {
  if (!eventId) {
    return {
      total: 0,
      pending: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
      recent: [],
    };
  }

  return safeFetch(
    sanityClient.fetch<DashboardSummary>(
      `{
        "total": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId]),
        "pending": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "pending"]),
        "approved": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "approved"]),
        "hidden": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "hidden"]),
        "rejected": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "rejected"]),
        "recent": *[_type == "mediaSubmission" && weddingEvent._ref == $eventId] | order(_createdAt desc)[0...8]${mediaProjection}
      }`,
      { eventId },
    ),
    {
      total: 0,
      pending: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
      recent: [],
    },
  );
}
