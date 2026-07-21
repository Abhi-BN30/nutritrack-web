
"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Activity,
  Apple,
  BarChart3,
  Database,
  Download,
  HeartPulse,
  LockKeyhole,
  LogOut,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { InstallAppButton } from "@/components/install-app-button";
import {
  createUser,
  deleteFoodLog,
  deleteMedicalRecord,
  saveFoodItem,
  saveFoodLog,
  saveMedicalRecord,
  saveNutritionTarget,
  signOut,
  updatePin,
  updateProfile,
  type ActionState,
} from "@/lib/actions";

type Role = "USER" | "ADMIN";

type Targets = {
  targetCarbs: number;
  targetProteins: number;
  targetFats: number;
  targetCalories: number;
};

type UserSummary = {
  id: string;
  email: string;
  mobileNumber: string;
  name: string;
  role: Role;
  age: number | null;
  gender: string | null;
  conditions: string | null;
  startDate: string;
  displayStartDate: string;
  daysOnApp: number;
  daysTracked: number;
  trackingRate: number;
  activeTargets: Targets | null;
  foodLogs?: number;
  medicalRecords?: number;
};

type FoodItem = {
  id: string;
  itemName: string;
  carbohydrates: number;
  proteins: number;
  fats: number;
  calories: number;
};

type FoodLog = {
  id: string;
  date: string;
  displayDate: string;
  dishName: string;
  quantityValue: number;
  quantityMetric: "GRAMS" | "ML" | "INTEGER";
  quantityGms: number;
  carbs: number;
  proteins: number;
  fats: number;
  calories: number;
  proteinCarbRatio: number | null;
  foodItemId: string;
  foodItem: string;
};

type MedicalRecord = {
  id: string;
  date: string;
  displayDate: string;
  weight: number;
  height: number;
  bmi: number;
  bpLow: number;
  bpHigh: number;
};

type TargetProfile = {
  id: string;
  effectiveFrom: string;
  displayEffectiveFrom: string;
  targetCarbs: number;
  targetProteins: number;
  targetFats: number;
  targetCalories: number;
};

type ComparisonRow = {
  userId: string;
  name: string;
  email: string;
  mobileNumber: string;
  role: Role;
  totalLogs: number;
  daysTracked: number;
  trackingRate: number;
  avgCaloriesPerLog: number;
  avgCarbsPerLog: number;
  avgProteinsPerLog: number;
  avgFatsPerLog: number;
  latestBmi: number | null;
  latestBpLow: number | null;
  latestBpHigh: number | null;
  latestMedicalDate: string | null;
};

export type DashboardData = {
  currentUser: Pick<UserSummary, "id" | "email" | "name" | "role">;
  selectedUser: UserSummary;
  users: UserSummary[];
  foodItems: FoodItem[];
  foodLogs: FoodLog[];
  medicalRecords: MedicalRecord[];
  targetProfiles: TargetProfile[];
  adminMetrics: {
    totalUsers: number;
    totalAdmins: number;
    totalFoodLogs: number;
    totalMedicalRecords: number;
    avgCalories: number;
    avgBmi: number;
    highBpCount: number;
  } | null;
  comparisonRows: ComparisonRow[];
};

type Tab = "tracker" | "medical" | "graphs" | "database" | "profile" | "admin";

const initialState: ActionState = {};
const today = new Date().toISOString().slice(0, 10);

function round(value: number | null | undefined, places = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(places);
}

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

function clampDate(value: string, minDate: string, maxDate: string) {
  if (value < minDate) return minDate;
  if (value > maxDate) return maxDate;
  return value;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatTooltipValue(value: ValueType | undefined) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
}

function nutritionTooltipFormatter(value: ValueType | undefined, name: NameType | undefined) {
  const labelMap: Record<string, string> = {
    carbs: "Carbs",
    proteins: "Proteins",
    fats: "Fats",
    calories: "Calories",
    targetCalories: "Target calories",
  };

  const normalizedName = String(name ?? "Value");
  const normalizedValue = formatTooltipValue(value);
  const isCalories = ["calories", "targetCalories", "Calories", "Target calories"].includes(normalizedName);
  const formatted =
    typeof normalizedValue === "number"
      ? round(normalizedValue, isCalories ? 0 : 1)
      : normalizedValue ?? "-";
  const suffix = isCalories ? " kcal" : " g";

  return [`${formatted}${suffix}`, labelMap[normalizedName] ?? normalizedName];
}

function biometricTooltipFormatter(value: ValueType | undefined, name: NameType | undefined) {
  const labelMap: Record<string, string> = {
    bmi: "BMI",
    weight: "Weight",
    bpHigh: "BP High",
    bpLow: "BP Low",
  };

  const normalizedName = String(name ?? "Value");
  const normalizedValue = formatTooltipValue(value);
  const suffix = normalizedName === "weight" || normalizedName === "Weight" ? " kg" : "";
  const formatted = typeof normalizedValue === "number" ? round(normalizedValue) : normalizedValue ?? "-";

  return [`${formatted}${suffix}`, labelMap[normalizedName] ?? normalizedName];
}

function resolveTargetForDate(targets: TargetProfile[], date: string): Targets | null {
  const sorted = [...targets].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  let chosen: TargetProfile | null = null;

  for (const target of sorted) {
    if (target.effectiveFrom <= date) {
      chosen = target;
    }
  }

  const active = chosen ?? sorted.at(0) ?? null;

  return active
    ? {
        targetCarbs: active.targetCarbs,
        targetProteins: active.targetProteins,
        targetFats: active.targetFats,
        targetCalories: active.targetCalories,
      }
    : null;
}

function formatQuantityDisplay(value: number, metric: "GRAMS" | "ML" | "INTEGER") {
  const roundedValue = round(value, metric === "INTEGER" ? 0 : 1);

  if (metric === "ML") {
    return `${roundedValue} ml`;
  }

  if (metric === "INTEGER") {
    return `${roundedValue} no's.`;
  }

  return `${roundedValue} g`;
}

function DonutChart({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(percent, 100));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex w-full items-center justify-center gap-3 text-center sm:gap-4">
      <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#e5eee2" strokeWidth="8" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="#245b35"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
        />
        <text x="36" y="40" textAnchor="middle" className="fill-[#172117] text-[14px] font-semibold">
          {Math.round(value)}%
        </text>
      </svg>
      <div className="text-left sm:text-center">
        <p className="text-sm font-semibold text-[#172117]">{label}</p>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
  step,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  step?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]"
      />
    </label>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-[#edf7ec] text-[#245b35]" : "bg-[#fff4e8] text-[#8a4a12]"}`}>{state.message}</p>;
}

function MiniMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6a7669]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[#172117]">{value}</p>
      <p className="mt-1 text-xs text-[#6a7669]">{helper}</p>
    </div>
  );
}

function StatCard({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Activity }) {
  return (
    <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#5b685a]">{label}</span>
        <Icon className="size-4 text-[#4f7f5d]" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#6a7669]">{helper}</p>
    </div>
  );
}

