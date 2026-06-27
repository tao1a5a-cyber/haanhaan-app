export type AppNotification = {
  id: string
  /** group this notification belongs to */
  groupId?: string
  /** member id who should see it */
  recipientId: string
  fromName: string
  message: string
  txId?: string
  type: "add" | "edit" | "delete"
  ts: number
  read: boolean
}
