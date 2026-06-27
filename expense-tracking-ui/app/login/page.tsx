import Image from "next/image"
import { LoginButton } from "@/components/login-button"
import { GuestAccess } from "@/components/guest-access"
import { CreatedByFooter } from "@/components/created-by-footer"

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      {/* soft warm blobs for a friendly backdrop */}
      <div className="pointer-events-none absolute -top-24 -left-20 size-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="grid size-20 place-items-center rounded-3xl bg-card shadow-sm ring-1 ring-border">
            <Image src="/logo.png" alt="HaanHaan" width={56} height={56} className="size-14 object-contain" priority />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">HaanHaan</h1>
          <p className="mt-1 text-base font-medium text-foreground/80">
            หารค่าใช้จ่าย หารความสบายใจ
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            จัดการเงินครบ จบทั้งเรื่องส่วนตัวและเรื่องกลุ่ม
          </p>
        </div>

        {/* Sign-in card */}
        <div className="mt-8 rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border">
          <LoginButton />
        </div>

        {/* Guest mode + Room Code entry */}
        <GuestAccess />

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
          การเข้าสู่ระบบถือว่ายอมรับเงื่อนไขการใช้งาน
        </p>
      </div>

      <CreatedByFooter className="mt-10 mb-6 sm:mb-8" />
    </main>
  )
}
