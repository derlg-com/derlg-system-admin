const { PrismaClient } = require('@prisma/client');

async function main() {
  try {
    const prisma = new PrismaClient();
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('SUCCESS:', result);
    await prisma.$disconnect();
  } catch (e) {
    console.log('ERROR:', e.message, e.code);
    process.exit(1);
  }
}

main();
