/**
 * Creates (or recovers) an admin account for the operator backend.
 *
 * There is deliberately no sign-up page and no "forgot password" for admins:
 * the backend can reach every store, so the only way in is an account someone
 * with database access made. That makes this script the way to bootstrap the
 * first admin, and the way back in if the last one is locked out.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name"
 *   npm run admin:create -- --email you@example.com --password "…" --role owner
 *   npm run admin:create -- --email you@example.com --reset-password
 *
 * With no --password, one is generated and printed once.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      'Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--password …] [--role owner|admin] [--reset-password]',
    );
  }

  const password = arg("password") ?? generatePassword();
  const generated = !arg("password");
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (existing) {
    if (!flag("reset-password")) {
      throw new Error(
        `${email} already exists. Pass --reset-password to set a new password for them.`,
      );
    }
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword(password),
        // Recovering an account that was deactivated or locked out is the
        // whole point of running this, so clear both.
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`Reset the password for ${email}.`);
  } else {
    // The first admin gets to manage other admins; there is nobody else to.
    const isFirst = (await prisma.adminUser.count()) === 0;
    const role = arg("role") ?? (isFirst ? "owner" : "admin");
    if (role !== "owner" && role !== "admin") {
      throw new Error(`Unknown role "${role}". Use "owner" or "admin".`);
    }
    if (password.length < 12) {
      throw new Error("Admin passwords must be at least 12 characters.");
    }

    await prisma.adminUser.create({
      data: {
        email,
        name: arg("name") ?? email,
        role,
        passwordHash: await hashPassword(password),
      },
    });
    console.log(`Created ${role} account ${email}.`);
  }

  if (generated) {
    console.log(`Password: ${password}`);
    console.log("This is the only time it is shown. Store it somewhere safe.");
  }
  console.log("Sign in at /admin/login.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
