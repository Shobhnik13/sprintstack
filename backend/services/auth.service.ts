import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema/users.ts";
import { signToken } from "../utils/jwt.ts";
import { AppError } from "../types/index.ts";

const PUBLIC_FIELDS = {
  id: users.id,
  email: users.email,
  display_name: users.display_name,
  avatar_url: users.avatar_url,
  created_at: users.created_at,
} as const;

export async function register(email: string, password: string, displayName: string) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) throw new AppError(409, "email_taken");

  const password_hash = await bcrypt.hash(password, 12);
  const inserted = await db
    .insert(users)
    .values({ email, display_name: displayName, password_hash })
    .returning(PUBLIC_FIELDS);

  return inserted[0]!;
}

export async function login(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, "invalid_credentials");
  }

  const token = signToken({ userId: user.id, email: user.email });
  const { password_hash: _, ...publicUser } = user;
  return { token, user: publicUser };
}
