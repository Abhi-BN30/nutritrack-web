import { z } from "zod";

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits.");

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  pin: pinSchema,
});

export const userSchema = z.object({
  email: z.email().trim().toLowerCase(),
  pin: pinSchema,
  role: z.enum(["PATIENT", "ADMIN"]).default("PATIENT"),
  name: z.string().min(2).trim(),
  age: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  gender: z.string().trim().optional(),
  conditions: z.string().trim().optional(),
});

export const profileSchema = z.object({
  name: z.string().min(2).trim(),
  age: z.coerce.number().int().positive().optional(),
  gender: z.string().trim().optional(),
  conditions: z.string().trim().optional(),
  targetCarbs: z.coerce.number().nonnegative(),
  targetProteins: z.coerce.number().nonnegative(),
  targetFats: z.coerce.number().nonnegative(),
  targetCalories: z.coerce.number().nonnegative(),
});

export const foodItemSchema = z.object({
  itemName: z.string().min(2).trim(),
  carbohydrates: z.coerce.number().nonnegative(),
  proteins: z.coerce.number().nonnegative(),
  fats: z.coerce.number().nonnegative(),
  calories: z.coerce.number().nonnegative(),
});

export const medicalRecordSchema = z.object({
  userId: z.string().optional(),
  date: z.coerce.date(),
  weight: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  bpLow: z.coerce.number().positive(),
  bpHigh: z.coerce.number().positive(),
});

export const foodLogSchema = z.object({
  userId: z.string().optional(),
  foodItemId: z.string().min(1),
  date: z.coerce.date(),
  dishName: z.string().min(1).trim().default("Meal"),
  quantityGms: z.coerce.number().positive(),
});
