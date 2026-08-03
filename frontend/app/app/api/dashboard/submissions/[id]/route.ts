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

async function getSummary(eventId: string) {
  return writeClient.fetch<{
    total: number;
    pending: number;
    approved: number;
    hidden: number;
    rejected: number;
    recent: Array<{
      _id: string;
      _createdAt: string;
      guestName?: string;
      mediaKind?: "image" | "video";
      status?: string;
      visibleInGallery?: boolean;
      caption?: string;
      image?: { asset?: { url?: string } };
      video?: { asset?: { url?: string } };
    }>;
  }>(
    `{
      "total": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId]),
      "pending": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "pending"]),
      "approved": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "approved"]),
      "hidden": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "hidden"]),
      "rejected": count(*[_type == "mediaSubmission" && weddingEvent._ref == $eventId && status == "rejected"]),
      "recent": *[_type == "mediaSubmission" && weddingEvent._ref == $eventId] | order(_createdAt desc){
        _id,
        _createdAt,
        guestName,
        mediaKind,
        status,
        visibleInGallery,
        caption,
        "image": image{asset->{url}},
        "video": video{asset->{url}}
      }
    }`,
    { eventId },
  );
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
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

  const params = await Promise.resolve(context.params);
  const id = params.id;
  if (!id || id === "undefined") {
    return NextResponse.json(
      { ok: false, error: "Invalid submission id." },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as { action?: string };
    const action = body.action;

    const existing = await writeClient.fetch<{
      _id: string;
      weddingEvent?: { _ref?: string };
    } | null>(
      `*[_type == "mediaSubmission" && _id == $id][0]{_id, weddingEvent}`,
      { id },
    );

    if (!existing?._id || !existing.weddingEvent?._ref) {
      return NextResponse.json(
        { ok: false, error: "Submission not found." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    if (action === "approve") {
      await writeClient
        .patch(id)
        .set({ status: "approved", visibleInGallery: true, approvedAt: now })
        .commit();
    } else if (action === "hide") {
      await writeClient
        .patch(id)
        .set({ status: "hidden", visibleInGallery: false })
        .commit();
    } else if (action === "reject") {
      await writeClient
        .patch(id)
        .set({ status: "rejected", visibleInGallery: false })
        .commit();
    } else if (action === "markVisible") {
      await writeClient.patch(id).set({ visibleInGallery: true }).commit();
    } else {
      return NextResponse.json(
        { ok: false, error: "Unsupported action." },
        { status: 400 },
      );
    }

    const summary = await getSummary(existing.weddingEvent._ref);

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update submission.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
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

  const params = await Promise.resolve(context.params);
  const id = params.id;
  if (!id || id === "undefined") {
    return NextResponse.json(
      { ok: false, error: "Invalid submission id." },
      { status: 400 },
    );
  }

  try {
    const existing = await writeClient.fetch<{
      _id: string;
      weddingEvent?: { _ref?: string };
    } | null>(
      `*[_type == "mediaSubmission" && _id == $id][0]{_id, weddingEvent}`,
      { id },
    );

    if (!existing?._id || !existing.weddingEvent?._ref) {
      return NextResponse.json(
        { ok: false, error: "Submission not found." },
        { status: 404 },
      );
    }

    await writeClient.delete(id);
    const summary = await getSummary(existing.weddingEvent._ref);

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete submission.",
      },
      { status: 500 },
    );
  }
}
