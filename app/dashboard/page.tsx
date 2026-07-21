import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LCHFApp, type DashboardData } from "@/components/lchf-app";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    userId?: string;
  }>;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function displayDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function dayDiffInclusive(startDate: Date) {
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const params = await searchParams;
  const isAdmin = currentUser.role === "ADMIN";

  const users = isAdmin
    ? await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          email: true,
          mobileNumber: true,
          name: true,
          role: true,
          age: true,
          gender: true,
          conditions: true,
          startDate: true,
          nutritionTargets: {
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: {
              targetCarbs: true,
              targetProteins: true,
              targetFats: true,
              targetCalories: true,
            },
          },
          _count: {
            select: {
              foodLogs: true,
              medicalRecords: true,
            },
          },
        },
      })
    : [];

  const targetUserId = isAdmin && params.userId ? params.userId : currentUser.id;

  const [selectedUserDb, foodItems, personalFoodItems, foodLogs, medicalRecords, targetProfiles, trackedDayGroups, allFoodLogs, allMedicalRecords] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          mobileNumber: true,
          name: true,
          role: true,
          age: true,
          gender: true,
          conditions: true,
          startDate: true,
          nutritionTargets: {
            orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              effectiveFrom: true,
              targetCarbs: true,
              targetProteins: true,
              targetFats: true,
              targetCalories: true,
            },
          },
          _count: {
            select: {
              foodLogs: true,
              medicalRecords: true,
            },
          },
        },
      }),
      prisma.foodItem.findMany({ orderBy: { itemName: "asc" } }),
      prisma.personalFoodItem.findMany({
        where: { userId: targetUserId },
        orderBy: { itemName: "asc" },
      }),
      prisma.foodLog.findMany({
        where: { userId: targetUserId },
        include: { foodItem: true, personalFoodItem: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.medicalRecord.findMany({
        where: { userId: targetUserId },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.nutritionTarget.findMany({
        where: { userId: targetUserId },
        orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
      }),
      prisma.foodLog.groupBy({
        by: ["date"],
        where: { userId: targetUserId },
      }),
      isAdmin
        ? prisma.foodLog.findMany({
            select: { userId: true, date: true, calories: true, carbs: true, proteins: true, fats: true },
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.medicalRecord.findMany({
            select: { userId: true, date: true, bmi: true, bpLow: true, bpHigh: true },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
    ]);

  if (!selectedUserDb) {
    throw new Error("Selected user was not found.");
  }

  const selectedTrackedDays = trackedDayGroups.length;
  const selectedDaysOnApp = dayDiffInclusive(selectedUserDb.startDate);
  const selectedTrackingRate = selectedDaysOnApp > 0 ? (selectedTrackedDays / selectedDaysOnApp) * 100 : 0;
  const selectedActiveTarget = selectedUserDb.nutritionTargets.at(-1) ?? null;

  const daySetByUser = new Map<string, Set<string>>();
  const totalsByUser = new Map<string, { logs: number; calories: number; carbs: number; proteins: number; fats: number }>();
  allFoodLogs.forEach((log) => {
    const key = isoDate(log.date);
    const set = daySetByUser.get(log.userId) ?? new Set<string>();
    set.add(key);
    daySetByUser.set(log.userId, set);

    const totals = totalsByUser.get(log.userId) ?? { logs: 0, calories: 0, carbs: 0, proteins: 0, fats: 0 };
    totals.logs += 1;
    totals.calories += log.calories;
    totals.carbs += log.carbs;
    totals.proteins += log.proteins;
    totals.fats += log.fats;
    totalsByUser.set(log.userId, totals);
  });

  const latestMedicalByUser = new Map<string, (typeof allMedicalRecords)[number]>();
  allMedicalRecords.forEach((record) => {
    if (!latestMedicalByUser.has(record.userId)) {
      latestMedicalByUser.set(record.userId, record);
    }
  });

  const comparisonRows = isAdmin
    ? users.map((user) => {
        const totals = totalsByUser.get(user.id) ?? { logs: 0, calories: 0, carbs: 0, proteins: 0, fats: 0 };
        const trackedDays = daySetByUser.get(user.id)?.size ?? 0;
        const daysOnApp = dayDiffInclusive(user.startDate);
        const latestMedical = latestMedicalByUser.get(user.id);

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          mobileNumber: user.mobileNumber,
          role: user.role,
          totalLogs: totals.logs,
          daysTracked: trackedDays,
          trackingRate: daysOnApp > 0 ? (trackedDays / daysOnApp) * 100 : 0,
          avgCaloriesPerLog: totals.logs > 0 ? totals.calories / totals.logs : 0,
          avgCarbsPerLog: totals.logs > 0 ? totals.carbs / totals.logs : 0,
          avgProteinsPerLog: totals.logs > 0 ? totals.proteins / totals.logs : 0,
          avgFatsPerLog: totals.logs > 0 ? totals.fats / totals.logs : 0,
          latestBmi: latestMedical?.bmi ?? null,
          latestBpLow: latestMedical?.bpLow ?? null,
          latestBpHigh: latestMedical?.bpHigh ?? null,
          latestMedicalDate: latestMedical ? displayDate(latestMedical.date) : null,
        };
      })
    : [];

  const data: DashboardData = {
    currentUser: {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
    },
    selectedUser: {
      id: selectedUserDb.id,
      email: selectedUserDb.email,
      mobileNumber: selectedUserDb.mobileNumber,
      name: selectedUserDb.name,
      role: selectedUserDb.role,
      age: selectedUserDb.age,
      gender: selectedUserDb.gender,
      conditions: selectedUserDb.conditions,
      startDate: isoDate(selectedUserDb.startDate),
      displayStartDate: displayDate(selectedUserDb.startDate),
      daysOnApp: selectedDaysOnApp,
      daysTracked: selectedTrackedDays,
      trackingRate: selectedTrackingRate,
      activeTargets: selectedActiveTarget
        ? {
            targetCarbs: selectedActiveTarget.targetCarbs,
            targetProteins: selectedActiveTarget.targetProteins,
            targetFats: selectedActiveTarget.targetFats,
            targetCalories: selectedActiveTarget.targetCalories,
          }
        : null,
      foodLogs: selectedUserDb._count.foodLogs,
      medicalRecords: selectedUserDb._count.medicalRecords,
    },
    users: users.map((user) => {
      const trackedDays = daySetByUser.get(user.id)?.size ?? 0;
      const daysOnApp = dayDiffInclusive(user.startDate);
      const activeTarget = user.nutritionTargets[0] ?? null;

      return {
        id: user.id,
        email: user.email,
        mobileNumber: user.mobileNumber,
        name: user.name,
        role: user.role,
        age: user.age,
        gender: user.gender,
        conditions: user.conditions,
        startDate: isoDate(user.startDate),
        displayStartDate: displayDate(user.startDate),
        daysOnApp,
        daysTracked: trackedDays,
        trackingRate: daysOnApp > 0 ? (trackedDays / daysOnApp) * 100 : 0,
        activeTargets: activeTarget
          ? {
              targetCarbs: activeTarget.targetCarbs,
              targetProteins: activeTarget.targetProteins,
              targetFats: activeTarget.targetFats,
              targetCalories: activeTarget.targetCalories,
            }
          : null,
        foodLogs: user._count.foodLogs,
        medicalRecords: user._count.medicalRecords,
      };
    }),
    foodItems: foodItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      carbohydrates: item.carbohydrates,
      proteins: item.proteins,
      fats: item.fats,
      calories: item.calories,
    })),
    personalFoodItems: personalFoodItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      carbohydrates: item.carbohydrates,
      proteins: item.proteins,
      fats: item.fats,
      calories: item.calories,
      ownerEmail: item.ownerEmail,
    })),
    foodLogs: foodLogs.map((log) => ({
      id: log.id,
      date: isoDate(log.date),
      displayDate: displayDate(log.date),
      dishName: log.dishName,
      quantityValue: log.quantityValue,
      quantityMetric: log.quantityMetric as "GRAMS" | "ML" | "INTEGER",
      carbs: log.carbs,
      proteins: log.proteins,
      fats: log.fats,
      calories: log.calories,
      proteinCarbRatio: log.proteinCarbRatio,
      foodItemId: log.foodItemId ?? log.personalFoodItemId ?? "",
      foodChoice: log.foodItemId ? `MASTER:${log.foodItemId}` : `PERSONAL:${log.personalFoodItemId ?? ""}`,
      foodItem: log.foodItem?.itemName ?? log.personalFoodItem?.itemName ?? "Unknown item",
    })),
    medicalRecords: medicalRecords.map((record) => ({
      id: record.id,
      date: isoDate(record.date),
      displayDate: displayDate(record.date),
      weight: record.weight,
      height: record.height,
      bmi: record.bmi,
      bpLow: record.bpLow,
      bpHigh: record.bpHigh,
    })),
    targetProfiles: targetProfiles.map((target) => ({
      id: target.id,
      effectiveFrom: isoDate(target.effectiveFrom),
      displayEffectiveFrom: displayDate(target.effectiveFrom),
      targetCarbs: target.targetCarbs,
      targetProteins: target.targetProteins,
      targetFats: target.targetFats,
      targetCalories: target.targetCalories,
    })),
    adminMetrics: isAdmin
      ? {
          totalUsers: users.filter((user) => user.role === "USER").length,
          totalAdmins: users.filter((user) => user.role === "ADMIN").length,
          totalFoodLogs: allFoodLogs.length,
          totalMedicalRecords: allMedicalRecords.length,
          avgCalories:
            allFoodLogs.length === 0
              ? 0
              : allFoodLogs.reduce((sum, log) => sum + log.calories, 0) / allFoodLogs.length,
          avgBmi:
            allMedicalRecords.length === 0
              ? 0
              : allMedicalRecords.reduce((sum, record) => sum + record.bmi, 0) / allMedicalRecords.length,
          highBpCount: allMedicalRecords.filter((record) => record.bpHigh >= 130 || record.bpLow >= 80).length,
        }
      : null,
    comparisonRows,
  };

  return <LCHFApp data={data} />;
}


