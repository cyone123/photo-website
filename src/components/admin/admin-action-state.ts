export interface AdminActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface AdminMutationState extends AdminActionState {
  coverPhotoId?: string | null;
  albumStatus?: "DRAFT" | "PUBLISHED";
}

export const INITIAL_ADMIN_ACTION_STATE: AdminActionState = {
  status: "idle",
  message: "",
};
