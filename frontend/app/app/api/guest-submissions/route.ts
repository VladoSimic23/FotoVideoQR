import { createClient } from "@sanity/client";
import { NextResponse } from "next/server";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "33lo3roy";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-07-23";

const token =
  process.env.SANITY_API_WRITE_TOKEN || process.env.SANITY_WRITE_TOKEN;

const writeClient = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
});

const readClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
});

function isInvalidSlug(value: string | null) {
  return !value || value === "undefined" || value === "null";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const slugParam = url.searchParams.get("eventSlug");
    const eventSlug = typeof slugParam === "string" ? slugParam.trim() : null;

    if (isInvalidSlug(eventSlug)) {
      return NextResponse.json(
        { ok: false, error: "Invalid wedding slug." },
        { status: 400 },
      );
    }

    const weddingEvent = await readClient.fetch<{ _id: string } | null>(
      `*[_type == "weddingEvent" && (slug.current == $slug || dashboardSlug.current == $slug)][0]{_id}`,
      { slug: eventSlug },
    );

    if (!weddingEvent?._id) {
      return NextResponse.json(
        { ok: false, error: "Wedding event not found." },
        { status: 404 },
      );
    }

    const recent = await readClient.fetch<
      Array<{
        _id: string;
        _createdAt: string;
        mediaKind?: "image" | "video";
        status?: string;
        guestName?: string;
        caption?: string;
        image?: { asset?: { url?: string } };
        video?: { asset?: { url?: string } };
      }>
    >(
      `*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status in ["pending", "approved", "published"]] | order(_createdAt desc)[0...8]{
        _id,
        _createdAt,
        mediaKind,
        status,
        guestName,
        caption,
        "image": image{asset->{url}},
        "video": video{asset->{url}}
      }`,
      { eventId: weddingEvent._id },
    );

    return NextResponse.json({ ok: true, recent });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load recent submissions.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing Sanity write token. Set SANITY_API_WRITE_TOKEN (or SANITY_WRITE_TOKEN) in frontend/app/.env.local and restart Next.js.",
      },
      { status: 500 },
    );
  }

  try {
    const formData = await request.formData();
    const eventSlugValue = formData.get("eventSlug");
    const mediaKindValue = formData.get("mediaKind");
    const guestNameValue = formData.get("guestName");
    const captionValue = formData.get("caption");
    const durationValue = formData.get("durationSeconds");
    const mediaFileValue = formData.get("file");

    const eventSlug =
      typeof eventSlugValue === "string" ? eventSlugValue.trim() : null;
    const mediaKind = mediaKindValue === "video" ? "video" : "image";
    const guestName =
      typeof guestNameValue === "string" ? guestNameValue.trim() : "";
    const caption = typeof captionValue === "string" ? captionValue.trim() : "";
    const durationSeconds = Number(durationValue || 0);

    if (isInvalidSlug(eventSlug)) {
      return NextResponse.json(
        { ok: false, error: "Invalid wedding slug." },
        { status: 400 },
      );
    }

    if (!(mediaFileValue instanceof File) || mediaFileValue.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Missing captured media file." },
        { status: 400 },
      );
    }

    const weddingEvent = await writeClient.fetch<{
      _id: string;
      moderationMode?: string;
      autoPublishApproved?: boolean;
      maxVideoSeconds?: number;
      guestUploadEnabled?: boolean;
    } | null>(
      `*[_type == "weddingEvent" && (slug.current == $slug || dashboardSlug.current == $slug)][0]{
        _id,
        moderationMode,
        autoPublishApproved,
        maxVideoSeconds,
        guestUploadEnabled
      }`,
      { slug: eventSlug },
    );

    if (!weddingEvent?._id) {
      return NextResponse.json(
        { ok: false, error: "Wedding event not found." },
        { status: 404 },
      );
    }

    if (weddingEvent.guestUploadEnabled === false) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Uploads are currently disabled by the couple in dashboard settings.",
        },
        { status: 403 },
      );
    }

    if (mediaKind === "video") {
      const maxSeconds = 15;
      if (durationSeconds > maxSeconds + 0.5) {
        return NextResponse.json(
          {
            ok: false,
            error: `Video exceeds max duration of ${maxSeconds}s.`,
          },
          { status: 400 },
        );
      }
    }

    const uploadedAsset =
      mediaKind === "video"
        ? await writeClient.assets.upload("file", mediaFileValue, {
            filename: mediaFileValue.name,
            contentType: mediaFileValue.type || "video/webm",
          })
        : await writeClient.assets.upload("image", mediaFileValue, {
            filename: mediaFileValue.name,
            contentType: mediaFileValue.type || "image/webp",
          });

    const now = new Date().toISOString();
    const moderationMode = weddingEvent.moderationMode ?? "review";

    const isInstant = moderationMode === "instant";
    const status = isInstant ? "approved" : "pending";
    const visibleInGallery = isInstant;

    const submission = await writeClient.create({
      _type: "mediaSubmission",
      weddingEvent: {
        _type: "reference",
        _ref: weddingEvent._id,
      },
      guestName: guestName || undefined,
      mediaKind,
      status,
      visibleInGallery,
      caption: caption || undefined,
      capturedAt: now,
      approvedAt: isInstant ? now : undefined,
      durationSeconds:
        mediaKind === "video" ? durationSeconds || undefined : undefined,
      image:
        mediaKind === "image"
          ? {
              _type: "image",
              asset: {
                _type: "reference",
                _ref: uploadedAsset._id,
              },
              alt: caption || guestName || undefined,
            }
          : undefined,
      video:
        mediaKind === "video"
          ? {
              _type: "file",
              asset: {
                _type: "reference",
                _ref: uploadedAsset._id,
              },
            }
          : undefined,
    });

    return NextResponse.json({
      ok: true,
      submissionId: submission._id,
      status,
      visibleInGallery,
      assetUrl: uploadedAsset.url,
      moderationMode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish submission.",
      },
      { status: 500 },
    );
  }
}
