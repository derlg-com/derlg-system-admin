const { PrismaClient } = require('@prisma/client');

async function main() {
  try {
    const prisma = new PrismaClient();
    console.log('PrismaClient created successfully');
    await prisma.$disconnect();
  } catch (e) {
    console.log('ERROR:', e.message);
  }
}

main();
