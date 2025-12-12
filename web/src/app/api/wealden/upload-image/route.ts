import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const slotId = formData.get("slotId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!slotId) {
      return NextResponse.json({ error: "No slotId provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), "public", "wealden-uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Use consistent filename based on slotId (replace existing if present)
    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const extension = file.name.split(".").pop();
    const filename = `${sanitizedSlotId}.${extension}`;
    const filepath = join(uploadDir, filename);

    // Save file (overwrites existing)
    await writeFile(filepath, buffer);

    // Return the public path
    const publicPath = `/wealden-uploads/${filename}`;

    return NextResponse.json({
      ok: true,
      imageUrl: publicPath,
      slotId,
      filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
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
    const uploadDir = join(process.cwd(), "public", "wealden-uploads");
    if (!existsSync(uploadDir)) {
      return NextResponse.json({ image: null });
    }

    const files = await readdir(uploadDir);
    const sanitizedSlotId = slotId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    
    // Find file that matches this slotId
    const matchingFile = files.find(f => f.startsWith(sanitizedSlotId + "."));
    
    if (matchingFile) {
      return NextResponse.json({
        image: {
          imageUrl: `/wealden-uploads/${matchingFile}`,
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
