// Prisma client — versi generate lokal (worker/generated/prisma) supaya
// Railway rootDir=worker tetap self-contained.
const { PrismaClient } = require('./generated/prisma');

const globalForPrisma = globalThis;
const prisma = globalForPrisma.__akiraPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__akiraPrisma = prisma;

module.exports = prisma;
