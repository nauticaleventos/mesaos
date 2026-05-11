// =====================================================
// mesa.os — Tipos TypeScript del modelo de BD
// =====================================================

export type BaseRole = 'owner' | 'chef' | 'contributor'
export type MemberType = 'adult' | 'child' | 'infant' | 'teen' | 'elder'
export type Goal = 'deficit' | 'deficit_agresivo' | 'mantenimiento' | 'volumen' | 'crecimiento'
export type ActivityLevel = 'sedentary' | 'moderate' | 'active' | 'very_active'
export type TaskType = 'shopping' | 'cooking' | 'fridge_cleanup' | 'fridge_organize' | 'other'
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type PromptContext = 'onboarding' | 'gap_filling' | 'low_rating' | 'weekly' | 'theme'
export type Intensity = 'low' | 'moderate' | 'high'

export interface Family {
  id: string
  name: string
  owner_user_id: string
  healthy_mode_active: boolean
  created_at: string
  updated_at: string
}

export interface FamilyUser {
  id: string
  family_id: string
  user_id: string
  display_name: string
  base_role: BaseRole
  permissions: Record<string, boolean | string[]>
  invited_by_user_id: string | null
  invited_at: string | null
  joined_at: string
  is_active: boolean
  created_at: string
}

export interface FamilyMember {
  id: string
  family_id: string
  name: string
  emoji: string | null
  color: string | null
  member_type: MemberType
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  is_portion_anchor: boolean
  portion_multiplier: number
  goal: Goal | null
  goal_target_weight_kg: number | null
  goal_target_date: string | null
  activity_level: ActivityLevel | null
  calories_default: number | null
  calories_per_day: Record<string, number>
  protein_g_default: number | null
  carbs_g_default: number | null
  fat_g_default: number | null
  conditions: string[]
  allergies: string[]
  prohibited: string[]
  dislikes: string[]
  loves: string[]
  favorite_recipes: string[]   // nombres de platos/recetas favoritas
  restrictions_prep: string[]
  meals_per_day: { name: string; time: string }[]
  eating_style: string
  linked_user_id: string | null
  side_prefs: {
    include_carbs:  boolean
    include_salad:  boolean
    notas:          string
  } | null
  created_at: string
  updated_at: string
}

export interface MemberActivity {
  id: string
  member_id: string
  activity_name: string
  day_of_week: number | null
  time_start: string | null
  duration_minutes: number | null
  intensity: Intensity | null
  calories_burned_estimate: number | null
  created_at: string
}

export interface Task {
  id: string
  family_id: string
  task_type: TaskType
  title: string
  description: string | null
  assigned_to_user_id: string | null
  assigned_by_user_id: string
  due_date: string | null
  due_time: string | null
  related_data: Record<string, unknown>
  status: TaskStatus
  notes: string | null
  created_at: string
  completed_at: string | null
}

export interface NotificationsConfig {
  id: string
  family_id: string
  defrost_hours_before: number
  sleep_start: string
  sleep_end: string
  night_limit: string
  morning_summary_time: string
  routing: Record<string, string[]>
  created_at: string
  updated_at: string
}

// Permisos por rol
export const DEFAULT_PERMISSIONS: Record<BaseRole, Record<string, boolean | string[]>> = {
  owner: {
    menu_view: true, menu_edit: true, menu_generate_ai: true,
    members_manage: true, recipes_view: true, recipes_add: true,
    recipes_rate: true, shopping_list_view: true,
    shopping_list_check: true, shopping_list_receive: true,
    fridge_view: true, fridge_add_photo: true,
    fridge_add_expiry: true, cooking_plan_view: true,
    cooking_mark_done: true, tasks_assigned: ['*'],
    notifications_operational: true, notifications_summary: true,
    permissions_manage: true, invite_users: true,
  },
  chef: {
    menu_view: true, menu_edit: false, menu_generate_ai: false,
    members_manage: false, recipes_view: true, recipes_add: false,
    recipes_rate: false, shopping_list_view: true,
    shopping_list_check: true, shopping_list_receive: true,
    fridge_view: true, fridge_add_photo: true,
    fridge_add_expiry: true, cooking_plan_view: true,
    cooking_mark_done: true, tasks_assigned: [],
    notifications_operational: true, notifications_summary: false,
    permissions_manage: false, invite_users: false,
    can_rate_for_members: false,
  },
  contributor: {
    menu_view: false, menu_edit: false, menu_generate_ai: false,
    members_manage: false, recipes_view: true, recipes_add: true,
    recipes_rate: true, shopping_list_view: false,
    shopping_list_check: false, shopping_list_receive: false,
    fridge_view: false, fridge_add_photo: false,
    fridge_add_expiry: false, cooking_plan_view: false,
    cooking_mark_done: false, tasks_assigned: [],
    notifications_operational: false, notifications_summary: false,
    permissions_manage: false, invite_users: false,
    can_rate_for_members: false,
  },
}
