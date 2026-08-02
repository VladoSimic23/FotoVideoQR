import { createClient } from "@sanity/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "33lo3roy";
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const apiVersion = "2026-07-23";
const MAX_VIDEO_SECONDS = 15;
const MAX_VIDEO_UPLOAD_BYTES = 40_000_000;

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
        durationSeconds?: number;
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
        durationSeconds,
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
    const contentType = request.headers.get("content-type") ?? "";

    let eventSlugValue: FormDataEntryValue | string | null = null;
    let mediaKindValue: FormDataEntryValue | string | null = null;
    let guestNameValue: FormDataEntryValue | string | null = null;
    let captionValue: FormDataEntryValue | string | null = null;
    let durationValue: FormDataEntryValue | string | number | null = null;
    let fileSizeValue: FormDataEntryValue | string | number | null = null;
    let assetIdValue: FormDataEntryValue | string | null = null;
    let assetUrlValue: FormDataEntryValue | string | null = null;
    let mediaFileValue: FormDataEntryValue | null = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        eventSlug?: string;
        mediaKind?: "image" | "video";
        guestName?: string;
        caption?: string;
        durationSeconds?: number;
        fileSizeBytes?: number;
        assetId?: string;
        assetUrl?: string;
      };

      eventSlugValue = body.eventSlug ?? null;
      mediaKindValue = body.mediaKind ?? null;
      guestNameValue = body.guestName ?? "";
      captionValue = body.caption ?? "";
      durationValue = body.durationSeconds ?? 0;
      fileSizeValue = body.fileSizeBytes ?? 0;
      assetIdValue = body.assetId ?? null;
      assetUrlValue = body.assetUrl ?? null;
    } else {
      const formData = await request.formData();
      eventSlugValue = formData.get("eventSlug");
      mediaKindValue = formData.get("mediaKind");
      guestNameValue = formData.get("guestName");
      captionValue = formData.get("caption");
      durationValue = formData.get("durationSeconds");
      fileSizeValue = formData.get("fileSizeBytes");
      assetIdValue = formData.get("assetId");
      assetUrlValue = formData.get("assetUrl");
      mediaFileValue = formData.get("file");
    }

    const eventSlug =
      typeof eventSlugValue === "string" ? eventSlugValue.trim() : null;
    const mediaKind = mediaKindValue === "video" ? "video" : "image";
    const guestName =
      typeof guestNameValue === "string" ? guestNameValue.trim() : "";
    const caption = typeof captionValue === "string" ? captionValue.trim() : "";
    const durationSeconds = Number(durationValue || 0);
    const fileSizeBytes = Number(fileSizeValue || 0);
    const preUploadedAssetId =
      typeof assetIdValue === "string" ? assetIdValue.trim() : "";
    const preUploadedAssetUrl =
      typeof assetUrlValue === "string" ? assetUrlValue.trim() : "";

    if (isInvalidSlug(eventSlug)) {
      return NextResponse.json(
        { ok: false, error: "Invalid wedding slug." },
        { status: 400 },
      );
    }

    const mediaFile =
      mediaFileValue instanceof File && mediaFileValue.size > 0
        ? mediaFileValue
        : null;
    const hasPreUploadedAsset = Boolean(preUploadedAssetId);
    const hasLocalFile = Boolean(mediaFile);

    if (!hasPreUploadedAsset && !hasLocalFile) {
      return NextResponse.json(
        { ok: false, error: "Missing uploaded media asset." },
        { status: 400 },
      );
    }

    if (hasPreUploadedAsset) {
      const expectedPrefix = mediaKind === "video" ? "file-" : "image-";
      if (!preUploadedAssetId.startsWith(expectedPrefix)) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid ${mediaKind} asset reference provided.`,
          },
          { status: 400 },
        );
      }
    }

    if (mediaKind === "video") {
      const incomingVideoSize = mediaFile ? mediaFile.size : fileSizeBytes;

      if (
        Number.isFinite(incomingVideoSize) &&
        incomingVideoSize > MAX_VIDEO_UPLOAD_BYTES
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: "Video is too large. Maximum allowed size is 40 MB.",
          },
          { status: 400 },
        );
      }

      if (
        Number.isFinite(durationSeconds) &&
        durationSeconds > MAX_VIDEO_SECONDS
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Video exceeds max duration of ${MAX_VIDEO_SECONDS}s.`,
          },
          { status: 400 },
        );
      }
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

    const effectiveMaxVideoSeconds =
      typeof weddingEvent.maxVideoSeconds === "number" &&
      Number.isFinite(weddingEvent.maxVideoSeconds) &&
      weddingEvent.maxVideoSeconds > 0
        ? Math.min(weddingEvent.maxVideoSeconds, MAX_VIDEO_SECONDS)
        : MAX_VIDEO_SECONDS;

    if (mediaKind === "video") {
      if (
        Number.isFinite(durationSeconds) &&
        durationSeconds > effectiveMaxVideoSeconds
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Video exceeds max duration of ${effectiveMaxVideoSeconds}s.`,
          },
          { status: 400 },
        );
      }
    }

    let uploadedAsset: { _id: string; url?: string };

    if (mediaFile) {
      uploadedAsset =
        mediaKind === "video"
          ? await writeClient.assets.upload("file", mediaFile, {
              filename: mediaFile.name,
              contentType: mediaFile.type || "video/webm",
            })
          : await writeClient.assets.upload("image", mediaFile, {
              filename: mediaFile.name,
              contentType: mediaFile.type || "image/webp",
            });
    } else {
      uploadedAsset = {
        _id: preUploadedAssetId,
        url: preUploadedAssetUrl || undefined,
      };
    }

    let uploadedAssetUrl = uploadedAsset.url;

    if (!uploadedAssetUrl) {
      const assetDocument = await writeClient.fetch<{ url?: string } | null>(
        `*[_id == $assetId][0]{url}`,
        { assetId: uploadedAsset._id },
      );
      uploadedAssetUrl = assetDocument?.url;
    }

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
      assetUrl: uploadedAssetUrl,
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
