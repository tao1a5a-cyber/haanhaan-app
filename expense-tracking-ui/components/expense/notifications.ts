export type AppNotification = {
  id: string
  recipientId: string
  fromName: string
  message: string
  txId?: string
  type: "add" | "edit" | "delete"
  ts: number
  read: boolean
}
