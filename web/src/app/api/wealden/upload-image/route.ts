import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Store in public/wealden/ (we're already in the web directory)
    const uploadDir = join(process.cwd(), "public/wealden");
    console.log("[Upload API] Upload directory:", uploadDir);
    
    if (!existsSync(uploadDir)) {
      console.log("[Upload API] Creating directory...");
      await mkdir(uploadDir, { recursive: true });
    }

    // Use consistent filename based on slotId (replace existing if present)
    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const extension = file.name.split(".").pop();
    const filename = `${sanitizedSlotId}.${extension}`;
    const filepath = join(uploadDir, filename);

    console.log("[Upload API] Writing file:", filepath);
    
    // Save file (overwrites existing)
    await writeFile(filepath, buffer);

    console.log("[Upload API] File written successfully");

    // Return the public path (relative to web/public)
    const publicUrl = `/wealden/${filename}`;

    return NextResponse.json({
      ok: true,
      imageUrl: publicUrl,
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

    // Check if image exists for this slotId
    const uploadDir = join(process.cwd(), "public/wealden");
    if (!existsSync(uploadDir)) {
      return NextResponse.json({ image: null });
    }

    const { readdir } = await import("fs/promises");
    const files = await readdir(uploadDir);
    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    
    // Find file that matches this slotId
    const matchingFile = files.find(f => f.startsWith(sanitizedSlotId + "."));
    
    if (matchingFile) {
      return NextResponse.json({
        image: {
          imageUrl: `/wealden/${matchingFile}`,
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