function PageHighlightTile({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
}) {
  return (
    <div className="aspect-square rounded-lg border border-[#e4ece1] bg-[#f9fbf8] px-3 py-3 sm:aspect-auto sm:min-h-[108px] sm:px-3 sm:py-2.5 lg:min-h-[96px]">
      <div className="grid h-full grid-rows-[auto,1fr] gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6a7669] sm:text-[10px] lg:text-[11px]">
            {label}
          </p>
          <Icon className="size-3.5 shrink-0 text-[#4f7f5d]" />
        </div>
        <div className="grid place-items-center text-center">
          <div>
            <p className="text-lg font-semibold leading-tight text-[#172117] sm:text-base lg:text-[1.15rem]">
              {value}
            </p>
            {helper ? <p className="mt-1 text-[11px] text-[#6a7669]">{helper}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

type ControlOption = {
  value: string;
  label: string;
};

function TableControls({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterValue,
  onFilterChange,
  filterOptions,
  sortValue,
  onSortChange,
  sortOptions,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  filterOptions: ControlOption[];
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: ControlOption[];
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35] lg:flex-1"
      />
      <div className="grid gap-2 sm:grid-cols-2 lg:w-auto">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a7669]">Filter</span>
          <select
            value={filterValue}
            onChange={(event) => onFilterChange(event.target.value)}
            className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35] sm:min-w-[180px]"
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#6a7669]">Sort by</span>
          <select
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35] sm:min-w-[180px]"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function TargetCards({ totals, targets }: { totals: Targets; targets: Targets | null }) {
  const items = [
    { key: "targetCalories", label: "Calories", actual: totals.targetCalories, unit: "kcal", icon: Activity },
    { key: "targetCarbs", label: "Carbs", actual: totals.targetCarbs, unit: "g", icon: Apple },
    { key: "targetProteins", label: "Proteins", actual: totals.targetProteins, unit: "g", icon: Users },
    { key: "targetFats", label: "Fats", actual: totals.targetFats, unit: "g", icon: BarChart3 },
  ] as const;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        {items.map((item) => {
          const targetValue = targets ? targets[item.key] : 0;
          const progress = targetValue > 0 ? (item.actual / targetValue) * 100 : 0;
          const displayProgress = Math.max(0, Math.min(progress, 100));
          const radius = 22;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (displayProgress / 100) * circumference;
          const strokeColor = progress > 100 ? "#b14646" : "#245b35";

          return (
            <div key={item.key} className="aspect-square rounded-lg border border-[#dbe5d8] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#5b685a]">{item.label}</span>
                <item.icon className="size-3.5 text-[#4f7f5d]" />
              </div>

              <div className="mt-3 flex justify-center">
                <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
                  <circle cx="34" cy="34" r={radius} fill="none" stroke="#e5eee2" strokeWidth="7" />
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 34 34)"
                  />
                  <text x="34" y="32" textAnchor="middle" className="fill-[#172117] text-[12px] font-semibold">
                    {Math.round(progress)}%
                  </text>
                  <text x="34" y="43" textAnchor="middle" className="fill-[#6a7669] text-[8px] font-medium">
                    of goal
                  </text>
                </svg>
              </div>

              <div className="mt-2 text-center">
                <p className="text-lg font-semibold text-[#172117] leading-none">
                  {round(item.actual, item.unit === "kcal" ? 0 : 1)}
                  {item.unit}
                </p>
                <p className="mt-1 text-[11px] text-[#6a7669] leading-tight">
                  Target {targetValue ? `${round(targetValue, item.unit === "kcal" ? 0 : 1)}${item.unit}` : "not set"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const targetValue = targets ? targets[item.key] : 0;
          const progress = targetValue > 0 ? (item.actual / targetValue) * 100 : 0;
          const displayProgress = Math.max(0, Math.min(progress, 100));
          const radius = 28;
          const circumference = 2 * Math.PI * radius;
          const offset = circumference - (displayProgress / 100) * circumference;
          const strokeColor = progress > 100 ? "#b14646" : "#245b35";

          return (
            <div key={item.key} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#5b685a]">{item.label}</span>
                <item.icon className="size-4 text-[#4f7f5d]" />
              </div>

              <div className="mt-4 flex items-center gap-4">
                <svg width="84" height="84" viewBox="0 0 84 84" className="shrink-0">
                  <circle cx="42" cy="42" r={radius} fill="none" stroke="#e5eee2" strokeWidth="8" />
                  <circle
                    cx="42"
                    cy="42"
                    r={radius}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 42 42)"
                  />
                  <text x="42" y="40" textAnchor="middle" className="fill-[#172117] text-[15px] font-semibold">
                    {Math.round(progress)}%
                  </text>
                  <text x="42" y="54" textAnchor="middle" className="fill-[#6a7669] text-[10px] font-medium">
                    of goal
                  </text>
                </svg>

                <div className="min-w-0 flex-1">
                  <p className="text-2xl font-semibold text-[#172117]">
                    {round(item.actual, item.unit === "kcal" ? 0 : 1)}
                    {item.unit}
                  </p>
                  <p className="mt-1 text-xs text-[#6a7669]">
                    Target {targetValue ? `${round(targetValue, item.unit === "kcal" ? 0 : 1)}${item.unit}` : "not set"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type HeaderHighlight = {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
};

function getHeaderHighlights(tab: Tab, data: DashboardData): HeaderHighlight[] {
  const dailyNutrition = Array.from(
    data.foodLogs.reduce((map, log) => {
      const entry = map.get(log.date) ?? { calories: 0, carbs: 0, proteins: 0, fats: 0, ratioTotal: 0, ratioCount: 0 };
      entry.calories += log.calories;
      entry.carbs += log.carbs;
      entry.proteins += log.proteins;
      entry.fats += log.fats;
      if (typeof log.proteinCarbRatio === "number" && Number.isFinite(log.proteinCarbRatio)) {
        entry.ratioTotal += log.proteinCarbRatio;
        entry.ratioCount += 1;
      }
      map.set(log.date, entry);
      return map;
    }, new Map<string, { calories: number; carbs: number; proteins: number; fats: number; ratioTotal: number; ratioCount: number }>()).values(),
  );
  const avgDailyCalories = average(dailyNutrition.map((entry) => entry.calories));
  const avgDailyCarbs = average(dailyNutrition.map((entry) => entry.carbs));
  const avgDailyProteins = average(dailyNutrition.map((entry) => entry.proteins));
  const avgDailyFats = average(dailyNutrition.map((entry) => entry.fats));
  const avgDailyRatio = average(dailyNutrition.flatMap((entry) => (entry.ratioCount > 0 ? [entry.proteins / entry.carbs] : [])));
  const avgFoodCalories = average(data.foodItems.map((item) => item.calories));
  const avgFoodProteins = average(data.foodItems.map((item) => item.proteins));
  const adminMetrics = data.adminMetrics;

  switch (tab) {
    case "tracker":
      return [
        { label: "Avg calories", value: avgDailyCalories === null ? "-" : `${round(avgDailyCalories, 0)} kcal`, helper: "", icon: Apple },
        { label: "Avg carbs", value: avgDailyCarbs === null ? "-" : `${round(avgDailyCarbs)} g`, helper: "", icon: BarChart3 },
        { label: "Avg proteins", value: avgDailyProteins === null ? "-" : `${round(avgDailyProteins)} g`, helper: "", icon: Activity },
        { label: "Avg fats", value: avgDailyFats === null ? "-" : `${round(avgDailyFats)} g`, helper: "", icon: HeartPulse },
        { label: "Avg P/C ratio", value: avgDailyRatio === null ? "-" : round(avgDailyRatio), helper: "", icon: UserRound },
      ];
    case "medical":
      return [
        { label: "Avg BMI", value: data.medicalRecords.length ? round(average(data.medicalRecords.map((record) => record.bmi))) : "-", helper: "", icon: HeartPulse },
        { label: "Avg systolic", value: data.medicalRecords.length ? `${round(average(data.medicalRecords.map((record) => record.bpHigh)), 0)}` : "-", helper: "", icon: Activity },
        { label: "Avg diastolic", value: data.medicalRecords.length ? `${round(average(data.medicalRecords.map((record) => record.bpLow)), 0)}` : "-", helper: "", icon: BarChart3 },
        { label: "Avg weight", value: data.medicalRecords.length ? `${round(average(data.medicalRecords.map((record) => record.weight)))} kg` : "-", helper: "", icon: UserRound },
      ];
    case "graphs":
      return [
        { label: "Target calories", value: data.selectedUser.activeTargets ? `${round(data.selectedUser.activeTargets.targetCalories, 0)} kcal` : "-", helper: "", icon: Apple },
        { label: "Target carbs", value: data.selectedUser.activeTargets ? `${round(data.selectedUser.activeTargets.targetCarbs)} g` : "-", helper: "", icon: BarChart3 },
        { label: "Target proteins", value: data.selectedUser.activeTargets ? `${round(data.selectedUser.activeTargets.targetProteins)} g` : "-", helper: "", icon: Activity },
        { label: "Target fats", value: data.selectedUser.activeTargets ? `${round(data.selectedUser.activeTargets.targetFats)} g` : "-", helper: "", icon: HeartPulse },
      ];
    case "database":
      return [
        { label: " Total Items", value: `${data.foodItems.length}`, helper: "", icon: Database },
        { label: "Avg calories/100g", value: avgFoodCalories === null ? "-" : `${round(avgFoodCalories, 0)} kcal`, helper: "", icon: Apple },
        { label: "Avg proteins/100g", value: avgFoodProteins === null ? "-" : `${round(avgFoodProteins)} g`, helper: "", icon: Activity },
        // { label: "Selected role", value: data.selectedUser.role, helper: "", icon: ShieldCheck },
      ];
    case "profile":
      return [
        { label: "Role", value: data.selectedUser.role, helper: "", icon: ShieldCheck },
        { label: "Start date", value: data.selectedUser.displayStartDate, helper: `${data.selectedUser.daysOnApp} total days on app`, icon: UserRound },
        // { label: "Target profiles", value: `${data.targetProfiles.length}`, helper: "Historical nutrition target versions", icon: BarChart3 },
        // { label: "Active target calories", value: data.selectedUser.activeTargets ? `${round(data.selectedUser.activeTargets.targetCalories, 0)} kcal` : "-", helper: "Latest active nutrition target", icon: Apple },
      ];
    case "admin":
      return [
        { label: "Total users", value: `${adminMetrics?.totalUsers ?? data.users.length}`, helper: "", icon: Users },
        { label: "Admins", value: `${adminMetrics?.totalAdmins ?? data.users.filter((user) => user.role === "ADMIN").length}`, helper: "", icon: ShieldCheck },
        { label: "Food logs", value: `${adminMetrics?.totalFoodLogs ?? data.comparisonRows.reduce((sum, row) => sum + row.totalLogs, 0)}`, helper: "", icon: Database },
        { label: "High BP users", value: `${adminMetrics?.highBpCount ?? 0}`, helper: "", icon: HeartPulse },
      ];
  }
}

function Shell({ data, tab, setTab, children }: { data: DashboardData; tab: Tab; setTab: (tab: Tab) => void; children: React.ReactNode }) {
  const tabs: { id: Tab; label: string; icon: typeof Activity; adminOnly?: boolean }[] = [
    { id: "tracker", label: "Tracker", icon: Apple },
    { id: "medical", label: "Medical", icon: HeartPulse },
    { id: "graphs", label: "Graphs", icon: BarChart3 },
    { id: "database", label: "Database", icon: Database },
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  ];
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];
  const headerHighlights = getHeaderHighlights(tab, data);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f7faf5] text-[#172117]">
      <header className="sticky top-0 z-20 border-b border-[#dbe5d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#245b35] font-bold text-white">N</div>
            <div>
              <p className="font-semibold">NutriTrack</p>
              <p className="text-xs text-[#6a7669]">{data.currentUser.role === "ADMIN" ? "Admin workspace" : "User workspace"}</p>
            </div>
          </div>
          <nav className="flex w-full gap-1 overflow-x-auto pb-1 lg:w-auto lg:pb-0">
            {tabs.filter((item) => !item.adminOnly || data.currentUser.role === "ADMIN").map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap ${tab === item.id ? "bg-[#245b35] text-white" : "text-[#4d5b4c] hover:bg-[#edf3ea]"}`}>
                <item.icon className="size-4" />{item.label}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <InstallAppButton compactLabel="Install" />
            <form action={signOut}><button className="flex h-10 items-center gap-2 rounded-md border border-[#d8e2d5] px-3 text-sm font-medium hover:bg-[#edf3ea]"><LogOut className="size-4" />Sign out</button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <section className="mb-5 grid gap-4 2xl:grid-cols-[1.05fr_1.25fr]">
          <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">Logged in as</p>
            <h1 className="mt-1 text-2xl font-semibold">{data.selectedUser.name}</h1>
            {/* <p className="mt-1 break-all text-sm text-[#6a7669]">
              {activeTab.label} overview for {data.selectedUser.email}
            </p> */}
            {/* {data.currentUser.role === "ADMIN" ? <div className="mt-4 flex flex-wrap gap-2">{data.users.map((user) => <a key={user.id} href={`/dashboard?userId=${user.id}`} className={`rounded-md border px-3 py-2 text-sm ${user.id === data.selectedUser.id ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>{user.name}</a>)}</div> : null} */}
          </div>
          <div className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">Page highlights</p>
            <h2 className="mt-1 font-semibold">{activeTab.label} metrics</h2>
            {tab === "tracker" ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] px-3 py-3 sm:px-4">
                  <DonutChart percent={data.selectedUser.trackingRate} label={`${data.selectedUser.daysTracked} tracked / ${data.selectedUser.daysOnApp} days`} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                  {headerHighlights.map((highlight) => (
                    <PageHighlightTile key={highlight.label} {...highlight} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {headerHighlights.map((highlight) => (
                  <PageHighlightTile key={highlight.label} {...highlight} />
                ))}
              </div>
            )}
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
function Tracker({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodLog, initialState);
  const [selectedDate, setSelectedDate] = useState(today);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [search, setSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "withRatio" | "highProtein" | "highCalories">("all");
  const [logSort, setLogSort] = useState<"date_desc" | "date_asc" | "calories_desc" | "proteins_desc" | "carbs_desc">("date_desc");
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);
  const [quantityMetric, setQuantityMetric] = useState<"GRAMS" | "ML" | "INTEGER">("GRAMS");

  const selectedDateLogs = useMemo(() => data.foodLogs.filter((log) => log.date === selectedDate), [data.foodLogs, selectedDate]);
  const visibleLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = showAllLogs ? data.foodLogs : selectedDateLogs;
    const filtered = base.filter((log) => {
      const matchesSearch =
        !keyword || log.dishName.toLowerCase().includes(keyword) || log.foodItem.toLowerCase().includes(keyword);
      const matchesFilter =
        logFilter === "all"
          ? true
          : logFilter === "withRatio"
            ? log.proteinCarbRatio !== null
            : logFilter === "highProtein"
              ? log.proteins >= 20
              : log.calories >= 500;

      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (logSort) {
        case "date_asc":
          return a.date.localeCompare(b.date);
        case "calories_desc":
          return b.calories - a.calories;
        case "proteins_desc":
          return b.proteins - a.proteins;
        case "carbs_desc":
          return b.carbs - a.carbs;
        case "date_desc":
        default:
          return b.date.localeCompare(a.date);
      }
    });
  }, [data.foodLogs, logFilter, logSort, search, selectedDateLogs, showAllLogs]);

  const selectedTotals = useMemo(
    () => selectedDateLogs.reduce(
      (acc, log) => ({
        targetCarbs: acc.targetCarbs + log.carbs,
        targetProteins: acc.targetProteins + log.proteins,
        targetFats: acc.targetFats + log.fats,
        targetCalories: acc.targetCalories + log.calories,
      }),
      { targetCarbs: 0, targetProteins: 0, targetFats: 0, targetCalories: 0 },
    ),
    [selectedDateLogs],
  );

  const targetForSelectedDate = resolveTargetForDate(data.targetProfiles, selectedDate);

  const quantityStep = quantityMetric === "INTEGER" ? "1" : "0.1";

  return (
    <div className="space-y-5">
      <div className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Daily tracker</h2>
                {/* <p className="text-sm text-[#6a7669]">Targets are resolved using the target values effective on the selected date.</p> */}
              </div>
              <div className="w-full sm:w-52">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Viewing date</span>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]" />
                </label>
              </div>
            </div>
          </div>

          <TargetCards totals={selectedTotals} targets={targetForSelectedDate} />

          <form key={editingLog?.id ?? "new-log"} action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <input name="id" type="hidden" value={editingLog?.id ?? ""} />
            <input name="userId" type="hidden" value={data.selectedUser.id} />
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{editingLog ? "Edit food log" : "Add food log"}</h2>
                {/* <p className="text-sm text-[#6a7669]">Protein/carb ratio is calculated automatically from the selected food and metric-based quantity. Integer entries are treated as 1 serving = 100g, and ml entries are treated as ml-to-gram equivalents.</p> */}
              </div>
              {editingLog ? <button type="button" onClick={() => { setEditingLog(null); setQuantityMetric("GRAMS"); }} className="rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-medium hover:bg-[#f4f7f2]">Cancel edit</button> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Food item</span>
                <select name="foodItemId" defaultValue={editingLog?.foodItemId ?? ""} required className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm">
                  <option value="">Select food</option>
                  {data.foodItems.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
                </select>
              </label>
              
              <Field name="dishName" label="Dish / Meal / Description" placeholder="Free Input Field" required />
              {/* <Field name="quantityValue" label={quantityLabel} type="number" step={quantityStep} defaultValue={editingLog?.quantityValue ?? ""} required /> */}
              <Field name="quantityValue" label="Quantity" type="number" step={quantityStep} defaultValue={editingLog?.quantityValue ?? ""} required />
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Metric</span>
                <select name="quantityMetric" value={quantityMetric} onChange={(e) => setQuantityMetric(e.target.value as "GRAMS" | "ML" | "INTEGER")} className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm">
                  <option value="GRAMS">Grams</option>
                  <option value="ML">ML</option>
                  <option value="INTEGER">Integer</option>
                </select>
              </label>
              <Field name="date" label="Date" type="date" defaultValue={editingLog?.date ?? selectedDate} required />
            </div>
            <div className="mt-4"><ActionMessage state={state} /></div>
            <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">{editingLog ? "Update log" : "Save log"}</button>
          </form>
        </section>

        <section className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">Meals and Ingredients</h2>
                {/* <p className="text-sm text-[#6a7669]">Use show-all to view the full history. By default the table shows only the selected day.</p> */}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowAllLogs(false)} className={`rounded-md border px-3 py-2 text-sm ${!showAllLogs ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>Selected day only</button>
                <button type="button" onClick={() => setShowAllLogs(true)} className={`rounded-md border px-3 py-2 text-sm ${showAllLogs ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>Show all logs</button>
              </div>
            </div>
            <TableControls
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search dish or food item"
              filterValue={logFilter}
              onFilterChange={(value) => setLogFilter(value as "all" | "withRatio" | "highProtein" | "highCalories")}
              filterOptions={[
                { value: "all", label: "All entries" },
                { value: "withRatio", label: "Has P/C ratio" },
                { value: "highProtein", label: "High protein" },
                { value: "highCalories", label: "High calorie" },
              ]}
              sortValue={logSort}
              onSortChange={(value) => setLogSort(value as "date_desc" | "date_asc" | "calories_desc" | "proteins_desc" | "carbs_desc")}
              sortOptions={[
                { value: "date_desc", label: "Newest first" },
                { value: "date_asc", label: "Oldest first" },
                { value: "calories_desc", label: "Calories high to low" },
                { value: "proteins_desc", label: "Proteins high to low" },
                { value: "carbs_desc", label: "Carbs high to low" },
              ]}
            />
          </div>
          <div className="space-y-3 p-4 lg:hidden">
            {visibleLogs.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-4 text-center text-sm text-[#6a7669]">No food logs found.</p> : visibleLogs.map((log) => (
              <article key={log.id} className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#172117]">{log.dishName}</p>
                    <p className="text-sm text-[#6a7669]">{log.displayDate}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditingLog(log); setSelectedDate(log.date); setQuantityMetric(log.quantityMetric); }} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Pencil className="size-4" /></button>
                    <form action={deleteFoodLog}><input type="hidden" name="id" value={log.id} /><button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32] hover:bg-[#fff4f2]"><Trash2 className="size-4" /></button></form>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#4d5b4c]">
                  <p><span className="font-medium text-[#172117]">Food:</span> {log.foodItem}</p>
                  <p><span className="font-medium text-[#172117]">Qty:</span> {round(log.quantityGms, 0)} g eq.</p>
                  <p><span className="font-medium text-[#172117]">Carbs:</span> {round(log.carbs)}g</p>
                  <p><span className="font-medium text-[#172117]">Proteins:</span> {round(log.proteins)}g</p>
                  <p><span className="font-medium text-[#172117]">Fats:</span> {round(log.fats)}g</p>
                  <p><span className="font-medium text-[#172117]">Calories:</span> {round(log.calories, 0)}</p>
                </div>
                <p className="mt-3 text-sm text-[#4d5b4c]"><span className="font-medium text-[#172117]">Protein/Carb ratio:</span> {log.proteinCarbRatio === null ? "-" : round(log.proteinCarbRatio)}</p>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[#f4f8f2] text-left">
                <tr>
                  <th className="p-3">Date</th><th className="p-3">Dish</th><th className="p-3">Food item</th><th className="p-3">Qty</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th><th className="p-3">Calories</th><th className="p-3">Protein/Carb ratio</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.length === 0 ? <tr><td colSpan={10} className="p-5 text-center text-sm text-[#6a7669]">No food logs found.</td></tr> : visibleLogs.map((log) => (
                  <tr key={log.id} className="border-t border-[#eef3ec]">
                    <td className="p-3">{log.displayDate}</td><td className="p-3 font-medium">{log.dishName}</td><td className="p-3">{log.foodItem}</td><td className="p-3">{formatQuantityDisplay(log.quantityValue, log.quantityMetric)}</td><td className="p-3">{round(log.carbs)}g</td><td className="p-3">{round(log.proteins)}g</td><td className="p-3">{round(log.fats)}g</td><td className="p-3">{round(log.calories, 0)}</td><td className="p-3">{log.proteinCarbRatio === null ? "-" : round(log.proteinCarbRatio)}</td>
                    <td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => { setEditingLog(log); setSelectedDate(log.date); setQuantityMetric(log.quantityMetric); }} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Pencil className="size-4" /></button><form action={deleteFoodLog}><input type="hidden" name="id" value={log.id} /><button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32] hover:bg-[#fff4f2]"><Trash2 className="size-4" /></button></form></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Medical({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveMedicalRecord, initialState);
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <form key={editingRecord?.id ?? "new-medical-record"} action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <input name="id" type="hidden" value={editingRecord?.id ?? ""} />
        <input name="userId" type="hidden" value={data.selectedUser.id} />
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editingRecord ? "Edit biometric data" : "Add medical data"}</h2>
          {editingRecord ? <button type="button" onClick={() => setEditingRecord(null)} className="rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-medium hover:bg-[#f4f7f2]">Cancel edit</button> : null}
        </div>
        {/* <p className="mt-1 text-sm text-[#6a7669]">Each update creates a new dated medical record.</p> */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="weight" label="Weight kg" type="number" step="0.1" defaultValue={editingRecord?.weight ?? ""} required />
          <Field name="height" label="Height cm" type="number" step="0.1" defaultValue={editingRecord?.height ?? ""} required />
          <Field name="bpHigh" label="Systolic BP" type="number" step="1" defaultValue={editingRecord?.bpHigh ?? ""} required />
          <Field name="bpLow" label="Diastolic BP" type="number" step="1" defaultValue={editingRecord?.bpLow ?? ""} required />
          <Field name="date" label="Date" type="date" defaultValue={editingRecord?.date ?? today} required />
        </div>
        <div className="mt-4"><ActionMessage state={state} /></div>
        <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">{editingRecord ? "Update medical record" : "Save medical record"}</button>
      </form>
      <section className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Latest BMI" value={data.medicalRecords[0] ? round(data.medicalRecords[0].bmi) : "-"} helper="" icon={HeartPulse} />
          <StatCard label="Latest BP" value={data.medicalRecords[0] ? `${round(data.medicalRecords[0].bpHigh, 0)}/${round(data.medicalRecords[0].bpLow, 0)}` : "-"} helper="" icon={Activity} />
          <StatCard label="Records" value={`${data.medicalRecords.length}`} helper="" icon={Database} />
        </div>
        <section className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4"><h2 className="font-semibold">Biometric history</h2></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {data.medicalRecords.length === 0 ? <p className="text-sm text-[#6a7669]">No medical records yet.</p> : data.medicalRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-[#e4ece1] p-4">
                <div className="mb-3 flex items-center justify-between gap-3"><p className="font-medium">{record.displayDate}</p><div className="flex gap-2"><button type="button" onClick={() => setEditingRecord(record)} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Pencil className="size-4" /></button><form action={deleteMedicalRecord}><input type="hidden" name="id" value={record.id} /><button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32] hover:bg-[#fff4f2]"><Trash2 className="size-4" /></button></form></div></div>
                <div className="grid grid-cols-2 gap-2 text-sm"><p>Weight: {round(record.weight)} kg</p><p>Height: {round(record.height)} cm</p><p>BMI: {round(record.bmi)}</p><p>BP: {round(record.bpHigh, 0)}/{round(record.bpLow, 0)}</p></div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function Graphs({ data }: { data: DashboardData }) {
  const [rangePreset, setRangePreset] = useState<"7d" | "30d" | "all" | "custom">("30d");
  const allSeriesDates = useMemo(
    () => Array.from(new Set([...data.foodLogs.map((log) => log.date), ...data.medicalRecords.map((record) => record.date)])).sort(),
    [data.foodLogs, data.medicalRecords],
  );
  const minAvailableDate = allSeriesDates.at(0) ?? today;
  const maxAvailableDate = allSeriesDates.at(-1) ?? today;
  const [customStartDate, setCustomStartDate] = useState(() =>
    clampDate(shiftDate(maxAvailableDate, -29), minAvailableDate, maxAvailableDate),
  );
  const [customEndDate, setCustomEndDate] = useState(() => maxAvailableDate);

  const clampedCustomStartDate = clampDate(customStartDate, minAvailableDate, maxAvailableDate);
  const clampedCustomEndDate = clampDate(customEndDate, minAvailableDate, maxAvailableDate);

  const [normalizedStartDate, normalizedEndDate] = useMemo(() => {
    if (rangePreset === "7d") {
      return [clampDate(shiftDate(maxAvailableDate, -6), minAvailableDate, maxAvailableDate), maxAvailableDate];
    }

    if (rangePreset === "30d") {
      return [clampDate(shiftDate(maxAvailableDate, -29), minAvailableDate, maxAvailableDate), maxAvailableDate];
    }

    if (rangePreset === "all") {
      return [minAvailableDate, maxAvailableDate];
    }

    return clampedCustomStartDate <= clampedCustomEndDate
      ? [clampedCustomStartDate, clampedCustomEndDate]
      : [clampedCustomEndDate, clampedCustomStartDate];
  }, [clampedCustomEndDate, clampedCustomStartDate, maxAvailableDate, minAvailableDate, rangePreset]);

  const nutritionSeries = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        label: string;
        calories: number;
        carbs: number;
        proteins: number;
        fats: number;
        proteinCarbRatioTotal: number;
        ratioCount: number;
        targetCalories: number | null;
      }
    >();

    for (const log of data.foodLogs) {
      const existing =
        map.get(log.date) ??
        {
          date: log.date,
          label: log.displayDate,
          calories: 0,
          carbs: 0,
          proteins: 0,
          fats: 0,
          proteinCarbRatioTotal: 0,
          ratioCount: 0,
          targetCalories: resolveTargetForDate(data.targetProfiles, log.date)?.targetCalories ?? null,
        };

      existing.calories += log.calories;
      existing.carbs += log.carbs;
      existing.proteins += log.proteins;
      existing.fats += log.fats;

      if (typeof log.proteinCarbRatio === "number" && Number.isFinite(log.proteinCarbRatio)) {
        existing.proteinCarbRatioTotal += log.proteinCarbRatio;
        existing.ratioCount += 1;
      }

      map.set(log.date, existing);
    }

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        ...entry,
        proteinCarbRatio:
          entry.ratioCount > 0 ? Number((entry.proteinCarbRatioTotal / entry.ratioCount).toFixed(1)) : null,
      }));
  }, [data.foodLogs, data.targetProfiles]);

  const biometricSeries = useMemo(
    () =>
      [...data.medicalRecords]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((record) => ({
          date: record.date,
          label: record.displayDate,
          bmi: record.bmi,
          weight: record.weight,
          bpLow: record.bpLow,
          bpHigh: record.bpHigh,
        })),
    [data.medicalRecords],
  );

  const filteredNutritionSeries = useMemo(
    () => nutritionSeries.filter((entry) => entry.date >= normalizedStartDate && entry.date <= normalizedEndDate),
    [normalizedEndDate, normalizedStartDate, nutritionSeries],
  );
  const filteredBiometricSeries = useMemo(
    () => biometricSeries.filter((entry) => entry.date >= normalizedStartDate && entry.date <= normalizedEndDate),
    [biometricSeries, normalizedEndDate, normalizedStartDate],
  );

  const latestNutrition = filteredNutritionSeries.at(-1) ?? null;
  const latestMedical = filteredBiometricSeries.at(-1) ?? null;
  const avgCalories = average(filteredNutritionSeries.map((entry) => entry.calories));
  const avgCarbs = average(filteredNutritionSeries.map((entry) => entry.carbs));
  const avgProteins = average(filteredNutritionSeries.map((entry) => entry.proteins));
  const avgFats = average(filteredNutritionSeries.map((entry) => entry.fats));
  const avgRatio = average(filteredNutritionSeries.flatMap((entry) => (entry.proteinCarbRatio == null ? [] : [entry.proteinCarbRatio])));
  const avgBmi = average(filteredBiometricSeries.map((entry) => entry.bmi));
  const avgWeight = average(filteredBiometricSeries.map((entry) => entry.weight));
  const avgBpHigh = average(filteredBiometricSeries.map((entry) => entry.bpHigh));
  const avgBpLow = average(filteredBiometricSeries.map((entry) => entry.bpLow));

  const rangeButtons: { id: "7d" | "30d" | "all"; label: string }[] = [
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "all", label: "All time" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
  <div>
    <h2 className="font-semibold">Graph range and filters</h2>
    {/* <p className="mt-1 text-sm text-[#6a7669]">
      Select a preset or a custom date range to refresh both nutrition and biometric charts.
    </p>
    <p className="mt-2 text-xs text-[#6a7669]">
      Showing data for {formatRangeLabel(normalizedStartDate, normalizedEndDate)}
    </p> */}
  </div>

  <div className="flex flex-wrap items-end justify-end gap-4">
    {/* Preset Buttons */}
    <div className="flex flex-wrap gap-2">
      {rangeButtons.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={() => setRangePreset(button.id)}
          className={`rounded-md border px-3 py-2 text-sm transition-colors ${
            rangePreset === button.id
              ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]"
              : "border-[#d8e2d5] hover:bg-[#f4f7f2]"
          }`}
        >
          {button.label}
        </button>
      ))}
    </div>

    {/* Start Date */}
    <label className="flex flex-col">
      <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
        Start date
      </span>
      <input
        type="date"
        min={minAvailableDate}
        max={maxAvailableDate}
        value={normalizedStartDate}
        onChange={(event) => {
          setRangePreset("custom");
          setCustomStartDate(
            clampDate(
              event.target.value,
              minAvailableDate,
              maxAvailableDate
            )
          );
        }}
        className="h-10 w-48 rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]"
      />
    </label>

    {/* End Date */}
    <label className="flex flex-col">
      <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
        End date
      </span>
      <input
        type="date"
        min={minAvailableDate}
        max={maxAvailableDate}
        value={normalizedEndDate}
        onChange={(event) => {
          setRangePreset("custom");
          setCustomEndDate(
            clampDate(
              event.target.value,
              minAvailableDate,
              maxAvailableDate
            )
          );
        }}
        className="h-10 w-48 rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]"
      />
    </label>
  </div>
</div>
      </section>


      <div className="grid gap-5 2xl:grid-cols-2">
        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Nutrition trend</h2>
              {/* <p className="text-sm text-[#6a7669]">
                Dual-axis line chart showing daily nutrient grams and calories over time.
              </p> */}
            </div>
            {latestNutrition ? (
              <p className="text-xs text-[#6a7669]">
                Latest in range: {latestNutrition.label} - {round(latestNutrition.calories, 0)} kcal
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <MiniMetric label="Avg calories/day" value={avgCalories === null ? "-" : `${round(avgCalories, 0)} kcal`} helper="" />
            <MiniMetric label="Avg carbs/day" value={avgCarbs === null ? "-" : `${round(avgCarbs)} g`} helper="" />
            <MiniMetric label="Avg proteins/day" value={avgProteins === null ? "-" : `${round(avgProteins)} g`} helper="" />
            <MiniMetric label="Avg fats/day" value={avgFats === null ? "-" : `${round(avgFats)} g`} helper="" />
            <MiniMetric label="Avg protein/carb ratio" value={avgRatio === null ? "-" : round(avgRatio)} helper="" />
          </div>

          {filteredNutritionSeries.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-6 text-sm text-[#6a7669]">
              No nutrition data falls within the selected range.
            </div>
          ) : (
            <>
              <div className="mt-5 h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredNutritionSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#e7eee4" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6a7669" }} minTickGap={24} />
                    <YAxis yAxisId="grams" tick={{ fontSize: 12, fill: "#6a7669" }} tickFormatter={(value: number) => `${value}g`} width={52} />
                    <YAxis yAxisId="calories" orientation="right" tick={{ fontSize: 12, fill: "#6a7669" }} tickFormatter={(value: number) => `${value}`} width={44} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#d8e2d5" }} formatter={nutritionTooltipFormatter} labelFormatter={(label) => `Date: ${label}`} />
                    <Legend />
                    <Line yAxisId="grams" type="monotone" dataKey="carbs" name="Carbs" stroke="#4f7f5d" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="grams" type="monotone" dataKey="proteins" name="Proteins" stroke="#245b35" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="grams" type="monotone" dataKey="fats" name="Fats" stroke="#c78b46" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="calories" type="monotone" dataKey="calories" name="Calories" stroke="#1b4965" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="calories" type="monotone" dataKey="targetCalories" name="Target calories" stroke="#9aa79b" strokeDasharray="6 6" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>

        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold">Biometric trend</h2>
              {/* <p className="text-sm text-[#6a7669]">
                Dual-axis line chart for BMI, weight, and blood pressure history.
              </p> */}
            </div>
            {latestMedical ? (
              <p className="text-xs text-[#6a7669]">
                Latest in range: {latestMedical.label} - BMI {round(latestMedical.bmi)}
              </p>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <MiniMetric label="Avg BMI" value={avgBmi === null ? "-" : round(avgBmi)} helper="" />
            <MiniMetric label="Avg weight" value={avgWeight === null ? "-" : `${round(avgWeight)} kg`} helper="" />
            <MiniMetric label="Avg BP" value={avgBpHigh === null || avgBpLow === null ? "-" : `${round(avgBpHigh, 0)}/${round(avgBpLow, 0)}`} helper="" />
          </div>

          {filteredBiometricSeries.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-6 text-sm text-[#6a7669]">
              No biometric data falls within the selected range.
            </div>
          ) : (
            <>
              <div className="mt-5 h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredBiometricSeries} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="#e7eee4" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6a7669" }} minTickGap={24} />
                    <YAxis yAxisId="body" tick={{ fontSize: 12, fill: "#6a7669" }} width={44} />
                    <YAxis yAxisId="bp" orientation="right" tick={{ fontSize: 12, fill: "#6a7669" }} width={44} />
                    <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#d8e2d5" }} formatter={biometricTooltipFormatter} labelFormatter={(label) => `Date: ${label}`} />
                    <Legend />
                    <Line yAxisId="body" type="monotone" dataKey="bmi" name="BMI" stroke="#245b35" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="body" type="monotone" dataKey="weight" name="Weight" stroke="#4f7f5d" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="bp" type="monotone" dataKey="bpHigh" name="BP High" stroke="#b55252" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="bp" type="monotone" dataKey="bpLow" name="BP Low" stroke="#e18f3f" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
function DatabaseTab({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodItem, initialState);
  const [foodSearch, setFoodSearch] = useState("");
  const [foodFilter, setFoodFilter] = useState<"all" | "highProtein" | "highCalories" | "lowCarb">("all");
  const [foodSort, setFoodSort] = useState<"name_asc" | "name_desc" | "calories_desc" | "proteins_desc" | "carbs_asc">("name_asc");
  const canEdit = data.currentUser.role === "ADMIN";

  const filteredFoodItems = useMemo(() => {
    const keyword = foodSearch.trim().toLowerCase();
    const filtered = data.foodItems.filter((item) => {
      const matchesSearch = !keyword || item.itemName.toLowerCase().includes(keyword);
      const matchesFilter =
        foodFilter === "all"
          ? true
          : foodFilter === "highProtein"
            ? item.proteins >= 15
            : foodFilter === "highCalories"
              ? item.calories >= 250
              : item.carbohydrates <= 10;

      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (foodSort) {
        case "name_desc":
          return b.itemName.localeCompare(a.itemName);
        case "calories_desc":
          return b.calories - a.calories;
        case "proteins_desc":
          return b.proteins - a.proteins;
        case "carbs_asc":
          return a.carbohydrates - b.carbohydrates;
        case "name_asc":
        default:
          return a.itemName.localeCompare(b.itemName);
      }
    });
  }, [data.foodItems, foodFilter, foodSearch, foodSort]);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      {canEdit ? (
        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Master food table</h2>
          <p className="mt-1 text-sm text-[#6a7669]">Nutrition values are stored per 100 grams.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="itemName" label="Item name" required />
            <Field name="carbohydrates" label="Carbohydrates" type="number" step="0.1" required />
            <Field name="proteins" label="Proteins" type="number" step="0.1" required />
            <Field name="fats" label="Fats" type="number" step="0.1" required />
            <Field name="calories" label="Calories" type="number" step="0.1" required />
          </div>
          <div className="mt-4"><ActionMessage state={state} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">Save item</button>
            {/* <button formAction={seedMasterFoods} className="h-10 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold hover:bg-[#f4f7f2]">Seed defaults</button> */}
          </div>
        </form>
      ) : null}
      <section className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4ece1] p-4">
          <div><h2 className="font-semibold">Food database</h2></div>
          <button onClick={() => downloadCsv("nutritrack-food-master.csv", [["Item", "Carbohydrates", "Proteins", "Fats", "Calories"], ...filteredFoodItems.map((item) => [item.itemName, item.carbohydrates, item.proteins, item.fats, item.calories])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button>
        </div>
        <div className="px-4 pb-4">
          <TableControls
            searchValue={foodSearch}
            onSearchChange={setFoodSearch}
            searchPlaceholder="Search food item"
            filterValue={foodFilter}
            onFilterChange={(value) => setFoodFilter(value as "all" | "highProtein" | "highCalories" | "lowCarb")}
            filterOptions={[
              { value: "all", label: "All foods" },
              { value: "highProtein", label: "High protein" },
              { value: "highCalories", label: "High calorie" },
              { value: "lowCarb", label: "Low carb" },
            ]}
            sortValue={foodSort}
            onSortChange={(value) => setFoodSort(value as "name_asc" | "name_desc" | "calories_desc" | "proteins_desc" | "carbs_asc")}
            sortOptions={[
              { value: "name_asc", label: "Name A to Z" },
              { value: "name_desc", label: "Name Z to A" },
              { value: "calories_desc", label: "Calories high to low" },
              { value: "proteins_desc", label: "Proteins high to low" },
              { value: "carbs_asc", label: "Carbs low to high" },
            ]}
          />
        </div>
        <div className="space-y-3 px-4 pb-4 lg:hidden">
          {filteredFoodItems.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-4 text-center text-sm text-[#6a7669]">No food items found.</p> : filteredFoodItems.map((item) => <article key={item.id} className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4"><p className="font-medium text-[#172117]">{item.itemName}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#4d5b4c]"><p><span className="font-medium text-[#172117]">Carbs:</span> {round(item.carbohydrates)}g</p><p><span className="font-medium text-[#172117]">Proteins:</span> {round(item.proteins)}g</p><p><span className="font-medium text-[#172117]">Fats:</span> {round(item.fats)}g</p><p><span className="font-medium text-[#172117]">Calories:</span> {round(item.calories, 0)}</p></div></article>)}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Item</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th><th className="p-3">Calories</th></tr></thead>
            <tbody>{filteredFoodItems.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-[#6a7669]">No food items found.</td></tr> : filteredFoodItems.map((item) => <tr key={item.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium">{item.itemName}</td><td className="p-3">{round(item.carbohydrates)}g</td><td className="p-3">{round(item.proteins)}g</td><td className="p-3">{round(item.fats)}g</td><td className="p-3">{round(item.calories, 0)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Profile({ data }: { data: DashboardData }) {
  const [profileState, profileAction] = useActionState(updateProfile, initialState);
  const [pinState, pinAction] = useActionState(updatePin, initialState);
  const [targetState, targetAction] = useActionState(saveNutritionTarget, initialState);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | "past" | "todayForward" | "highCalories">("all");
  const [targetSort, setTargetSort] = useState<"effective_desc" | "effective_asc" | "calories_desc" | "proteins_desc">("effective_desc");

  const filteredTargetProfiles = useMemo(() => {
    const keyword = targetSearch.trim().toLowerCase();
    const filtered = data.targetProfiles.filter((target) => {
      const matchesSearch =
        !keyword ||
        target.displayEffectiveFrom.toLowerCase().includes(keyword) ||
        target.effectiveFrom.includes(keyword);
      const matchesFilter =
        targetFilter === "all"
          ? true
          : targetFilter === "past"
            ? target.effectiveFrom < today
            : targetFilter === "todayForward"
              ? target.effectiveFrom >= today
              : target.targetCalories >= 2000;

      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (targetSort) {
        case "effective_asc":
          return a.effectiveFrom.localeCompare(b.effectiveFrom);
        case "calories_desc":
          return b.targetCalories - a.targetCalories;
        case "proteins_desc":
          return b.targetProteins - a.targetProteins;
        case "effective_desc":
        default:
          return b.effectiveFrom.localeCompare(a.effectiveFrom);
      }
    });
  }, [data.targetProfiles, targetFilter, targetSearch, targetSort]);

  return (
    <div className="grid gap-5 2xl:grid-cols-[0.88fr_1.12fr]">
      <div className="space-y-5">
        <form action={profileAction} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input type="hidden" name="userId" value={data.selectedUser.id} />
          <h2 className="font-semibold">Profile details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" defaultValue={data.selectedUser.name} required />
            <Field name="email" label="Email" type="email" defaultValue={data.selectedUser.email} required />
            <Field name="mobileNumber" label="Mobile number" defaultValue={data.selectedUser.mobileNumber} required />
            <Field name="startDate" label="Start date" type="date" defaultValue={data.selectedUser.startDate} required />
            <Field name="age" label="Age" type="number" defaultValue={data.selectedUser.age} />
            <Field name="gender" label="Gender" defaultValue={data.selectedUser.gender} />
            <Field name="conditions" label="Conditions" defaultValue={data.selectedUser.conditions} />
          </div>
          <div className="mt-4"><ActionMessage state={profileState} /></div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">Save profile</button>
        </form>

        <form action={targetAction} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input type="hidden" name="userId" value={data.selectedUser.id} />
          <h2 className="font-semibold">Nutrition targets by effective date</h2>
          {/* <p className="mt-1 text-sm text-[#6a7669]">Set the date from which the new target should apply. Older logs keep using older target profiles based on their log date.</p> */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="effectiveFrom" label="Effective from" type="date" defaultValue={today} required />
            <Field name="targetCalories" label="Target calories" type="number" step="0.1" defaultValue={data.selectedUser.activeTargets?.targetCalories ?? ""} required />
            <Field name="targetCarbs" label="Target carbs" type="number" step="0.1" defaultValue={data.selectedUser.activeTargets?.targetCarbs ?? ""} required />
            <Field name="targetProteins" label="Target proteins" type="number" step="0.1" defaultValue={data.selectedUser.activeTargets?.targetProteins ?? ""} required />
            <Field name="targetFats" label="Target fats" type="number" step="0.1" defaultValue={data.selectedUser.activeTargets?.targetFats ?? ""} required />
          </div>
          <div className="mt-4"><ActionMessage state={targetState} /></div>
          <button className="mt-4 h-10 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold hover:bg-[#f4f7f2]">Save target profile</button>
        </form>

        <form action={pinAction} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input type="hidden" name="userId" value={data.selectedUser.id} />
          <div className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#4f7f5d]" /><h2 className="font-semibold">{data.currentUser.role === "ADMIN" ? "Reset selected user PIN" : "Change PIN"}</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field name="pin" label="New 4 digit PIN" type="password" required placeholder="1234" /></div>
          <div className="mt-4"><ActionMessage state={pinState} /></div>
          <button className="mt-4 h-10 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold hover:bg-[#f4f7f2]">Save PIN</button>
        </form>
      </div>

      <section className="min-w-0 space-y-5">
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Account summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><StatCard label="Days on app" value={`${data.selectedUser.daysOnApp}`} helper="Based on start date" icon={UserRound} /><StatCard label="Days tracked" value={`${data.selectedUser.daysTracked}`} helper="Distinct food log dates" icon={Activity} /></div>
        </div>
        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Target history</h2></div><button onClick={() => downloadCsv("nutritrack-target-history.csv", [["Effective From", "Calories", "Carbs", "Proteins", "Fats"], ...filteredTargetProfiles.map((target) => [target.displayEffectiveFrom, target.targetCalories, target.targetCarbs, target.targetProteins, target.targetFats])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button></div>
          <TableControls
            searchValue={targetSearch}
            onSearchChange={setTargetSearch}
            searchPlaceholder="Search effective date"
            filterValue={targetFilter}
            onFilterChange={(value) => setTargetFilter(value as "all" | "past" | "todayForward" | "highCalories")}
            filterOptions={[
              { value: "all", label: "All targets" },
              { value: "past", label: "Past targets" },
              { value: "todayForward", label: "Today onward" },
              { value: "highCalories", label: "2000+ kcal" },
            ]}
            sortValue={targetSort}
            onSortChange={(value) => setTargetSort(value as "effective_desc" | "effective_asc" | "calories_desc" | "proteins_desc")}
            sortOptions={[
              { value: "effective_desc", label: "Newest effective date" },
              { value: "effective_asc", label: "Oldest effective date" },
              { value: "calories_desc", label: "Calories high to low" },
              { value: "proteins_desc", label: "Proteins high to low" },
            ]}
          />
          <div className="mt-4 space-y-3 lg:hidden">
            {filteredTargetProfiles.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-4 text-center text-sm text-[#6a7669]">No target history found.</p> : filteredTargetProfiles.map((target) => <article key={target.id} className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4"><p className="font-medium text-[#172117]">{target.displayEffectiveFrom}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#4d5b4c]"><p><span className="font-medium text-[#172117]">Calories:</span> {round(target.targetCalories, 0)}</p><p><span className="font-medium text-[#172117]">Carbs:</span> {round(target.targetCarbs)}g</p><p><span className="font-medium text-[#172117]">Proteins:</span> {round(target.targetProteins)}g</p><p><span className="font-medium text-[#172117]">Fats:</span> {round(target.targetFats)}g</p></div></article>)}
          </div>
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Effective from</th><th className="p-3">Calories</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th></tr></thead>
              <tbody>{filteredTargetProfiles.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-[#6a7669]">No target history found.</td></tr> : filteredTargetProfiles.map((target) => <tr key={target.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium">{target.displayEffectiveFrom}</td><td className="p-3">{round(target.targetCalories, 0)}</td><td className="p-3">{round(target.targetCarbs)}g</td><td className="p-3">{round(target.targetProteins)}g</td><td className="p-3">{round(target.targetFats)}g</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function Admin({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(createUser, initialState);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | Role>("all");
  const [userSort, setUserSort] = useState<"name_asc" | "name_desc" | "tracking_desc" | "days_desc">("name_asc");
  const [comparisonSearch, setComparisonSearch] = useState("");
  const [comparisonRoleFilter, setComparisonRoleFilter] = useState<"all" | Role>("all");
  const [comparisonSort, setComparisonSort] = useState<"tracking_desc" | "logs_desc" | "calories_desc" | "name_asc">("tracking_desc");

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    const filtered = data.users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.mobileNumber.includes(keyword);
      const matchesFilter = userRoleFilter === "all" ? true : user.role === userRoleFilter;
      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (userSort) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "tracking_desc":
          return b.trackingRate - a.trackingRate;
        case "days_desc":
          return b.daysTracked - a.daysTracked;
        case "name_asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [data.users, userRoleFilter, userSearch, userSort]);

  const filteredComparisonRows = useMemo(() => {
    const keyword = comparisonSearch.trim().toLowerCase();
    const filtered = data.comparisonRows.filter((row) => {
      const matchesSearch =
        !keyword ||
        row.name.toLowerCase().includes(keyword) ||
        row.email.toLowerCase().includes(keyword) ||
        row.mobileNumber.includes(keyword);
      const matchesFilter = comparisonRoleFilter === "all" ? true : row.role === comparisonRoleFilter;
      return matchesSearch && matchesFilter;
    });

    return [...filtered].sort((a, b) => {
      switch (comparisonSort) {
        case "logs_desc":
          return b.totalLogs - a.totalLogs;
        case "calories_desc":
          return b.avgCaloriesPerLog - a.avgCaloriesPerLog;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "tracking_desc":
        default:
          return b.trackingRate - a.trackingRate;
      }
    });
  }, [comparisonRoleFilter, comparisonSearch, comparisonSort, data.comparisonRows]);

  if (!data.adminMetrics) return null;

  return (
    <div className="grid gap-5 2xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><StatCard label="Users" value={`${data.adminMetrics.totalUsers}`} helper="User accounts" icon={Users} /><StatCard label="Admins" value={`${data.adminMetrics.totalAdmins}`} helper="Admin accounts" icon={ShieldCheck} /><StatCard label="Avg calories" value={round(data.adminMetrics.avgCalories, 0)} helper="Average per food log" icon={Activity} /><StatCard label="High BP records" value={`${data.adminMetrics.highBpCount}`} helper=">= 130/80" icon={HeartPulse} /></div>
        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Create user</h2>
          <div className="mt-4 space-y-4">
            <section className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4f7f5d]">User details</h3>
                <p className="mt-1 text-sm text-[#6a7669]">Basic account, profile, and access information.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="name" label="Name" required />
                <Field name="email" label="Email" type="email" required />
                <Field name="mobileNumber" label="Mobile number" required />
                <Field name="pin" label="4 digit PIN" required />
                <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Role</span><select name="role" className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
                <Field name="startDate" label="Start date" type="date" defaultValue={today} required />
                <Field name="age" label="Age" type="number" />
                <Field name="gender" label="Gender" />
                <div className="sm:col-span-2">
                  <Field name="conditions" label="Conditions" />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4f7f5d]">Target details</h3>
                <p className="mt-1 text-sm text-[#6a7669]">Initial nutrition goals that will apply from the selected effective date.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field name="targetEffectiveFrom" label="Target effective from" type="date" defaultValue={today} required />
                <Field name="targetCalories" label="Target calories" type="number" step="0.1" defaultValue="2000" required />
                <Field name="targetCarbs" label="Target carbs" type="number" step="0.1" defaultValue="80" required />
                <Field name="targetProteins" label="Target proteins" type="number" step="0.1" defaultValue="60" required />
                <Field name="targetFats" label="Target fats" type="number" step="0.1" defaultValue="150" required />
              </div>
            </section>
          </div>
          <div className="mt-4"><ActionMessage state={state} /></div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">Create user</button>
        </form>
      </section>
      <section className="space-y-5">
        <section className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4"><h2 className="font-semibold">All users</h2><TableControls searchValue={userSearch} onSearchChange={setUserSearch} searchPlaceholder="Search by name, email, or mobile" filterValue={userRoleFilter} onFilterChange={(value) => setUserRoleFilter(value as "all" | Role)} filterOptions={[{ value: "all", label: "All roles" }, { value: "USER", label: "Users" }, { value: "ADMIN", label: "Admins" }]} sortValue={userSort} onSortChange={(value) => setUserSort(value as "name_asc" | "name_desc" | "tracking_desc" | "days_desc")} sortOptions={[{ value: "name_asc", label: "Name A to Z" }, { value: "name_desc", label: "Name Z to A" }, { value: "tracking_desc", label: "Tracking high to low" }, { value: "days_desc", label: "Days tracked high to low" }]} /></div>
          <div className="space-y-3 p-4 lg:hidden">
            {filteredUsers.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-4 text-center text-sm text-[#6a7669]">No users found.</p> : filteredUsers.map((user) => <article key={user.id} className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4"><a href={`/dashboard?userId=${user.id}`} className="font-medium text-[#245b35] hover:underline">{user.name}</a><p className="mt-1 text-sm text-[#6a7669]">{user.email}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#4d5b4c]"><p><span className="font-medium text-[#172117]">Mobile:</span> {user.mobileNumber}</p><p><span className="font-medium text-[#172117]">Role:</span> {user.role}</p><p><span className="font-medium text-[#172117]">Days tracked:</span> {user.daysTracked}</p><p><span className="font-medium text-[#172117]">Tracking:</span> {Math.round(user.trackingRate)}%</p></div></article>)}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Mobile</th><th className="p-3">Role</th><th className="p-3">Days tracked</th><th className="p-3">Tracking %</th></tr></thead>
              <tbody>{filteredUsers.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-[#6a7669]">No users found.</td></tr> : filteredUsers.map((user) => <tr key={user.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium"><a href={`/dashboard?userId=${user.id}`} className="text-[#245b35] hover:underline">{user.name}</a></td><td className="p-3">{user.email}</td><td className="p-3">{user.mobileNumber}</td><td className="p-3">{user.role}</td><td className="p-3">{user.daysTracked}</td><td className="p-3">{Math.round(user.trackingRate)}%</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="min-w-0 rounded-lg border border-[#dbe5d8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4ece1] p-4"><div><h2 className="font-semibold">Cross-user comparison</h2><p className="text-sm text-[#6a7669]">Compare intake, tracking, and latest medical values.</p></div><button onClick={() => downloadCsv("nutritrack-admin-comparison.csv", [["Name", "Email", "Mobile", "Role", "Total Logs", "Days Tracked", "Tracking %", "Avg Calories/Log", "Avg Carbs/Log", "Avg Proteins/Log", "Avg Fats/Log", "Latest BMI", "Latest BP Low", "Latest BP High", "Latest Medical Date"], ...filteredComparisonRows.map((row) => [row.name, row.email, row.mobileNumber, row.role, row.totalLogs, row.daysTracked, Math.round(row.trackingRate), row.avgCaloriesPerLog, row.avgCarbsPerLog, row.avgProteinsPerLog, row.avgFatsPerLog, row.latestBmi, row.latestBpLow, row.latestBpHigh, row.latestMedicalDate])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button></div>
          <div className="px-4 pb-4"><TableControls searchValue={comparisonSearch} onSearchChange={setComparisonSearch} searchPlaceholder="Search user, email, or mobile" filterValue={comparisonRoleFilter} onFilterChange={(value) => setComparisonRoleFilter(value as "all" | Role)} filterOptions={[{ value: "all", label: "All roles" }, { value: "USER", label: "Users" }, { value: "ADMIN", label: "Admins" }]} sortValue={comparisonSort} onSortChange={(value) => setComparisonSort(value as "tracking_desc" | "logs_desc" | "calories_desc" | "name_asc")} sortOptions={[{ value: "tracking_desc", label: "Tracking high to low" }, { value: "logs_desc", label: "Logs high to low" }, { value: "calories_desc", label: "Avg kcal high to low" }, { value: "name_asc", label: "Name A to Z" }]} /></div>
          <div className="space-y-3 px-4 pb-4 lg:hidden">
            {filteredComparisonRows.length === 0 ? <p className="rounded-lg border border-dashed border-[#d8e2d5] bg-[#f9fbf8] p-4 text-center text-sm text-[#6a7669]">No comparison rows found.</p> : filteredComparisonRows.map((row) => <article key={row.userId} className="rounded-lg border border-[#e4ece1] bg-[#f9fbf8] p-4"><a href={`/dashboard?userId=${row.userId}`} className="font-medium text-[#245b35] hover:underline">{row.name}</a><p className="mt-1 text-sm text-[#6a7669]">{row.email}</p><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#4d5b4c]"><p><span className="font-medium text-[#172117]">Logs:</span> {row.totalLogs}</p><p><span className="font-medium text-[#172117]">Tracked days:</span> {row.daysTracked}</p><p><span className="font-medium text-[#172117]">Tracking:</span> {Math.round(row.trackingRate)}%</p><p><span className="font-medium text-[#172117]">Avg kcal:</span> {round(row.avgCaloriesPerLog, 0)}</p><p><span className="font-medium text-[#172117]">Avg carbs:</span> {round(row.avgCarbsPerLog)}g</p><p><span className="font-medium text-[#172117]">Avg proteins:</span> {round(row.avgProteinsPerLog)}g</p><p><span className="font-medium text-[#172117]">Avg fats:</span> {round(row.avgFatsPerLog)}g</p><p><span className="font-medium text-[#172117]">Latest BMI:</span> {row.latestBmi === null ? "-" : round(row.latestBmi)}</p></div><p className="mt-3 text-sm text-[#4d5b4c]"><span className="font-medium text-[#172117]">Latest BP:</span> {row.latestBpHigh && row.latestBpLow ? `${round(row.latestBpHigh, 0)}/${round(row.latestBpLow, 0)}` : "-"}</p></article>)}
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">User</th><th className="p-3">Logs</th><th className="p-3">Tracked days</th><th className="p-3">Tracking %</th><th className="p-3">Avg kcal</th><th className="p-3">Avg carbs</th><th className="p-3">Avg proteins</th><th className="p-3">Avg fats</th><th className="p-3">Latest BMI</th><th className="p-3">Latest BP</th></tr></thead>
              <tbody>{filteredComparisonRows.length === 0 ? <tr><td colSpan={10} className="p-4 text-center text-[#6a7669]">No comparison rows found.</td></tr> : filteredComparisonRows.map((row) => <tr key={row.userId} className="border-t border-[#eef3ec]"><td className="p-3"><a href={`/dashboard?userId=${row.userId}`} className="font-medium text-[#245b35] hover:underline">{row.name}</a><p className="text-xs text-[#6a7669]">{row.email}</p></td><td className="p-3">{row.totalLogs}</td><td className="p-3">{row.daysTracked}</td><td className="p-3">{Math.round(row.trackingRate)}%</td><td className="p-3">{round(row.avgCaloriesPerLog, 0)}</td><td className="p-3">{round(row.avgCarbsPerLog)}g</td><td className="p-3">{round(row.avgProteinsPerLog)}g</td><td className="p-3">{round(row.avgFatsPerLog)}g</td><td className="p-3">{row.latestBmi === null ? "-" : round(row.latestBmi)}</td><td className="p-3">{row.latestBpHigh && row.latestBpLow ? `${round(row.latestBpHigh, 0)}/${round(row.latestBpLow, 0)}` : "-"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

export function NutriTrackApp({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<Tab>(data.currentUser.role === "ADMIN" ? "admin" : "tracker");

  return (
    <Shell data={data} tab={tab} setTab={setTab}>
      {tab === "tracker" ? <Tracker data={data} /> : null}
      {tab === "medical" ? <Medical data={data} /> : null}
      {tab === "graphs" ? <Graphs data={data} /> : null}
      {tab === "database" ? <DatabaseTab data={data} /> : null}
      {tab === "profile" ? <Profile data={data} /> : null}
      {tab === "admin" ? <Admin data={data} /> : null}
    </Shell>
  );
}


