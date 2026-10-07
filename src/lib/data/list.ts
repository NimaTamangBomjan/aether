import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

export const ACTIVE_LIST_COOKIE = "gl_list";

type Role = Database["public"]["Enums"]["member_role"];

export type ListContext = Awaited<ReturnType<typeof loadListContext>>;

async function loadListContext() {
  // Signed-out visitors never get here: the proxy sends them to sign in with the right return path.
  const { supabase, userId, email } = await requireUser("/app");
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_LIST_COOKIE)?.value;

  const [{ data: memberships, error }, { data: profile }] = await Promise.all([
    supabase
      .from("list_members")
      .select("role, joined_at, lists(id, name, overall_budget_cents)")
      .eq("user_id", userId)
      .order("joined_at"),
    supabase.from("profiles").select("display_name, time_zone, onboarded_at, email_reminders").eq("id", userId).single(),
  ]);
  if (error) throw error;

  const lists = await Promise.all(
    (memberships ?? [])
      .filter((m) => m.lists)
      .map(async (m) => {
        const list = { ...m.lists!, role: m.role as Role, label: m.lists!.name };
        if (m.role === "member") {
          const { data: people } = await supabase.rpc("list_member_names", { p_list: list.id });
          const owner = people?.find((p) => p.role === "owner")?.display_name;
          if (owner) list.label = `${owner}'s ${list.name}`;
        } else {
          list.label = `${list.name} (mine)`;
        }
        return list;
      }),
  );
  const active =
    lists.find((l) => l.id === preferred) ?? lists.find((l) => l.role === "owner") ?? lists[0];
  if (!active) throw new Error("No list found for this account");

  const { data: plan } = await supabase.rpc("list_plan", { p_list: active.id });
  const planRow = plan?.[0];

  return {
    supabase,
    userId,
    email,
    profile: profile ?? { display_name: "", time_zone: "America/New_York", onboarded_at: null, email_reminders: true },
    list: active,
    role: active.role,
    isOwner: active.role === "owner",
    lists,
    hasPass: planRow?.has_pass ?? false,
    recipientCount: planRow?.recipient_count ?? 0,
    memberCount: planRow?.member_count ?? 0,
  };
}

/** The signed-in person, the list they're looking at, their role on it and the list's plan. */
export const getListContext = cache(loadListContext);

/** Everyone on the list who the viewer can see, and every gift on it the viewer is allowed to see. */
export async function getListData(ctx: ListContext) {
  const [{ data: recipients, error: rError }, { data: gifts, error: gError }] = await Promise.all([
    ctx.supabase.from("recipients").select("*").eq("list_id", ctx.list.id).order("name"),
    ctx.supabase.from("gifts").select("*").eq("list_id", ctx.list.id).order("created_at"),
  ]);
  if (rError) throw rError;
  if (gError) throw gError;
  return { recipients: recipients ?? [], gifts: gifts ?? [] };
}
