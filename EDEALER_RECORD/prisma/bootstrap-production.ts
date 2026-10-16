/**
 * One-off bootstrap for a NEW production database (run after `prisma migrate deploy`). Idempotent:
 * running it again changes nothing that already exists.
 *
 *  1. Creates the platform super-admin from the BOOTSTRAP_ADMIN_* variables. When that e-mail already
 *     belongs to a super-admin, it is kept (its password is only replaced with
 *     BOOTSTRAP_ADMIN_RESET_PASSWORD=true). When it belongs to an ordinary account — which anyone can
 *     register on the public site — the script stops, unless BOOTSTRAP_ADMIN_PROMOTE_EXISTING=true;
 *     a promoted account always gets the new password, and accounts linked to a dealer or agent firm
 *     are never promoted.
 *  2. Adds the default master document categories (RC, Insurance, PUC, Owner ID) when the table is
 *     still empty. The super-admin manages them afterwards (Document Categories page).
 *
 * Geography lookups (states + cities) are seeded separately: `npx tsx prisma/seed-geography.ts`.
 * Never run `prisma/seed.ts` in production: it creates demo accounts with known passwords.
 *
 * Variables: DATABASE_URL, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+ characters),
 * BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_MOBILE, optional BOOTSTRAP_ADMIN_RESET_PASSWORD,
 * optional BOOTSTRAP_ADMIN_PROMOTE_EXISTING, optional BCRYPT_SALT_ROUNDS (default 12).
 *
 * Run: npx tsx prisma/bootstrap-production.ts   (deploy/scripts/bootstrap.sh runs it on the server)
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Master document categories offered to dealers and agents in the create-process wizard. */
const DEFAULT_UPLOAD_CATEGORIES = [
  { categoryName: 'RC', bothSide: true },
  { categoryName: 'Insurance', bothSide: false },
  { categoryName: 'PUC', bothSide: false },
  { categoryName: 'Owner ID', bothSide: false },
];

/** Reads a required variable, failing with a clear message when it is missing or empty. */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function ensureSuperAdmin(): Promise<void> {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const name = required('BOOTSTRAP_ADMIN_NAME');
  const mobile = required('BOOTSTRAP_ADMIN_MOBILE');
  const resetPassword = process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD === 'true';
  const promoteExisting = process.env.BOOTSTRAP_ADMIN_PROMOTE_EXISTING === 'true';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('BOOTSTRAP_ADMIN_EMAIL is not an e-mail address');
  if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  if (mobile.length > 20) throw new Error('BOOTSTRAP_ADMIN_MOBILE must be at most 20 characters');

  const existing = await prisma.user.findUnique({ where: { emailId: email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        userName: name,
        emailId: email,
        password: await bcrypt.hash(password, saltRounds),
        mobileNo: mobile,
        emailVerified: true,
        isSuperAdmin: true,
      },
    });
    console.log(`Created super-admin ${email}`);
    return;
  }

  if (existing.isSuperAdmin) {
    await prisma.user.update({
      where: { userId: existing.userId },
      data: {
        emailVerified: true,
        ...(resetPassword ? { password: await bcrypt.hash(password, saltRounds) } : {}),
      },
    });
    console.log(
      `Super-admin ${email} already existed: kept${resetPassword ? ', password replaced' : ' (password unchanged)'}`,
    );
    return;
  }

  // An ordinary account with this e-mail: anyone can register one on the public site, so promoting it
  // silently could hand super-admin rights to a stranger who chose its password.
  if (!promoteExisting) {
    throw new Error(
      `${email} already belongs to an ordinary account. If it is yours, run again with ` +
        'BOOTSTRAP_ADMIN_PROMOTE_EXISTING=true (its password is then replaced), or use another e-mail.',
    );
  }
  const [dealerLink, agentLink] = await Promise.all([
    prisma.dealerWiseUser.findUnique({ where: { userId: existing.userId } }),
    prisma.agentWiseUser.findUnique({ where: { userId: existing.userId } }),
  ]);
  if (dealerLink || agentLink) {
    throw new Error(`${email} is a dealer or agent account; use another e-mail for the super-admin`);
  }
  await prisma.user.update({
    where: { userId: existing.userId },
    data: {
      emailVerified: true,
      isSuperAdmin: true,
      password: await bcrypt.hash(password, saltRounds),
    },
  });
  console.log(`Promoted the existing account ${email} to verified super-admin with the new password`);
}

async function ensureUploadCategories(): Promise<void> {
  const count = await prisma.uploadCategory.count();
  if (count > 0) {
    console.log(`Document categories already exist (${count}); left unchanged`);
    return;
  }
  for (const [index, category] of DEFAULT_UPLOAD_CATEGORIES.entries()) {
    await prisma.uploadCategory.create({ data: { ...category, orderRank: index + 1 } });
  }
  console.log(`Added ${DEFAULT_UPLOAD_CATEGORIES.length} default document categories`);
}

async function main(): Promise<void> {
  await ensureSuperAdmin();
  await ensureUploadCategories();
}

main()
  .catch((err: unknown) => {
    console.error(`Bootstrap failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
