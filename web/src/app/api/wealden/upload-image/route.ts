import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const slotId = formData.get("slotId") as string;

    console.log("[Upload API] Received request:", { fileName: file?.name, slotId });

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!slotId) {
      return NextResponse.json({ error: "No slotId provided" }, { status: 400 });
    }

    // Use consistent filename based on slotId
    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const extension = file.name.split(".").pop();
    const filename = `wealden/${sanitizedSlotId}.${extension}`;

    console.log("[Upload API] Uploading to Vercel Blob:", filename);

    // Delete existing file with same slotId if it exists
    try {
      const { blobs } = await list({ prefix: `wealden/${sanitizedSlotId}` });
      for (const blob of blobs) {
        await del(blob.url);
        console.log("[Upload API] Deleted old blob:", blob.url);
      }
    } catch (err) {
      console.log("[Upload API] No existing blob to delete");
    }

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
    });

    console.log("[Upload API] Upload successful:", blob.url);

    return NextResponse.json({
      ok: true,
      imageUrl: blob.url,
      slotId,
      filename,
    });
  } catch (error) {
    console.error("[Upload API] Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return NextResponse.json({ error: "slotId required" }, { status: 400 });
    }

    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    
    // List blobs with this slotId prefix
    const { blobs } = await list({ prefix: `wealden/${sanitizedSlotId}` });
    
    if (blobs.length > 0) {
      return NextResponse.json({
        image: {
          imageUrl: blobs[0].url,
          slotId,
        },
      });
    }

    return NextResponse.json({ image: null });
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 }
    );
  }
}
