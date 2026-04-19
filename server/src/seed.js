const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AKIRAREADS database...');

  const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@akirareads.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const hashed        = await bcrypt.hash(adminPassword, 12);

  // Upsert admin — always sync password on deploy
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashed, role: 'ADMIN', username: adminUsername, emailVerified: true },
    create: { email: adminEmail, username: adminUsername, password: hashed, role: 'ADMIN', emailVerified: true },
  });
  console.log(`✅ Admin: ${admin.email} | password: ${adminPassword}`);

  // Fix username conflict
  const conflict = await prisma.user.findFirst({
    where: { username: adminUsername, NOT: { email: adminEmail } },
  });
  if (conflict) {
    await prisma.user.update({ where: { id: conflict.id }, data: { username: adminUsername + '_user' } });
  }

  // Default settings
  for (const s of [
    { key: 'site_name',        value: 'AKIRAREADS' },
    { key: 'site_description', value: 'Platform baca manhwa, manga & manhua terbaik' },
    { key: 'site_logo',        value: '' },
    { key: 'ads_enabled',      value: 'true' },
    { key: 'maintenance_mode', value: 'false' },
  ]) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log('✅ Default settings OK');
  console.log('🎉 Seed selesai!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
