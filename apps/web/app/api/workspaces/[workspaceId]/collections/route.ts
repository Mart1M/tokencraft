import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/lib/auth/session";
import {
  CollectionOperationError,
  createWorkspaceCollection,
} from "@/lib/workspaces/collection-operations";
import { tokensPagePath } from "@/lib/workspaces/repository-route-utils";

const createSchema = z.object({
  path: z.string().trim().min(1),
  collectionName: z.string().trim().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const session = await getAuthSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { workspaceId } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid collection payload." }, { status: 400 });
  }

  try {
    const result = await createWorkspaceCollection(session.scope, workspaceId, parsed.data);
    revalidatePath(tokensPagePath(workspaceId));
    return NextResponse.json({ ok: true, collection: result.collection });
  } catch (error) {
    if (error instanceof CollectionOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
