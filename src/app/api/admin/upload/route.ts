import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getDeliveryTransformation(assetType: string | null) {
  switch (assetType) {
    case "header_image":
      return [
        { width: 1920, height: 1080, crop: "fill", gravity: "auto" },
        { quality: "auto:good", fetch_format: "auto" },
      ];
    case "cover_image":
      return [
        { width: 600, height: 900, crop: "fill", gravity: "auto" },
        { quality: "auto:good", fetch_format: "auto" },
      ];
    case "screenshot":
      return [
        { width: 1600, crop: "limit" },
        { quality: "auto:good", fetch_format: "auto" },
      ];
    default:
      return [
        { quality: "auto:good", fetch_format: "auto" },
      ];
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "verdict-games";
    const gameSlug = formData.get("gameSlug") as string | null;
    const assetType = (formData.get("assetType") as string | null) ?? null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Validate file size (max 4MB to stay under Vercel's 4.5MB serverless limit)
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size: 4MB. Please compress the image or use a smaller file." },
        { status: 400 }
      );
    }

    // Convert file to base64 for Cloudinary upload
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // Generate a public_id based on game slug and timestamp
    const timestamp = Date.now();
    const publicId = gameSlug 
      ? `${folder}/${gameSlug}/${timestamp}`
      : `${folder}/${timestamp}`;

    const transformation = getDeliveryTransformation(assetType);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      folder: undefined, // Already included in public_id
      resource_type: "image",
      transformation,
    });

    const optimizedUrl = cloudinary.url(result.public_id, {
      secure: true,
      resource_type: "image",
      type: "upload",
      transformation,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: optimizedUrl,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    console.error("[Admin Upload] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
