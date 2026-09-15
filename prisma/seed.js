// Seed admin + contoh seri. Jalankan: node prisma/seed.js  (dengan DATABASE_URL terisi)
const { PrismaClient } = require('../web/lib/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@akirareads.local';
  const password = process.env.ADMIN_PASSWORD || 'AkiraAdmin!123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        username: 'admin',
        password: await bcrypt.hash(password, 10),
        role: 'ADMIN',
      },
    });
    console.log(`✅ Admin dibuat: ${email}`);
  } else {
    console.log(`ℹ️  Admin ${email} sudah ada.`);
  }
}

main().finally(() => prisma.$disconnect());
