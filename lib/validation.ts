import { z } from "zod";

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().min(1).optional());

const optionalPositiveInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  return value;
}, z.coerce.number().int().positive().optional());

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits.");
export const phoneSchema = z.string().trim().regex(/^\d{10,15}$/, "Mobile number must be 10 to 15 digits.");

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter email or mobile number."),
  pin: pinSchema,
});

export const userSchema = z.object({
  email: z.email().trim().toLowerCase(),
  mobileNumber: phoneSchema,
  pin: pinSchema,
  role: z.enum(["USER", "ADMIN"]).default("USER"),
  name: z.string().min(2).trim(),
  age: optionalPositiveInt,
  gender: optionalText,
  conditions: optionalText,
  startDate: z.coerce.date(),
  targetEffectiveFrom: z.coerce.date(),
  targetCarbs: z.coerce.number().nonnegative(),
  targetProteins: z.coerce.number().nonnegative(),
  targetFats: z.coerce.number().nonnegative(),
  targetCalories: z.coerce.number().nonnegative(),
});

export const profileSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.email().trim().toLowerCase(),
  mobileNumber: phoneSchema,
  age: optionalPositiveInt,
  gender: optionalText,
  conditions: optionalText,
  startDate: z.coerce.date(),
});

export const nutritionTargetSchema = z.object({
  userId: z.string().optional(),
  effectiveFrom: z.coerce.date(),
  targetCarbs: z.coerce.number().nonnegative(),
  targetProteins: z.coerce.number().nonnegative(),
  targetFats: z.coerce.number().nonnegative(),
  targetCalories: z.coerce.number().nonnegative(),
});

export const pinUpdateSchema = z.object({
  pin: pinSchema,
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
  id: z.string().optional(),
  userId: z.string().optional(),
  foodItemId: z.string().min(1),
  date: z.coerce.date(),
  dishName: z.string().min(1).trim().default("Meal"),
  quantityGms: z.coerce.number().positive(),
});
