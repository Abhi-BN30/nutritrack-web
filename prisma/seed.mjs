import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed NutriTrack.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const foods = [
  ["Butter", 0, 0.8, 80, 717],
  ["Coconut oil", 0, 0, 100, 862],
  ["Cauliflower", 8, 6, 1, 66],
  ["Onion Big", 11.5, 1.4, 0, 50.7],
  ["Ghee", 0, 0, 100, 875],
  ["Lo Food Roti - Yellow", 10, 10, 2, 150],
  ["Eggs", 0.6, 12.6, 9, 135],
  ["Tofu", 6, 16, 6, 136],
  ["Capsicum", 5.2, 0, 0, 23.7],
  ["Lime", 9.5, 0, 0, 57],
  ["Greek Yogurt", 3.6, 10, 0.4, 59],
  ["Paneer", 3.4, 18.3, 20.8, 265],
];

function startOfDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function upsertUser({ email, mobileNumber, pin, name, role }) {
  if (!email || !mobileNumber || !pin || !name) {
    return;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      mobileNumber,
      startDate: startOfDay(new Date()),
      pinHash: await bcrypt.hash(pin, 10),
    },
    create: {
      email,
      mobileNumber,
      name,
      role,
      startDate: startOfDay(new Date()),
      pinHash: await bcrypt.hash(pin, 10),
    },
  });

  await prisma.nutritionTarget.upsert({
    where: {
      userId_effectiveFrom: {
        userId: user.id,
        effectiveFrom: startOfDay(new Date()),
      },
    },
    update: {
      targetCarbs: 80,
      targetProteins: 60,
      targetFats: 150,
      targetCalories: 2000,
    },
    create: {
      userId: user.id,
      effectiveFrom: startOfDay(new Date()),
      targetCarbs: 80,
      targetProteins: 60,
      targetFats: 150,
      targetCalories: 2000,
    },
  });
}

async function main() {
  await Promise.all(
    foods.map(([itemName, carbohydrates, proteins, fats, calories]) =>
      prisma.foodItem.upsert({
        where: { itemName },
        update: { carbohydrates, proteins, fats, calories },
        create: { itemName, carbohydrates, proteins, fats, calories },
      }),
    ),
  );

  await upsertUser({
    email: process.env.SEED_ADMIN_EMAIL,
    mobileNumber: process.env.SEED_ADMIN_MOBILE || "9000000001",
    pin: process.env.SEED_ADMIN_PIN,
    name: process.env.SEED_ADMIN_NAME || "Primary Admin",
    role: "ADMIN",
  });

  await upsertUser({
    email: process.env.SEED_USER_EMAIL || process.env.SEED_PATIENT_EMAIL,
    mobileNumber: process.env.SEED_USER_MOBILE || "9000000002",
    pin: process.env.SEED_USER_PIN || process.env.SEED_PATIENT_PIN,
    name: process.env.SEED_USER_NAME || process.env.SEED_PATIENT_NAME || "Sample User",
    role: "USER",
  });

  console.log("NutriTrack seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
