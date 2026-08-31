// Hand-written to match supabase/migrations/0001_init.sql. Regenerate with
// `supabase gen types typescript` once the CLI is linked to the project, and
// this file can be replaced wholesale.

export type ParentCategory = 'Needs' | 'Wants' | 'Savings';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type PayType = 'salaried' | 'hourly';
export type SemimonthlySchedule = '1st_15th' | '15th_last';
export type TransactionSource = 'manual' | 'auto';
export type DeductionPhase = 'pre_tax' | 'post_tax';
export type DeductionTag = 'retirement' | 'other';
/** pending: sent · accepted: invitee said yes, nothing shared yet · confirmed: inviter verified, member joined */
export type InviteStatus = 'pending' | 'accepted' | 'confirmed';

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
          expires_at: string;
          accepted_by: string | null;
          accepted_at: string | null;
        };
        /** Inserts go through send_household_invite() — the table grant is revoked. */
        Insert: never;
        /** Status transitions go through the accept/confirm functions. */
        Update: never;
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
          recurring: boolean;
          source: TransactionSource;
          income_deduction_id: string | null;
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
          recurring?: boolean;
          created_at?: string;
        };
        Update: {
          category_id?: string;
          amount?: number;
          description?: string;
          date?: string;
          recurring?: boolean;
        };
        Relationships: [];
      };
      income_sources: {
        Row: {
          id: string;
          user_id: string;
          household_id: string;
          name: string;
          pay_type: PayType;
          gross_pay: number;
          frequency: PayFrequency | null;
          paycheck_date: string | null;
          semimonthly_schedule: SemimonthlySchedule | null;
          net_override: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          household_id: string;
          name: string;
          pay_type?: PayType;
          gross_pay: number;
          frequency?: PayFrequency | null;
          paycheck_date?: string | null;
          semimonthly_schedule?: SemimonthlySchedule | null;
          net_override?: number | null;
          updated_at?: string;
        };
        Update: {
          name?: string;
          pay_type?: PayType;
          gross_pay?: number;
          frequency?: PayFrequency | null;
          paycheck_date?: string | null;
          semimonthly_schedule?: SemimonthlySchedule | null;
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
    Functions: {
      /** Creates the caller's profile if it's missing. Idempotent; see migration 0009. */
      ensure_profile: {
        Args: never;
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      /** Invitee says yes. Records intent only — shares nothing until confirmed. */
      accept_household_invite: {
        Args: { p_invite_id: string };
        Returns: string;
      };
      goal_for_month: {
        Args: { p_category_id: string; p_month: string };
        Returns: number;
      };
      /** Inviter verifies the address that accepted. This is the step that moves them. */
      confirm_household_member: { Args: { p_invite_id: string }; Returns: string };
      decline_household_member: { Args: { p_invite_id: string }; Returns: void };
      send_household_invite: {
        Args: { p_email: string; p_name?: string | null };
        Returns: Database['public']['Tables']['household_invites']['Row'];
      };
      leave_household: { Args: never; Returns: string };
      remove_household_member: { Args: { p_user_id: string }; Returns: void };
      my_email: { Args: never; Returns: string };
      my_household_id: { Args: never; Returns: string };
      my_pending_invites: {
        Args: never;
        Returns: {
          invite_id: string;
          inviter_name: string;
          inviter_email: string;
          household_size: number;
          expires_at: string;
        }[];
      };
      pending_member_confirmations: {
        Args: never;
        Returns: {
          invite_id: string;
          invited_email: string;
          accepted_name: string;
          accepted_email: string;
          accepted_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
