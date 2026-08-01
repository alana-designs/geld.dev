// Hand-written to match supabase/migrations/0001_init.sql. Regenerate with
// `supabase gen types typescript` once the CLI is linked to the project, and
// this file can be replaced wholesale.

export type ParentCategory = 'Needs' | 'Wants' | 'Savings';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type DeductionPhase = 'pre_tax' | 'post_tax';
export type DeductionTag = 'retirement' | 'other';
export type InviteStatus = 'pending' | 'accepted';

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          email: string;
          color: string;
          onboarded: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          household_id: string;
          name: string;
          email: string;
          color: string;
          onboarded?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          email?: string;
          color?: string;
          onboarded?: boolean;
        };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          invited_by: string;
          email: string;
          name: string | null;
          color: string;
          status: InviteStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          invited_by: string;
          email: string;
          name?: string | null;
          color: string;
          status?: InviteStatus;
          created_at?: string;
        };
        Update: {
          status?: InviteStatus;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          parent: ParentCategory;
          name: string;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          parent: ParentCategory;
          name: string;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          parent?: ParentCategory;
          name?: string;
          archived?: boolean;
        };
        Relationships: [];
      };
      category_goals: {
        Row: {
          id: string;
          category_id: string;
          amount: number;
          effective_month: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          amount: number;
          effective_month: string;
          created_at?: string;
        };
        Update: {
          amount?: number;
          effective_month?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          category_id: string;
          amount: number;
          description: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          category_id: string;
          amount: number;
          description: string;
          date: string;
          created_at?: string;
        };
        Update: {
          category_id?: string;
          amount?: number;
          description?: string;
          date?: string;
        };
        Relationships: [];
      };
      income_sources: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          name: string;
          gross_pay: number;
          frequency: PayFrequency;
          net_override: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          name: string;
          gross_pay: number;
          frequency: PayFrequency;
          net_override?: number | null;
          updated_at?: string;
        };
        Update: {
          name?: string;
          gross_pay?: number;
          frequency?: PayFrequency;
          net_override?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      income_deductions: {
        Row: {
          id: string;
          income_source_id: string;
          phase: DeductionPhase;
          label: string;
          amount: number;
          tag: DeductionTag;
          category_id: string | null;
        };
        Insert: {
          id?: string;
          income_source_id: string;
          phase: DeductionPhase;
          label: string;
          amount: number;
          tag?: DeductionTag;
          category_id?: string | null;
        };
        Update: {
          phase?: DeductionPhase;
          label?: string;
          amount?: number;
          tag?: DeductionTag;
          category_id?: string | null;
        };
        Relationships: [];
      };
      income_tax_lines: {
        Row: {
          id: string;
          income_source_id: string;
          label: string;
          amount: number;
        };
        Insert: {
          id?: string;
          income_source_id: string;
          label: string;
          amount: number;
        };
        Update: {
          label?: string;
          amount?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
