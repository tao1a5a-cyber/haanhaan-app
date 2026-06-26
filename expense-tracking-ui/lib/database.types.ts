export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          user_id: string
          name: string | null
          tint: string | null
          theme_id: string | null
          avatar_url: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          name?: string | null
          tint?: string | null
          theme_id?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
        Update: {
          user_id?: string
          name?: string | null
          tint?: string | null
          theme_id?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          payer_id: string
          detail: string
          amount: number
          owed: number
          category_id: string
          split: string
          note: string | null
          settled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          payer_id: string
          detail: string
          amount: number
          owed: number
          category_id: string
          split: string
          note?: string | null
          settled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          payer_id?: string
          detail?: string
          amount?: number
          owed?: number
          category_id?: string
          split?: string
          note?: string | null
          settled?: boolean
          created_at?: string
        }
      }
      custom_categories: {
        Row: {
          id: string
          label: string
          emoji: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id: string
          label: string
          emoji: string
          sort_order: number
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          emoji?: string
          sort_order?: number
          created_at?: string
        }
      }
    }
  }
}
