// Hesap silme — hane senaryosu karar motoru (saf). delete-account Edge Function uygular.
export type DeletionAction =
  | "remove_membership" // yalnız üye: üyeliği kaldır
  | "delete_household_and_data" // owner + tek üye: hane ve ilişkili kayıtlar silinir
  | "transfer_then_remove" // owner + başka üye var + geçerli yeni owner seçildi
  | "needs_replacement_owner"; // owner + başka üye var + geçerli yeni owner YOK

export interface DeletionContext {
  isOwner: boolean;
  otherMemberCount: number; // kullanıcı dışındaki hane üye sayısı
  replacementOwnerMemberId?: string | null;
  replacementIsActiveMember?: boolean; // seçilen yeni owner bu hanenin aktif üyesi mi
  replacementIsSelf?: boolean; // seçilen yeni owner kullanıcının kendisi olamaz
}

export interface DeletionResolution {
  action: DeletionAction;
  ok: boolean;
  error?: string;
}

export function resolveDeletion(ctx: DeletionContext): DeletionResolution {
  if (!ctx.isOwner) {
    return { action: "remove_membership", ok: true };
  }
  if (ctx.otherMemberCount <= 0) {
    return { action: "delete_household_and_data", ok: true };
  }
  // Owner ve başka üyeler var → geçerli yeni owner şart.
  const valid =
    !!ctx.replacementOwnerMemberId &&
    ctx.replacementIsActiveMember === true &&
    ctx.replacementIsSelf !== true;
  if (!valid) {
    return {
      action: "needs_replacement_owner",
      ok: false,
      error: "Hane sahipliğini devralacak bir üye seçmelisin.",
    };
  }
  return { action: "transfer_then_remove", ok: true };
}
