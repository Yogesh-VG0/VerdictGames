/**
 * Generate favicon and app icon variants from the main logo.
 *
 * Crops to the controller-only region (no stand/base), places it centered
 * on a dark background for Apple/PWA icons, and outputs all required sizes.
 *
 * Usage: node scripts/generate-icons.mjs
 * Requires: sharp (npm install --save-dev sharp)
 */

import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_APP = path.join(ROOT, "src", "app");
const PUBLIC = path.join(ROOT, "public");
const LOGO = path.join(PUBLIC, "VERDICT_LOGO_main.png");

// Brand dark background color
const BG_COLOR = { r: 3, g: 7, b: 18, alpha: 1 }; // #030712

async function main() {
  console.log("🎮 Generating icon variants from logo...\n");

  // Read the source logo and get its metadata
  const meta = await sharp(LOGO).metadata();
  console.log(`Source: ${meta.width}x${meta.height} ${meta.format}`);

  // Step 1: Crop to controller-only region (top portion, excluding the stand/base)
  // First trim the logo to get content bounds, then crop top ~68% to exclude the stand
  const trimmed = await sharp(LOGO).trim().toBuffer();
  const trimmedMeta = await sharp(trimmed).metadata();
  console.log(`Trimmed: ${trimmedMeta.width}x${trimmedMeta.height}`);

  // Take the top 68% of the trimmed image (controller without stand)
  const controllerHeight = Math.round(trimmedMeta.height * 0.68);
  const controllerCrop = await sharp(trimmed)
    .extract({ left: 0, top: 0, width: trimmedMeta.width, height: controllerHeight })
    .trim()
    .toBuffer();

  // Step 2: Generate transparent icon (for favicon/browser tab)
  // Place controller centered on a square transparent canvas
  const transparentIcon = async (size) => {
    const resized = await sharp(controllerCrop)
      .resize(Math.round(size * 0.78), Math.round(size * 0.78), { fit: "inside" })
      .toBuffer();
    const resizedMeta = await sharp(resized).metadata();
    const left = Math.round((size - resizedMeta.width) / 2);
    const top = Math.round((size - resizedMeta.height) / 2);
    return sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toBuffer();
  };

  // Step 3: Generate opaque icon (for Apple touch / PWA / maskable)
  const opaqueIcon = async (size, padding = 0.15) => {
    const innerSize = Math.round(size * (1 - padding * 2));
    const resized = await sharp(controllerCrop)
      .resize(innerSize, innerSize, { fit: "inside" })
      .toBuffer();
    const resizedMeta = await sharp(resized).metadata();
    const left = Math.round((size - resizedMeta.width) / 2);
    const top = Math.round((size - resizedMeta.height) / 2);
    return sharp({
      create: { width: size, height: size, channels: 4, background: BG_COLOR },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toBuffer();
  };

  // Generate all sizes
  const icon32 = await transparentIcon(32);
  const icon48 = await transparentIcon(48);
  const icon192 = await transparentIcon(192);
  const icon512 = await transparentIcon(512);
  const apple180 = await opaqueIcon(180);
  const maskable512 = await opaqueIcon(512, 0.20); // extra padding for safe zone

  // Write files
  // favicon.ico — we'll use a 32x32 PNG since most modern browsers support PNG favicons
  // For true .ico with multiple sizes, we'd need a separate tool, but a 48x48 PNG works well
  fs.writeFileSync(path.join(SRC_APP, "icon.png"), icon512);
  console.log("✅ src/app/icon.png (512x512 transparent)");

  fs.writeFileSync(path.join(SRC_APP, "apple-icon.png"), apple180);
  console.log("✅ src/app/apple-icon.png (180x180 opaque)");

  // For favicon.ico, use a 48x48 PNG — Next.js will serve it correctly
  fs.writeFileSync(path.join(SRC_APP, "favicon.ico"), icon48);
  console.log("✅ src/app/favicon.ico (48x48)");

  fs.writeFileSync(path.join(PUBLIC, "icon-192.png"), icon192);
  console.log("✅ public/icon-192.png (192x192 transparent)");

  fs.writeFileSync(path.join(PUBLIC, "icon-512.png"), icon512);
  console.log("✅ public/icon-512.png (512x512 transparent)");

  fs.writeFileSync(path.join(PUBLIC, "icon-maskable-512.png"), maskable512);
  console.log("✅ public/icon-maskable-512.png (512x512 opaque, maskable safe zone)");

  // Also generate a 32x32 for good measure
  fs.writeFileSync(path.join(PUBLIC, "icon-32.png"), icon32);
  console.log("✅ public/icon-32.png (32x32 transparent)");

  console.log("\n🎉 All icons generated successfully!");
  console.log("Now update src/app/layout.tsx and public/manifest.json.");
}

main().catch((err) => {
  console.error("❌ Icon generation failed:", err);
  process.exit(1);
});
