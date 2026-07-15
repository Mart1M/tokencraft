import { NextResponse } from "next/server";

import { openNativeFolderDialog } from "@/lib/tokens/native-dialog";

export async function POST() {
  const path = await openNativeFolderDialog();
  return NextResponse.json({ path });
}
