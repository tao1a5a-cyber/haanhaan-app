export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      groups: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
      }
      members: {
        Row: {
          id: string
          group_id: string
          name: string
          avatar_url: string | null
          tint: string | null
          theme_id: string | null
          pin_hash: string | null
          pin_salt: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          avatar_url?: string | null
          tint?: string | null
          theme_id?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          avatar_url?: string | null
          tint?: string | null
          theme_id?: string | null
          pin_hash?: string | null
          pin_salt?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          group_id: string | null
          payer_id: string
          detail: string
          amount: number
          shares: Json
          category_id: string
          split: string
          slip_path: string | null
          settled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          payer_id: string
          detail: string
          amount: number
          shares?: Json
          category_id: string
          split: string
          slip_path?: string | null
          settled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string | null
          payer_id?: string
          detail?: string
          amount?: number
          shares?: Json
          category_id?: string
          split?: string
          slip_path?: string | null
          settled?: boolean
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          group_id: string | null
          recipient_id: string
          from_name: string
          message: string
          tx_id: string | null
          type: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          group_id?: string | null
          recipient_id: string
          from_name: string
          message: string
          tx_id?: string | null
          type: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string | null
          recipient_id?: string
          from_name?: string
          message?: string
          tx_id?: string | null
          type?: string
          read?: boolean
          created_at?: string
        }
      }
      custom_categories: {
        Row: { id: string; label: string; emoji: string; sort_order: number; created_at: string }
        Insert: { id: string; label: string; emoji: string; sort_order: number; created_at?: string }
        Update: { id?: string; label?: string; emoji?: string; sort_order?: number; created_at?: string }
      }
    }
  }
}
