import { tryGetSupabase } from "./supabase"

export const AVATAR_BUCKET = "avatars"
export const SLIP_BUCKET = "slips"

/**
 * Crop image file to a circle, resize to 400×400, return as Blob.
 * Runs in the browser (requires Canvas API).
 */
export function cropToCircle(file: File, outputSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = outputSize
      canvas.height = outputSize
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("canvas 2d not available")); return }

      // Clip to circle
      ctx.beginPath()
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
      ctx.clip()

      // Center-crop source image
      const size = Math.min(img.width, img.height)
      const sx = (img.width - size) / 2
      const sy = (img.height - size) / 2
      ctx.drawImage(img, sx, sy, size, size, 0, 0, outputSize, outputSize)

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
        "image/png",
        0.92,
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Upload a cropped avatar blob and return its public URL. */
export async function uploadAvatar(
  userId: string,
  blob: Blob,
): Promise<string | null> {
  const path = `${userId}/${Date.now()}.png`
  const db = tryGetSupabase()
  if (!db) return null
  const { error } = await db.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: "image/png", upsert: true })

  if (error) { console.error("uploadAvatar", error); return null }

  const { data } = db.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Upload a payment-slip image and return its path (use signed URL to display). */
export async function uploadSlip(
  transactionId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg"
  const path = `${transactionId}.${ext}`
  const db = tryGetSupabase()
  if (!db) return null
  const { error } = await db.storage
    .from(SLIP_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true })

  if (error) { console.error("uploadSlip", error); return null }
  return path
}

/** Get a short-lived signed URL for a private slip (1 hour). */
export async function getSlipUrl(path: string): Promise<string | null> {
  const db = tryGetSupabase()
  if (!db) return null

  const { data, error } = await db.storage
    .from(SLIP_BUCKET)
    .createSignedUrl(path, 3600)

  if (error) { console.error("getSlipUrl", error); return null }
  return data.signedUrl
}
