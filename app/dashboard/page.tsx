import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NutriTrackApp, type DashboardData } from "@/components/nutritrack-app";

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
    year: "2-digit",
  }).format(date);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const currentUser = await requireUser();
  const params = await searchParams;
  const isAdmin = currentUser.role === "ADMIN";

  const allUsers = isAdmin
    ? await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          age: true,
          gender: true,
          conditions: true,
          targetCarbs: true,
          targetProteins: true,
          targetFats: true,
          targetCalories: true,
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
  const selectedUser =
    (isAdmin
      ? allUsers.find((user) => user.id === targetUserId)
      : { ...currentUser, _count: { foodLogs: 0, medicalRecords: 0 } }) ??
    allUsers.find((user) => user.role === "PATIENT") ??
    { ...currentUser, _count: { foodLogs: 0, medicalRecords: 0 } };

  const [foodItems, foodLogs, medicalRecords, allFoodLogs, allMedicalRecords] = await Promise.all([
    prisma.foodItem.findMany({ orderBy: { itemName: "asc" } }),
    prisma.foodLog.findMany({
      where: { userId: selectedUser.id },
      include: { foodItem: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 80,
    }),
    prisma.medicalRecord.findMany({
      where: { userId: selectedUser.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    isAdmin
      ? prisma.foodLog.findMany({
          include: { user: true, foodItem: true },
          orderBy: { date: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.medicalRecord.findMany({
          include: { user: true },
          orderBy: { date: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const data: DashboardData = {
    currentUser: {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
    },
    selectedUser: {
      id: selectedUser.id,
      email: selectedUser.email,
      name: selectedUser.name,
      role: selectedUser.role,
      age: selectedUser.age,
      gender: selectedUser.gender,
      conditions: selectedUser.conditions,
      targetCarbs: selectedUser.targetCarbs,
      targetProteins: selectedUser.targetProteins,
      targetFats: selectedUser.targetFats,
      targetCalories: selectedUser.targetCalories,
    },
    users: allUsers.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      age: user.age,
      gender: user.gender,
      conditions: user.conditions,
      targetCarbs: user.targetCarbs,
      targetProteins: user.targetProteins,
      targetFats: user.targetFats,
      targetCalories: user.targetCalories,
      foodLogs: user._count.foodLogs,
      medicalRecords: user._count.medicalRecords,
    })),
    foodItems: foodItems.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      carbohydrates: item.carbohydrates,
      proteins: item.proteins,
      fats: item.fats,
      calories: item.calories,
    })),
    foodLogs: foodLogs.map((log) => ({
      id: log.id,
      date: isoDate(log.date),
      displayDate: displayDate(log.date),
      dishName: log.dishName,
      quantityGms: log.quantityGms,
      carbs: log.carbs,
      proteins: log.proteins,
      fats: log.fats,
      calories: log.calories,
      foodItem: log.foodItem.itemName,
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
    adminMetrics: isAdmin
      ? {
          totalPatients: allUsers.filter((user) => user.role === "PATIENT").length,
          totalAdmins: allUsers.filter((user) => user.role === "ADMIN").length,
          totalFoodLogs: allFoodLogs.length,
          totalMedicalRecords: allMedicalRecords.length,
          avgCalories:
            allFoodLogs.length === 0
              ? 0
              : allFoodLogs.reduce((sum, log) => sum + log.calories, 0) / allFoodLogs.length,
          avgBmi:
            allMedicalRecords.length === 0
              ? 0
              : allMedicalRecords.reduce((sum, record) => sum + record.bmi, 0) /
                allMedicalRecords.length,
          highBpCount: allMedicalRecords.filter((record) => record.bpHigh >= 130 || record.bpLow >= 80)
            .length,
        }
      : null,
  };

  return <NutriTrackApp data={data} />;
}
