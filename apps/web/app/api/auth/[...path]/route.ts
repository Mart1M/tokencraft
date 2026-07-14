import { auth } from "@/lib/auth/neon";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
