import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function PATCH(req) {
  try {
    const { companyIds, status } = await req.json();
    if (!Array.isArray(companyIds) || !status) {
      return NextResponse.json({ error: "companyIds[] en status vereist" }, { status: 400 });
    }
    await supabaseService.updateCompaniesStatus(companyIds, status);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e?.toString() }, { status: 500 });
  }
} 