"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { clearSession, createSession } from "@/lib/session";
import {
  foodItemSchema,
  foodLogSchema,
  loginSchema,
  medicalRecordSchema,
  pinUpdateSchema,
  profileSchema,
  userSchema,
} from "@/lib/validation";

export type ActionState = {
  ok?: boolean;
  message?: string;
};

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function actionError(error: unknown, fallback: string): ActionState {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { message: "That record already exists. Please use a different value." };
    }
  }

  console.error(error);
  return { message: fallback };
}

async function resolveWritableUserId(requestedUserId: string | undefined) {
  const actor = await requireUser();

  if (actor.role === "ADMIN" && requestedUserId) {
    return requestedUserId;
  }

  return actor.id;
}

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, "email"),
    pin: formValue(formData, "pin"),
  });

  if (!parsed.success) {
    return { message: "Enter a valid email and 4 digit PIN." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user || !(await bcrypt.compare(parsed.data.pin, user.pinHash))) {
    return { message: "Email or PIN is incorrect." };
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function signOut() {
  await clearSession();
  redirect("/");
}

export async function createUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();

  if (actor.role !== "ADMIN") {
    return { message: "Only admins can create users." };
  }

  const parsed = userSchema.safeParse({
    email: formValue(formData, "email"),
    pin: formValue(formData, "pin"),
    role: formValue(formData, "role") || "PATIENT",
    name: formValue(formData, "name"),
    age: formValue(formData, "age"),
    gender: formValue(formData, "gender"),
    conditions: formValue(formData, "conditions"),
  });

  if (!parsed.success) {
    return { message: "Check the user details and try again." };
  }

  try {
    const { pin, ...rest } = parsed.data;

    await prisma.user.create({
      data: {
        ...rest,
        pinHash: await bcrypt.hash(pin, 10),
      },
    });
  } catch (error) {
    return actionError(error, "Unable to create the user right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "User created." };
}

export async function updateProfile(_state: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const targetUserId =
    actor.role === "ADMIN" && formValue(formData, "userId")
      ? formValue(formData, "userId")
      : actor.id;

  const parsed = profileSchema.safeParse({
    name: formValue(formData, "name"),
    age: formValue(formData, "age"),
    gender: formValue(formData, "gender"),
    conditions: formValue(formData, "conditions"),
    targetCarbs: formValue(formData, "targetCarbs"),
    targetProteins: formValue(formData, "targetProteins"),
    targetFats: formValue(formData, "targetFats"),
    targetCalories: formValue(formData, "targetCalories"),
  });

  if (!parsed.success) {
    return { message: "Check profile targets and try again." };
  }

  try {
    await prisma.user.update({
      where: { id: targetUserId },
      data: parsed.data,
    });
  } catch (error) {
    return actionError(error, "Unable to save the profile right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Profile saved." };
}

export async function updatePin(_state: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();
  const targetUserId =
    actor.role === "ADMIN" && formValue(formData, "userId")
      ? formValue(formData, "userId")
      : actor.id;

  const parsed = pinUpdateSchema.safeParse({
    pin: formValue(formData, "pin"),
  });

  if (!parsed.success) {
    return { message: "PIN must be exactly 4 digits." };
  }

  try {
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        pinHash: await bcrypt.hash(parsed.data.pin, 10),
      },
    });
  } catch (error) {
    return actionError(error, "Unable to update the PIN right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: actor.role === "ADMIN" ? "PIN reset for the selected user." : "PIN updated." };
}

export async function saveFoodItem(_state: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireUser();

  if (actor.role !== "ADMIN") {
    return { message: "Only admins can maintain the master food table." };
  }

  const parsed = foodItemSchema.safeParse({
    itemName: formValue(formData, "itemName"),
    carbohydrates: formValue(formData, "carbohydrates"),
    proteins: formValue(formData, "proteins"),
    fats: formValue(formData, "fats"),
    calories: formValue(formData, "calories"),
  });

  if (!parsed.success) {
    return { message: "Check food item nutrition values." };
  }

  try {
    await prisma.foodItem.upsert({
      where: { itemName: parsed.data.itemName },
      create: parsed.data,
      update: parsed.data,
    });
  } catch (error) {
    return actionError(error, "Unable to save the food item right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Food item saved." };
}

export async function seedMasterFoods(): Promise<ActionState> {
  const actor = await requireUser();

  if (actor.role !== "ADMIN") {
    return { message: "Only admins can seed the master food table." };
  }

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
  ] as const;

  try {
    await Promise.all(
      foods.map(([itemName, carbohydrates, proteins, fats, calories]) =>
        prisma.foodItem.upsert({
          where: { itemName },
          update: { carbohydrates, proteins, fats, calories },
          create: { itemName, carbohydrates, proteins, fats, calories },
        }),
      ),
    );
  } catch (error) {
    return actionError(error, "Unable to seed the master food table right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Master foods seeded." };
}

export async function saveMedicalRecord(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await resolveWritableUserId(formValue(formData, "userId") || undefined);
  const parsed = medicalRecordSchema.safeParse({
    userId,
    date: formValue(formData, "date"),
    weight: formValue(formData, "weight"),
    height: formValue(formData, "height"),
    bpLow: formValue(formData, "bpLow"),
    bpHigh: formValue(formData, "bpHigh"),
  });

  if (!parsed.success) {
    return { message: "Check medical values and date." };
  }

  const bmi = parsed.data.weight / Math.pow(parsed.data.height / 100, 2);

  try {
    await prisma.medicalRecord.create({
      data: {
        userId,
        date: startOfDay(parsed.data.date),
        weight: parsed.data.weight,
        height: parsed.data.height,
        bmi,
        bpLow: parsed.data.bpLow,
        bpHigh: parsed.data.bpHigh,
      },
    });
  } catch (error) {
    return actionError(error, "Unable to save the medical record right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Medical record saved." };
}

export async function saveFoodLog(_state: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await resolveWritableUserId(formValue(formData, "userId") || undefined);
  const parsed = foodLogSchema.safeParse({
    userId,
    foodItemId: formValue(formData, "foodItemId"),
    date: formValue(formData, "date"),
    dishName: formValue(formData, "dishName") || "Meal",
    quantityGms: formValue(formData, "quantityGms"),
  });

  if (!parsed.success) {
    return { message: "Check food log details." };
  }

  const food = await prisma.foodItem.findUnique({ where: { id: parsed.data.foodItemId } });

  if (!food) {
    return { message: "Selected food item was not found." };
  }

  const scale = parsed.data.quantityGms / 100;

  try {
    await prisma.foodLog.create({
      data: {
        userId,
        foodItemId: food.id,
        date: startOfDay(parsed.data.date),
        dishName: parsed.data.dishName,
        quantityGms: parsed.data.quantityGms,
        carbs: food.carbohydrates * scale,
        proteins: food.proteins * scale,
        fats: food.fats * scale,
        calories: food.calories * scale,
      },
    });
  } catch (error) {
    return actionError(error, "Unable to save the food log right now.");
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Food intake logged." };
}

export async function deleteFoodLog(formData: FormData) {
  const actor = await requireUser();
  const id = formValue(formData, "id");

  const log = await prisma.foodLog.findUnique({ where: { id } });
  if (!log || (actor.role !== "ADMIN" && log.userId !== actor.id)) {
    return;
  }

  await prisma.foodLog.delete({ where: { id } });
  revalidatePath("/dashboard");
}

export async function deleteMedicalRecord(formData: FormData) {
  const actor = await requireUser();
  const id = formValue(formData, "id");

  const record = await prisma.medicalRecord.findUnique({ where: { id } });
  if (!record || (actor.role !== "ADMIN" && record.userId !== actor.id)) {
    return;
  }

  await prisma.medicalRecord.delete({ where: { id } });
  revalidatePath("/dashboard");
}

export async function getDayRange(date: Date) {
  return {
    gte: startOfDay(date),
    lt: endOfDay(date),
  };
}
