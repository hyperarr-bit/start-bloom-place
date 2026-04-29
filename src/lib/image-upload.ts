import { supabase } from "@/integrations/supabase/client";

/**
 * Compress an image File/Blob using a canvas, downscaling to a max dimension
 * and re-encoding as WebP. Drastically reduces size for photos that would
 * otherwise be stored as multi-megabyte base64 strings.
 */
export async function compressImage(
  file: Blob,
  maxDim = 1280,
  quality = 0.82
): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob || file),
      "image/webp",
      quality
    );
  });
}

/**
 * Upload an image to a Supabase Storage bucket under the user's folder.
 * Returns a signed URL (1 year) ready to be persisted in user_data.
 *
 * Path format: `{userId}/{subfolder}/{timestamp}-{random}.webp`
 */
export async function uploadImage(
  bucket: string,
  file: Blob,
  subfolder = "general"
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const compressed = await compressImage(file);
  const fileName = `${user.id}/${subfolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(fileName, compressed, { contentType: "image/webp", upsert: false });
  if (upErr) {
    console.error("[image-upload] failed:", upErr);
    return null;
  }

  // Long-lived signed URL (1 year) — bucket is private.
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, 60 * 60 * 24 * 365);

  return signed?.signedUrl || null;
}

/**
 * Convenience handler for <input type="file"> events.
 */
export async function uploadFromInput(
  e: React.ChangeEvent<HTMLInputElement>,
  bucket: string,
  subfolder = "general"
): Promise<string | null> {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return null;
  return await uploadImage(bucket, file, subfolder);
}

/**
 * Detect base64 data URL strings — used to flag legacy images that need migration.
 */
export const isBase64Image = (s: unknown): boolean =>
  typeof s === "string" && s.startsWith("data:image/");

/**
 * Migrate a base64 data URL to Supabase Storage. Returns the signed URL or
 * null if it failed (caller should keep the original in that case).
 */
export async function migrateBase64ToStorage(
  base64: string,
  bucket: string,
  subfolder = "migrated"
): Promise<string | null> {
  try {
    const res = await fetch(base64);
    const blob = await res.blob();
    return await uploadImage(bucket, blob, subfolder);
  } catch (e) {
    console.error("[migrate-base64] failed:", e);
    return null;
  }
}
