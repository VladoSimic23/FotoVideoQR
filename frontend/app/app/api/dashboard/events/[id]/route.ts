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
      { ok: false, error: "Invalid event id." },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as { guestUploadEnabled?: boolean };
    if (typeof body.guestUploadEnabled !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "guestUploadEnabled must be a boolean." },
        { status: 400 },
      );
    }

    const updated = await writeClient
      .patch(id)
      .set({ guestUploadEnabled: body.guestUploadEnabled })
      .commit({ returnDocuments: true });

    return NextResponse.json({
      ok: true,
      guestUploadEnabled:
        updated?.guestUploadEnabled ?? body.guestUploadEnabled,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update event settings.",
      },
      { status: 500 },
    );
  }
}
