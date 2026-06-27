import { DonateButton } from "@/components/donate-button"

/** "Created by Yomoeyo ☕ สนับสนุน" — shared by the login + group-selection pages. */
export function CreatedByFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex items-center justify-center text-center text-xs text-muted-foreground ${className}`}>
      Created by <span className="ml-1 font-medium">Yomoeyo</span>
      <DonateButton />
    </footer>
  )
}
