import { NextResponse } from "next/server";
import { getListContext } from "@/lib/data/list";
import { buildExportCsv } from "@/lib/export";

// "Export my data": every person and gift you can see, on every list you're on.
// Always available, whatever your plan. Uses your own login, so security rules apply.
export async function GET() {
  const ctx = await getListContext();
  const lists = await Promise.all(
    ctx.lists.map(async (list) => {
      const [{ data: recipients }, { data: gifts }] = await Promise.all([
        ctx.supabase.from("recipients").select("*").eq("list_id", list.id).order("name"),
        ctx.supabase.from("gifts").select("*").eq("list_id", list.id).order("created_at"),
      ]);
      return { name: list.label, recipients: recipients ?? [], gifts: gifts ?? [] };
    }),
  );
  const csv = buildExportCsv(lists);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="giftledger-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
