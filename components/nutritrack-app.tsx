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
  Plus,
  Sprout,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { InstallAppButton } from "@/components/install-app-button";
import {
  createUser,
  deleteFoodLog,
  deleteMedicalRecord,
  saveFoodItem,
  saveFoodLog,
  saveMedicalRecord,
  seedMasterFoods,
  signOut,
  updatePin,
  updateProfile,
  type ActionState,
} from "@/lib/actions";

type Role = "PATIENT" | "ADMIN";

type UserSummary = {
  id: string;
  email: string;
  name: string;
  role: Role;
  age: number | null;
  gender: string | null;
  conditions: string | null;
  targetCarbs: number;
  targetProteins: number;
  targetFats: number;
  targetCalories: number;
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
  quantityGms: number;
  carbs: number;
  proteins: number;
  fats: number;
  calories: number;
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

type SelectedSummary = {
  totalFoodLogs: number;
  totalMedicalRecords: number;
  totalCalories: number;
  totalCarbs: number;
  totalProteins: number;
  totalFats: number;
  latestMedical: {
    date: string;
    bmi: number;
    bpLow: number;
    bpHigh: number;
    weight: number;
    height: number;
  } | null;
};

type ComparisonRow = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  totalLogs: number;
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
  selectedSummary: SelectedSummary;
  adminMetrics: {
    totalPatients: number;
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

function round(value: number, places = 1) {
  return Number.isFinite(value) ? value.toFixed(places) : "0.0";
}

function sum(logs: FoodLog[], key: "carbs" | "proteins" | "fats" | "calories") {
  return logs.reduce((total, log) => total + log[key], 0);
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
        {label}
      </span>
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

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e4ece1] bg-[#f8fbf7] px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6a7669]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#203120]">{value}</p>
    </div>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${
        state.ok ? "bg-[#edf7ec] text-[#245b35]" : "bg-[#fff4e8] text-[#8a4a12]"
      }`}
    >
      {state.message}
    </p>
  );
}

function StatCard({
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

function ProgressBar({ value, target }: { value: number; target: number }) {
  const width = target <= 0 ? 0 : Math.min((value / target) * 100, 140);

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e5eee2]">
      <div
        className={`h-full rounded-full ${width > 100 ? "bg-[#bf5a4c]" : "bg-[#4f7f5d]"}`}
        style={{ width: `${Math.min(width, 100)}%` }}
      />
    </div>
  );
}

function Shell({
  data,
  tab,
  setTab,
  children,
}: {
  data: DashboardData;
  tab: Tab;
  setTab: (tab: Tab) => void;
  children: React.ReactNode;
}) {
  const tabs: { id: Tab; label: string; icon: typeof Activity; adminOnly?: boolean }[] = [
    { id: "tracker", label: "Tracker", icon: Apple },
    { id: "medical", label: "Medical", icon: HeartPulse },
    { id: "graphs", label: "Graphs", icon: BarChart3 },
    { id: "database", label: "Database", icon: Database },
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
  ];

  return (
    <main className="min-h-screen bg-[#f7faf5] text-[#172117]">
      <header className="sticky top-0 z-20 border-b border-[#dbe5d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#245b35] font-bold text-white">
              N
            </div>
            <div>
              <p className="font-semibold">NutriTrack</p>
              <p className="text-xs text-[#6a7669]">
                {data.currentUser.role === "ADMIN" ? "Admin workspace" : "Patient workspace"}
              </p>
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {tabs
              .filter((item) => !item.adminOnly || data.currentUser.role === "ADMIN")
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap ${
                    tab === item.id
                      ? "bg-[#245b35] text-white"
                      : "text-[#4d5b4c] hover:bg-[#edf3ea]"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              ))}
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <InstallAppButton compactLabel="Install" />
            <form action={signOut}>
              <button className="flex h-10 items-center gap-2 rounded-md border border-[#d8e2d5] px-3 text-sm font-medium hover:bg-[#edf3ea]">
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <section className="mb-5 rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">
                  Viewing
                </p>
                <h1 className="mt-1 text-2xl font-semibold">{data.selectedUser.name}</h1>
                <p className="text-sm text-[#6a7669]">{data.selectedUser.email}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <InfoChip label="Role" value={data.selectedUser.role} />
                <InfoChip label="Food logs" value={`${data.selectedSummary.totalFoodLogs}`} />
                <InfoChip
                  label="Medical updates"
                  value={`${data.selectedSummary.totalMedicalRecords}`}
                />
                <InfoChip
                  label="Latest BMI"
                  value={
                    data.selectedSummary.latestMedical
                      ? round(data.selectedSummary.latestMedical.bmi)
                      : "Not available"
                  }
                />
              </div>
            </div>

            {data.currentUser.role === "ADMIN" ? (
              <div className="flex max-w-full flex-wrap gap-2">
                {data.users.map((user) => (
                  <a
                    key={user.id}
                    href={`/dashboard?userId=${user.id}`}
                    className={`rounded-md border px-3 py-2 text-sm ${
                      user.id === data.selectedUser.id
                        ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]"
                        : "border-[#d8e2d5] hover:bg-[#f4f7f2]"
                    }`}
                  >
                    {user.name}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {children}
      </div>
    </main>
  );
}

function Tracker({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodLog, initialState);
  const totals = {
    carbs: sum(data.foodLogs, "carbs"),
    proteins: sum(data.foodLogs, "proteins"),
    fats: sum(data.foodLogs, "fats"),
    calories: sum(data.foodLogs, "calories"),
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          <StatCard
            label="Calories"
            value={round(totals.calories, 0)}
            helper={`Target ${round(data.selectedUser.targetCalories, 0)} kcal`}
            icon={Activity}
          />
          <StatCard
            label="Carbs"
            value={`${round(totals.carbs)}g`}
            helper={`Target ${round(data.selectedUser.targetCarbs)}g`}
            icon={Apple}
          />
          <StatCard
            label="Proteins"
            value={`${round(totals.proteins)}g`}
            helper={`Target ${round(data.selectedUser.targetProteins)}g`}
            icon={Sprout}
          />
          <StatCard
            label="Fats"
            value={`${round(totals.fats)}g`}
            helper={`Target ${round(data.selectedUser.targetFats)}g`}
            icon={BarChart3}
          />
        </div>

        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input name="userId" type="hidden" value={data.selectedUser.id} />
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-4 text-[#4f7f5d]" />
            <h2 className="font-semibold">Log daily intake</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
                Food item
              </span>
              <select
                name="foodItemId"
                required
                className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"
              >
                <option value="">Select food</option>
                {data.foodItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemName}
                  </option>
                ))}
              </select>
            </label>
            <Field name="date" label="Date" type="date" defaultValue={today} required />
            <Field name="dishName" label="Dish / meal" defaultValue="Meal" required />
            <Field name="quantityGms" label="Quantity grams" type="number" step="0.1" required />
          </div>
          <div className="mt-4">
            <ActionMessage state={state} />
          </div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
            Add food log
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-[#dbe5d8] bg-white">
        <div className="border-b border-[#e4ece1] p-4">
          <h2 className="font-semibold">Meals and ingredients eaten</h2>
          <p className="text-sm text-[#6a7669]">Latest records for the selected patient.</p>
        </div>
        <div className="divide-y divide-[#eef3ec]">
          {data.foodLogs.length === 0 ? (
            <p className="p-5 text-sm text-[#6a7669]">No intake logs yet.</p>
          ) : (
            data.foodLogs.map((log) => (
              <div key={log.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium">{log.dishName}</p>
                  <p className="text-sm text-[#6a7669]">
                    {log.displayDate} - {log.foodItem} - {round(log.quantityGms, 0)}g
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <span>{round(log.carbs)}g carbs</span>
                    <span>{round(log.proteins)}g protein</span>
                    <span>{round(log.fats)}g fats</span>
                    <span>{round(log.calories, 0)} kcal</span>
                  </div>
                </div>
                <form action={deleteFoodLog}>
                  <input type="hidden" name="id" value={log.id} />
                  <button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32]">
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Medical({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveMedicalRecord, initialState);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <input name="userId" type="hidden" value={data.selectedUser.id} />
        <h2 className="font-semibold">Add medical data</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="date" label="Date" type="date" defaultValue={today} required />
          <Field name="weight" label="Weight kg" type="number" step="0.1" required />
          <Field name="height" label="Height cm" type="number" step="0.1" required />
          <Field name="bpLow" label="BP low" type="number" step="1" required />
          <Field name="bpHigh" label="BP high" type="number" step="1" required />
        </div>
        <div className="mt-4">
          <ActionMessage state={state} />
        </div>
        <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
          Save medical record
        </button>
      </form>

      <section className="rounded-lg border border-[#dbe5d8] bg-white">
        <div className="border-b border-[#e4ece1] p-4">
          <h2 className="font-semibold">Biometric history</h2>
          <p className="text-sm text-[#6a7669]">Each update creates a dated medical record.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {data.medicalRecords.length === 0 ? (
            <p className="text-sm text-[#6a7669]">No medical records yet.</p>
          ) : (
            data.medicalRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-[#e4ece1] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-medium">{record.displayDate}</p>
                  <form action={deleteMedicalRecord}>
                    <input type="hidden" name="id" value={record.id} />
                    <button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32]">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>Weight: {round(record.weight)} kg</p>
                  <p>Height: {round(record.height)} cm</p>
                  <p>BMI: {round(record.bmi)}</p>
                  <p>
                    BP: {round(record.bpHigh, 0)}/{round(record.bpLow, 0)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Graphs({ data }: { data: DashboardData }) {
  const dailyTotals = useMemo(() => {
    const map = new Map<
      string,
      { date: string; calories: number; carbs: number; proteins: number; fats: number }
    >();
    data.foodLogs.forEach((log) => {
      const existing = map.get(log.displayDate) ?? {
        date: log.displayDate,
        calories: 0,
        carbs: 0,
        proteins: 0,
        fats: 0,
      };
      existing.calories += log.calories;
      existing.carbs += log.carbs;
      existing.proteins += log.proteins;
      existing.fats += log.fats;
      map.set(log.displayDate, existing);
    });
    return Array.from(map.values()).reverse();
  }, [data.foodLogs]);

  const maxCalories = Math.max(1, ...dailyTotals.map((item) => item.calories));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.85fr]">
      <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <h2 className="font-semibold">Nutrition trend</h2>
        <div className="mt-5 space-y-4">
          {dailyTotals.length === 0 ? (
            <p className="text-sm text-[#6a7669]">Log food to build charts.</p>
          ) : (
            dailyTotals.map((item) => (
              <div key={item.date} className="grid grid-cols-[86px_1fr_64px] items-center gap-3">
                <span className="text-xs text-[#6a7669]">{item.date}</span>
                <div className="h-8 rounded-md bg-[#edf3ea]">
                  <div
                    className="h-8 rounded-md bg-[#4f7f5d]"
                    style={{ width: `${Math.max(4, (item.calories / maxCalories) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-sm font-medium">{round(item.calories, 0)}</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <StatCard
          label="Latest BMI"
          value={data.medicalRecords[0] ? round(data.medicalRecords[0].bmi) : "0.0"}
          helper="From newest medical record"
          icon={HeartPulse}
        />
        <StatCard
          label="Latest BP"
          value={
            data.medicalRecords[0]
              ? `${round(data.medicalRecords[0].bpHigh, 0)}/${round(data.medicalRecords[0].bpLow, 0)}`
              : "0/0"
          }
          helper="Systolic / diastolic"
          icon={Activity}
        />
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h3 className="font-semibold">Target progress</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between">
                <span>Calories</span>
                <span>{round(sum(data.foodLogs, "calories"), 0)}</span>
              </div>
              <ProgressBar
                value={sum(data.foodLogs, "calories")}
                target={data.selectedUser.targetCalories}
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Carbs</span>
                <span>{round(sum(data.foodLogs, "carbs"))}g</span>
              </div>
              <ProgressBar value={sum(data.foodLogs, "carbs")} target={data.selectedUser.targetCarbs} />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Proteins</span>
                <span>{round(sum(data.foodLogs, "proteins"))}g</span>
              </div>
              <ProgressBar
                value={sum(data.foodLogs, "proteins")}
                target={data.selectedUser.targetProteins}
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Fats</span>
                <span>{round(sum(data.foodLogs, "fats"))}g</span>
              </div>
              <ProgressBar value={sum(data.foodLogs, "fats")} target={data.selectedUser.targetFats} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DatabaseTab({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodItem, initialState);
  const canEdit = data.currentUser.role === "ADMIN";

  return (
    <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      {canEdit ? (
        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Master food table</h2>
          <p className="mt-1 text-sm text-[#6a7669]">Nutrition values are per 100 grams.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="itemName" label="Item name" required />
            <Field name="carbohydrates" label="Carbohydrates" type="number" step="0.1" required />
            <Field name="proteins" label="Proteins" type="number" step="0.1" required />
            <Field name="fats" label="Fats" type="number" step="0.1" required />
            <Field name="calories" label="Calories" type="number" step="0.1" required />
          </div>
          <div className="mt-4">
            <ActionMessage state={state} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
              Save item
            </button>
            {/* <button
              formAction={seedMasterFoods}
              className="h-10 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold"
            >
              Seed defaults
            </button> */}
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-[#dbe5d8] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4ece1] p-4">
          <div>
            <h2 className="font-semibold">Food database</h2>
            <p className="text-sm text-[#6a7669]">Centralized for every patient.</p>
          </div>
          <button
            onClick={() =>
              downloadCsv("nutritrack-food-master.csv", [
                ["Item", "Carbohydrates", "Proteins", "Fats", "Calories"],
                ...data.foodItems.map((item) => [
                  item.itemName,
                  item.carbohydrates,
                  item.proteins,
                  item.fats,
                  item.calories,
                ]),
              ])
            }
            className="rounded-md border border-[#d8e2d5] p-2"
          >
            <Download className="size-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-[#f4f8f2] text-left">
              <tr>
                <th className="p-3">Item</th>
                <th className="p-3">Carbs</th>
                <th className="p-3">Proteins</th>
                <th className="p-3">Fats</th>
                <th className="p-3">Calories</th>
              </tr>
            </thead>
            <tbody>
              {data.foodItems.map((item) => (
                <tr key={item.id} className="border-t border-[#eef3ec]">
                  <td className="p-3 font-medium">{item.itemName}</td>
                  <td className="p-3">{round(item.carbohydrates)}g</td>
                  <td className="p-3">{round(item.proteins)}g</td>
                  <td className="p-3">{round(item.fats)}g</td>
                  <td className="p-3">{round(item.calories, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Profile({ data }: { data: DashboardData }) {
  const [profileState, profileAction] = useActionState(updateProfile, initialState);
  const [pinState, pinAction] = useActionState(updatePin, initialState);

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <form action={profileAction} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input type="hidden" name="userId" value={data.selectedUser.id} />
          <h2 className="font-semibold">Profile and targets</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" defaultValue={data.selectedUser.name} required />
            <Field name="age" label="Age" type="number" defaultValue={data.selectedUser.age} />
            <Field name="gender" label="Gender" defaultValue={data.selectedUser.gender} />
            <Field name="conditions" label="Conditions" defaultValue={data.selectedUser.conditions} />
            <Field
              name="targetCarbs"
              label="Target carbs"
              type="number"
              step="0.1"
              defaultValue={data.selectedUser.targetCarbs}
              required
            />
            <Field
              name="targetProteins"
              label="Target proteins"
              type="number"
              step="0.1"
              defaultValue={data.selectedUser.targetProteins}
              required
            />
            <Field
              name="targetFats"
              label="Target fats"
              type="number"
              step="0.1"
              defaultValue={data.selectedUser.targetFats}
              required
            />
            <Field
              name="targetCalories"
              label="Target calories"
              type="number"
              step="0.1"
              defaultValue={data.selectedUser.targetCalories}
              required
            />
          </div>
          <div className="mt-4">
            <ActionMessage state={profileState} />
          </div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
            Save profile
          </button>
        </form>

        <form action={pinAction} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input type="hidden" name="userId" value={data.selectedUser.id} />
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-[#4f7f5d]" />
            <h2 className="font-semibold">
              {data.currentUser.role === "ADMIN" ? "Reset selected user PIN" : "Change PIN"}
            </h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              name="pin"
              label="New 4 digit PIN"
              type="password"
              required
              placeholder="1234"
            />
          </div>
          <div className="mt-4">
            <ActionMessage state={pinState} />
          </div>
          <button className="mt-4 h-10 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold">
            Save PIN
          </button>
        </form>
      </div>

      <section className="space-y-5">
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Account details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoChip label="Email" value={data.selectedUser.email} />
            <InfoChip label="Role" value={data.selectedUser.role} />
            <InfoChip label="Food logs" value={`${data.selectedSummary.totalFoodLogs}`} />
            <InfoChip label="Medical records" value={`${data.selectedSummary.totalMedicalRecords}`} />
          </div>
        </div>

        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Exports</h2>
          <p className="mt-1 text-sm text-[#6a7669]">Download patient-specific records as CSV.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() =>
                downloadCsv("nutritrack-food-logs.csv", [
                  ["Date", "Dish", "Food", "Quantity", "Carbs", "Proteins", "Fats", "Calories"],
                  ...data.foodLogs.map((log) => [
                    log.displayDate,
                    log.dishName,
                    log.foodItem,
                    log.quantityGms,
                    log.carbs,
                    log.proteins,
                    log.fats,
                    log.calories,
                  ]),
                ])
              }
              className="flex h-10 items-center gap-2 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold"
            >
              <Download className="size-4" />
              Daily logs
            </button>
            <button
              onClick={() =>
                downloadCsv("nutritrack-medical-records.csv", [
                  ["Date", "Weight", "Height", "BMI", "BP Low", "BP High"],
                  ...data.medicalRecords.map((record) => [
                    record.displayDate,
                    record.weight,
                    record.height,
                    record.bmi,
                    record.bpLow,
                    record.bpHigh,
                  ]),
                ])
              }
              className="flex h-10 items-center gap-2 rounded-md border border-[#d8e2d5] px-4 text-sm font-semibold"
            >
              <Download className="size-4" />
              Medical data
            </button>
          </div>
        </section>
      </section>
    </div>
  );
}

function Admin({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(createUser, initialState);

  if (!data.adminMetrics) {
    return null;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Patients" value={`${data.adminMetrics.totalPatients}`} helper="Patient accounts" icon={Users} />
          <StatCard label="Food logs" value={`${data.adminMetrics.totalFoodLogs}`} helper="Latest loaded records" icon={Apple} />
          <StatCard label="Avg calories" value={round(data.adminMetrics.avgCalories, 0)} helper="Average per log" icon={Activity} />
          <StatCard label="High BP records" value={`${data.adminMetrics.highBpCount}`} helper=">= 130/80" icon={HeartPulse} />
        </div>

        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Create user</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="pin" label="4 digit PIN" required />
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
                Role
              </span>
              <select name="role" className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm">
                <option value="PATIENT">Patient</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <Field name="age" label="Age" type="number" />
            <Field name="gender" label="Gender" />
            <Field name="conditions" label="Conditions" />
          </div>
          <div className="mt-4">
            <ActionMessage state={state} />
          </div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-5">
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4">
            <h2 className="font-semibold">All users</h2>
            <p className="text-sm text-[#6a7669]">Open a user from the selector to view all their details.</p>
          </div>
          <div className="divide-y divide-[#eef3ec]">
            {data.users.map((user) => (
              <a
                key={user.id}
                href={`/dashboard?userId=${user.id}`}
                className="grid gap-2 p-4 hover:bg-[#f7faf5] sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-[#6a7669]">{user.email}</p>
                </div>
                <p className="text-sm text-[#6a7669]">
                  {user.role} - {user.foodLogs ?? 0} logs - {user.medicalRecords ?? 0} medical
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4ece1] p-4">
            <div>
              <h2 className="font-semibold">Cross-patient comparison</h2>
              <p className="text-sm text-[#6a7669]">Compare activity, nutrition averages, and latest biometrics.</p>
            </div>
            <button
              onClick={() =>
                downloadCsv("nutritrack-admin-comparison.csv", [
                  [
                    "Name",
                    "Email",
                    "Role",
                    "Total Logs",
                    "Avg Calories/Log",
                    "Avg Carbs/Log",
                    "Avg Proteins/Log",
                    "Avg Fats/Log",
                    "Latest BMI",
                    "Latest BP Low",
                    "Latest BP High",
                    "Latest Medical Date",
                  ],
                  ...data.comparisonRows.map((row) => [
                    row.name,
                    row.email,
                    row.role,
                    row.totalLogs,
                    row.avgCaloriesPerLog,
                    row.avgCarbsPerLog,
                    row.avgProteinsPerLog,
                    row.avgFatsPerLog,
                    row.latestBmi,
                    row.latestBpLow,
                    row.latestBpHigh,
                    row.latestMedicalDate,
                  ]),
                ])
              }
              className="rounded-md border border-[#d8e2d5] p-2"
            >
              <Download className="size-4" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[#f4f8f2] text-left">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Logs</th>
                  <th className="p-3">Avg kcal</th>
                  <th className="p-3">Avg carbs</th>
                  <th className="p-3">Avg proteins</th>
                  <th className="p-3">Avg fats</th>
                  <th className="p-3">Latest BMI</th>
                  <th className="p-3">Latest BP</th>
                </tr>
              </thead>
              <tbody>
                {data.comparisonRows.map((row) => (
                  <tr key={row.userId} className="border-t border-[#eef3ec]">
                    <td className="p-3">
                      <a href={`/dashboard?userId=${row.userId}`} className="font-medium text-[#245b35]">
                        {row.name}
                      </a>
                      <p className="text-xs text-[#6a7669]">{row.email}</p>
                    </td>
                    <td className="p-3">{row.totalLogs}</td>
                    <td className="p-3">{round(row.avgCaloriesPerLog, 0)}</td>
                    <td className="p-3">{round(row.avgCarbsPerLog)}g</td>
                    <td className="p-3">{round(row.avgProteinsPerLog)}g</td>
                    <td className="p-3">{round(row.avgFatsPerLog)}g</td>
                    <td className="p-3">{row.latestBmi ? round(row.latestBmi) : "-"}</td>
                    <td className="p-3">
                      {row.latestBpHigh && row.latestBpLow
                        ? `${round(row.latestBpHigh, 0)}/${round(row.latestBpLow, 0)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
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
