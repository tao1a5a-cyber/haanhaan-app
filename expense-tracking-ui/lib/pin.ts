/** Hash a PIN using SHA-256 + user-id salt via the Web Crypto API. */
export async function hashPin(pin: string, userId: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${userId}:${pin}`)
  const buffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function verifyPin(
  entered: string,
  storedHash: string,
  userId: string,
): Promise<boolean> {
  const hash = await hashPin(entered, userId)
  return hash === storedHash
}
