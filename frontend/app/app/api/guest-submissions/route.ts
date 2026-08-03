import { createClient } from "@sanity/client";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

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

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    process.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    process.on("error", (error) => {
      reject(error);
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Command failed (${code ?? "unknown"}). ${stderr || "No stderr."}`,
        ),
      );
    });
  });
}

async function transcodeToCompatMp4(sourceUrl: string, sourceName?: string) {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available on this server.");
  }

  const sourceResponse = await fetch(sourceUrl, { cache: "no-store" });
  if (!sourceResponse.ok) {
    throw new Error(
      `Failed to download source video for compatibility transcode (${sourceResponse.status}).`,
    );
  }

  const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fvq-video-"));
  const inputPath = path.join(tempDir, "input-video");
  const outputPath = path.join(tempDir, "output-compat.mp4");

  try {
    await fs.writeFile(inputPath, sourceBuffer);

    await runCommand(ffmpegPath, [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-profile:v",
      "baseline",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      outputPath,
    ]);

    const outputBuffer = await fs.readFile(outputPath);
    const baseName = sourceName?.replace(/\.[^.]+$/, "") || "guest-video";

    const compatAsset = await writeClient.assets.upload("file", outputBuffer, {
      filename: `${baseName}-compat.mp4`,
      contentType: "video/mp4",
    });

    return compatAsset;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
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
      `*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status in ["pending", "approved", "published"]] | order(_createdAt desc){
        _id,
        _createdAt,
        mediaKind,
        durationSeconds,
        status,
        guestName,
        caption,
        "image": image{asset->{url}},
        "video": coalesce(videoCompat, video){asset->{url}}
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
    let compatVideoAsset: { _id: string; url?: string } | null = null;
    let compatibilityWarning: string | undefined;

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

    if (mediaKind === "video") {
      if (!uploadedAssetUrl) {
        return NextResponse.json(
          {
            ok: false,
            error: "Uploaded video asset URL is missing.",
          },
          { status: 500 },
        );
      }

      try {
        const compatAsset = await transcodeToCompatMp4(
          uploadedAssetUrl,
          mediaFile?.name,
        );
        compatVideoAsset = {
          _id: compatAsset._id,
          url: compatAsset.url,
        };
      } catch (transcodeError) {
        compatibilityWarning =
          transcodeError instanceof Error
            ? `Compatibility transcode failed: ${transcodeError.message}`
            : "Compatibility transcode failed.";
      }
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
      videoCompat:
        mediaKind === "video" && compatVideoAsset
          ? {
              _type: "file",
              asset: {
                _type: "reference",
                _ref: compatVideoAsset._id,
              },
            }
          : undefined,
    });

    const playbackAssetUrl = compatVideoAsset?.url || uploadedAssetUrl;

    return NextResponse.json({
      ok: true,
      submissionId: submission._id,
      status,
      visibleInGallery,
      assetUrl: playbackAssetUrl,
      moderationMode,
      compatibilityWarning,
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
