
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
import { InstallAppButton } from "@/components/install-app-button";
import {
  createUser,
  deleteFoodLog,
  deleteMedicalRecord,
  saveFoodItem,
  saveFoodLog,
  saveMedicalRecord,
  saveNutritionTarget,
  seedMasterFoods,
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

function DonutChart({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(percent, 100));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
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
      <div>
        <p className="text-sm font-semibold text-[#172117]">{label}</p>
        <p className="text-xs text-[#6a7669]">Based on tracked days / days on app</p>
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

function TargetCards({ totals, targets }: { totals: Targets; targets: Targets | null }) {
  const items = [
    { key: "targetCalories", label: "Calories", actual: totals.targetCalories, unit: "kcal", icon: Activity },
    { key: "targetCarbs", label: "Carbs", actual: totals.targetCarbs, unit: "g", icon: Apple },
    { key: "targetProteins", label: "Proteins", actual: totals.targetProteins, unit: "g", icon: Users },
    { key: "targetFats", label: "Fats", actual: totals.targetFats, unit: "g", icon: BarChart3 },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => {
        const targetValue = targets ? targets[item.key] : 0;
        const progress = targetValue > 0 ? Math.min((item.actual / targetValue) * 100, 999) : 0;
        return (
          <div key={item.key} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[#5b685a]">{item.label}</span>
              <item.icon className="size-4 text-[#4f7f5d]" />
            </div>
            <p className="mt-3 text-2xl font-semibold">{round(item.actual, item.unit === "kcal" ? 0 : 1)}{item.unit}</p>
            <p className="mt-1 text-xs text-[#6a7669]">Target {targetValue ? `${round(targetValue, item.unit === "kcal" ? 0 : 1)}${item.unit}` : "not set"}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5eee2]"><div className={`h-full rounded-full ${progress > 100 ? "bg-[#bf5a4c]" : "bg-[#4f7f5d]"}`} style={{ width: `${Math.min(progress, 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
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

  return (
    <main className="min-h-screen bg-[#f7faf5] text-[#172117]">
      <header className="sticky top-0 z-20 border-b border-[#dbe5d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#245b35] font-bold text-white">N</div>
            <div>
              <p className="font-semibold">NutriTrack</p>
              <p className="text-xs text-[#6a7669]">{data.currentUser.role === "ADMIN" ? "Admin workspace" : "User workspace"}</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:pb-0">
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
        <section className="mb-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">Viewing</p>
            <h1 className="mt-1 text-2xl font-semibold">{data.selectedUser.name}</h1>
            <div className="mt-2 grid gap-2 text-sm text-[#526052] sm:grid-cols-2">
              <p>{data.selectedUser.email}</p><p>{data.selectedUser.mobileNumber}</p><p>Role: {data.selectedUser.role}</p><p>Start date: {data.selectedUser.displayStartDate}</p>
            </div>
            {data.currentUser.role === "ADMIN" ? <div className="mt-4 flex flex-wrap gap-2">{data.users.map((user) => <a key={user.id} href={`/dashboard?userId=${user.id}`} className={`rounded-md border px-3 py-2 text-sm ${user.id === data.selectedUser.id ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>{user.name}</a>)}</div> : null}
          </div>
          <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            {tab === "tracker" ? <><DonutChart percent={data.selectedUser.trackingRate} label={`${data.selectedUser.daysTracked} tracked / ${data.selectedUser.daysOnApp} days`} /><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg bg-[#f7faf5] p-3"><p className="text-xs uppercase tracking-wide text-[#6a7669]">Days on app</p><p className="mt-1 text-xl font-semibold">{data.selectedUser.daysOnApp}</p></div><div className="rounded-lg bg-[#f7faf5] p-3"><p className="text-xs uppercase tracking-wide text-[#6a7669]">Days tracked</p><p className="mt-1 text-xl font-semibold">{data.selectedUser.daysTracked}</p></div></div></> : <div className="grid gap-3 sm:grid-cols-2"><StatCard label="Days on app" value={`${data.selectedUser.daysOnApp}`} helper="Based on user start date" icon={UserRound} /><StatCard label="Tracking rate" value={`${Math.round(data.selectedUser.trackingRate)}%`} helper="Tracked days / days on app" icon={Activity} /></div>}
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
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null);

  const selectedDateLogs = useMemo(() => data.foodLogs.filter((log) => log.date === selectedDate), [data.foodLogs, selectedDate]);
  const visibleLogs = useMemo(() => {
    const base = showAllLogs ? data.foodLogs : selectedDateLogs;
    return base.filter((log) => {
      const keyword = search.trim().toLowerCase();
      if (!keyword) return true;
      return log.dishName.toLowerCase().includes(keyword) || log.foodItem.toLowerCase().includes(keyword);
    });
  }, [data.foodLogs, selectedDateLogs, search, showAllLogs]);

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

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-semibold">Daily tracker</h2>
                <p className="text-sm text-[#6a7669]">Targets are resolved using the target values effective on the selected date.</p>
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
                <p className="text-sm text-[#6a7669]">Protein/carb ratio is calculated automatically from the selected food and quantity.</p>
              </div>
              {editingLog ? <button type="button" onClick={() => setEditingLog(null)} className="rounded-md border border-[#d8e2d5] px-3 py-2 text-sm font-medium hover:bg-[#f4f7f2]">Cancel edit</button> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Food item</span>
                <select name="foodItemId" defaultValue={editingLog?.foodItemId ?? ""} required className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm">
                  <option value="">Select food</option>
                  {data.foodItems.map((item) => <option key={item.id} value={item.id}>{item.itemName}</option>)}
                </select>
              </label>
              <Field name="date" label="Date" type="date" defaultValue={editingLog?.date ?? selectedDate} required />
              <Field name="dishName" label="Dish / meal" defaultValue={editingLog?.dishName ?? "Meal"} required />
              <Field name="quantityGms" label="Quantity grams" type="number" step="0.1" defaultValue={editingLog?.quantityGms ?? ""} required />
            </div>
            <div className="mt-4"><ActionMessage state={state} /></div>
            <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">{editingLog ? "Update log" : "Save log"}</button>
          </form>
        </section>

        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold">Meals and ingredients</h2>
                <p className="text-sm text-[#6a7669]">Use show-all to view the full history. By default the table shows only the selected day.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowAllLogs(false)} className={`rounded-md border px-3 py-2 text-sm ${!showAllLogs ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>Selected day only</button>
                <button type="button" onClick={() => setShowAllLogs(true)} className={`rounded-md border px-3 py-2 text-sm ${showAllLogs ? "border-[#245b35] bg-[#edf7ec] text-[#245b35]" : "border-[#d8e2d5] hover:bg-[#f4f7f2]"}`}>Show all logs</button>
              </div>
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dish or food item" className="mt-3 h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[#f4f8f2] text-left">
                <tr>
                  <th className="p-3">Date</th><th className="p-3">Dish</th><th className="p-3">Food item</th><th className="p-3">Qty (g)</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th><th className="p-3">Calories</th><th className="p-3">Protein/Carb ratio</th><th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.length === 0 ? <tr><td colSpan={10} className="p-5 text-center text-sm text-[#6a7669]">No food logs found.</td></tr> : visibleLogs.map((log) => (
                  <tr key={log.id} className="border-t border-[#eef3ec]">
                    <td className="p-3">{log.displayDate}</td><td className="p-3 font-medium">{log.dishName}</td><td className="p-3">{log.foodItem}</td><td className="p-3">{round(log.quantityGms, 0)}</td><td className="p-3">{round(log.carbs)}g</td><td className="p-3">{round(log.proteins)}g</td><td className="p-3">{round(log.fats)}g</td><td className="p-3">{round(log.calories, 0)}</td><td className="p-3">{log.proteinCarbRatio === null ? "-" : round(log.proteinCarbRatio)}</td>
                    <td className="p-3"><div className="flex gap-2"><button type="button" onClick={() => { setEditingLog(log); setSelectedDate(log.date); }} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Pencil className="size-4" /></button><form action={deleteFoodLog}><input type="hidden" name="id" value={log.id} /><button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32] hover:bg-[#fff4f2]"><Trash2 className="size-4" /></button></form></div></td>
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

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <input name="userId" type="hidden" value={data.selectedUser.id} />
        <h2 className="font-semibold">Add medical data</h2>
        <p className="mt-1 text-sm text-[#6a7669]">Each update creates a new dated medical record.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field name="date" label="Date" type="date" defaultValue={today} required />
          <Field name="weight" label="Weight kg" type="number" step="0.1" required />
          <Field name="height" label="Height cm" type="number" step="0.1" required />
          <Field name="bpLow" label="BP low" type="number" step="1" required />
          <Field name="bpHigh" label="BP high" type="number" step="1" required />
        </div>
        <div className="mt-4"><ActionMessage state={state} /></div>
        <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">Save medical record</button>
      </form>
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Latest BMI" value={data.medicalRecords[0] ? round(data.medicalRecords[0].bmi) : "-"} helper="Newest record" icon={HeartPulse} />
          <StatCard label="Latest BP" value={data.medicalRecords[0] ? `${round(data.medicalRecords[0].bpHigh, 0)}/${round(data.medicalRecords[0].bpLow, 0)}` : "-"} helper="Systolic / diastolic" icon={Activity} />
          <StatCard label="Records" value={`${data.medicalRecords.length}`} helper="All historical medical records" icon={Database} />
        </div>
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4"><h2 className="font-semibold">Biometric history</h2></div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {data.medicalRecords.length === 0 ? <p className="text-sm text-[#6a7669]">No medical records yet.</p> : data.medicalRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-[#e4ece1] p-4">
                <div className="mb-3 flex items-center justify-between gap-3"><p className="font-medium">{record.displayDate}</p><form action={deleteMedicalRecord}><input type="hidden" name="id" value={record.id} /><button className="rounded-md border border-[#ead0cb] p-2 text-[#a13f32] hover:bg-[#fff4f2]"><Trash2 className="size-4" /></button></form></div>
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
  const daily = useMemo(() => {
    const map = new Map<string, { calories: number; carbs: number; proteins: number; fats: number }>();
    data.foodLogs.forEach((log) => {
      const row = map.get(log.date) ?? { calories: 0, carbs: 0, proteins: 0, fats: 0 };
      row.calories += log.calories; row.carbs += log.carbs; row.proteins += log.proteins; row.fats += log.fats; map.set(log.date, row);
    });
    return Array.from(map.entries()).map(([date, values]) => ({ date, ...values })).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
  }, [data.foodLogs]);

  const maxCalories = Math.max(1, ...daily.map((item) => item.calories));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.82fr]">
      <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <h2 className="font-semibold">Recent daily nutrition trend</h2>
        <p className="mt-1 text-sm text-[#6a7669]">Latest 12 tracked days.</p>
        <div className="mt-5 space-y-4">
          {daily.length === 0 ? <p className="text-sm text-[#6a7669]">No data yet.</p> : daily.map((item) => (
            <div key={item.date}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span>{item.date}</span><span>{round(item.calories, 0)} kcal</span></div>
              <div className="h-3 rounded-full bg-[#e5eee2]"><div className="h-3 rounded-full bg-[#4f7f5d]" style={{ width: `${Math.max(4, (item.calories / maxCalories) * 100)}%` }} /></div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-[#6a7669] sm:grid-cols-4"><span>Carbs {round(item.carbs)}g</span><span>Proteins {round(item.proteins)}g</span><span>Fats {round(item.fats)}g</span></div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-4">
        <StatCard label="Days tracked" value={`${data.selectedUser.daysTracked}`} helper="Distinct food-log days" icon={Activity} />
        <StatCard label="Tracking rate" value={`${Math.round(data.selectedUser.trackingRate)}%`} helper="Food tracked over total days on app" icon={BarChart3} />
        <StatCard label="Active target calories" value={data.selectedUser.activeTargets ? round(data.selectedUser.activeTargets.targetCalories, 0) : "-"} helper="Latest target profile" icon={Apple} />
      </section>
    </div>
  );
}

function DatabaseTab({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodItem, initialState);
  const canEdit = data.currentUser.role === "ADMIN";

  return (
    <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
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
      <section className="rounded-lg border border-[#dbe5d8] bg-white">
        <div className="flex items-center justify-between border-b border-[#e4ece1] p-4">
          <div><h2 className="font-semibold">Food database</h2><p className="text-sm text-[#6a7669]">Shared master list for every user.</p></div>
          <button onClick={() => downloadCsv("nutritrack-food-master.csv", [["Item", "Carbohydrates", "Proteins", "Fats", "Calories"], ...data.foodItems.map((item) => [item.itemName, item.carbohydrates, item.proteins, item.fats, item.calories])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Item</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th><th className="p-3">Calories</th></tr></thead>
            <tbody>{data.foodItems.map((item) => <tr key={item.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium">{item.itemName}</td><td className="p-3">{round(item.carbohydrates)}g</td><td className="p-3">{round(item.proteins)}g</td><td className="p-3">{round(item.fats)}g</td><td className="p-3">{round(item.calories, 0)}</td></tr>)}</tbody>
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

  return (
    <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
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
          <p className="mt-1 text-sm text-[#6a7669]">Set the date from which the new target should apply. Older logs keep using older target profiles based on their log date.</p>
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

      <section className="space-y-5">
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Account summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><StatCard label="Days on app" value={`${data.selectedUser.daysOnApp}`} helper="Based on start date" icon={UserRound} /><StatCard label="Days tracked" value={`${data.selectedUser.daysTracked}`} helper="Distinct food log dates" icon={Activity} /></div>
        </div>
        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Target history</h2><p className="text-sm text-[#6a7669]">Applied according to the log date.</p></div><button onClick={() => downloadCsv("nutritrack-target-history.csv", [["Effective From", "Calories", "Carbs", "Proteins", "Fats"], ...data.targetProfiles.map((target) => [target.displayEffectiveFrom, target.targetCalories, target.targetCarbs, target.targetProteins, target.targetFats])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Effective from</th><th className="p-3">Calories</th><th className="p-3">Carbs</th><th className="p-3">Proteins</th><th className="p-3">Fats</th></tr></thead>
              <tbody>{data.targetProfiles.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-[#6a7669]">No target history yet.</td></tr> : data.targetProfiles.map((target) => <tr key={target.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium">{target.displayEffectiveFrom}</td><td className="p-3">{round(target.targetCalories, 0)}</td><td className="p-3">{round(target.targetCarbs)}g</td><td className="p-3">{round(target.targetProteins)}g</td><td className="p-3">{round(target.targetFats)}g</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}

function Admin({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(createUser, initialState);
  const [search, setSearch] = useState("");

  if (!data.adminMetrics) return null;

  const filteredUsers = data.users.filter((user) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword) || user.mobileNumber.includes(keyword);
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><StatCard label="Users" value={`${data.adminMetrics.totalUsers}`} helper="User accounts" icon={Users} /><StatCard label="Admins" value={`${data.adminMetrics.totalAdmins}`} helper="Admin accounts" icon={ShieldCheck} /><StatCard label="Avg calories" value={round(data.adminMetrics.avgCalories, 0)} helper="Average per food log" icon={Activity} /><StatCard label="High BP records" value={`${data.adminMetrics.highBpCount}`} helper=">= 130/80" icon={HeartPulse} /></div>
        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Create user</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field name="name" label="Name" required />
            <Field name="email" label="Email" type="email" required />
            <Field name="mobileNumber" label="Mobile number" required />
            <Field name="pin" label="4 digit PIN" required />
            <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">Role</span><select name="role" className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
            <Field name="startDate" label="Start date" type="date" defaultValue={today} required />
            <Field name="age" label="Age" type="number" />
            <Field name="gender" label="Gender" />
            <Field name="conditions" label="Conditions" />
            <Field name="targetEffectiveFrom" label="Target effective from" type="date" defaultValue={today} required />
            <Field name="targetCalories" label="Target calories" type="number" step="0.1" defaultValue="2000" required />
            <Field name="targetCarbs" label="Target carbs" type="number" step="0.1" defaultValue="80" required />
            <Field name="targetProteins" label="Target proteins" type="number" step="0.1" defaultValue="60" required />
            <Field name="targetFats" label="Target fats" type="number" step="0.1" defaultValue="150" required />
          </div>
          <div className="mt-4"><ActionMessage state={state} /></div>
          <button className="mt-4 h-10 rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">Create user</button>
        </form>
      </section>
      <section className="space-y-5">
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4"><h2 className="font-semibold">All users</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or mobile" className="mt-3 h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm outline-none focus:border-[#245b35]" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Mobile</th><th className="p-3">Role</th><th className="p-3">Days tracked</th><th className="p-3">Tracking %</th></tr></thead>
              <tbody>{filteredUsers.map((user) => <tr key={user.id} className="border-t border-[#eef3ec]"><td className="p-3 font-medium"><a href={`/dashboard?userId=${user.id}`} className="text-[#245b35] hover:underline">{user.name}</a></td><td className="p-3">{user.email}</td><td className="p-3">{user.mobileNumber}</td><td className="p-3">{user.role}</td><td className="p-3">{user.daysTracked}</td><td className="p-3">{Math.round(user.trackingRate)}%</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4ece1] p-4"><div><h2 className="font-semibold">Cross-user comparison</h2><p className="text-sm text-[#6a7669]">Compare intake, tracking, and latest medical values.</p></div><button onClick={() => downloadCsv("nutritrack-admin-comparison.csv", [["Name", "Email", "Mobile", "Role", "Total Logs", "Days Tracked", "Tracking %", "Avg Calories/Log", "Avg Carbs/Log", "Avg Proteins/Log", "Avg Fats/Log", "Latest BMI", "Latest BP Low", "Latest BP High", "Latest Medical Date"], ...data.comparisonRows.map((row) => [row.name, row.email, row.mobileNumber, row.role, row.totalLogs, row.daysTracked, Math.round(row.trackingRate), row.avgCaloriesPerLog, row.avgCarbsPerLog, row.avgProteinsPerLog, row.avgFatsPerLog, row.latestBmi, row.latestBpLow, row.latestBpHigh, row.latestMedicalDate])])} className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"><Download className="size-4" /></button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-[#f4f8f2] text-left"><tr><th className="p-3">User</th><th className="p-3">Logs</th><th className="p-3">Tracked days</th><th className="p-3">Tracking %</th><th className="p-3">Avg kcal</th><th className="p-3">Avg carbs</th><th className="p-3">Avg proteins</th><th className="p-3">Avg fats</th><th className="p-3">Latest BMI</th><th className="p-3">Latest BP</th></tr></thead>
              <tbody>{data.comparisonRows.map((row) => <tr key={row.userId} className="border-t border-[#eef3ec]"><td className="p-3"><a href={`/dashboard?userId=${row.userId}`} className="font-medium text-[#245b35] hover:underline">{row.name}</a><p className="text-xs text-[#6a7669]">{row.email}</p></td><td className="p-3">{row.totalLogs}</td><td className="p-3">{row.daysTracked}</td><td className="p-3">{Math.round(row.trackingRate)}%</td><td className="p-3">{round(row.avgCaloriesPerLog, 0)}</td><td className="p-3">{round(row.avgCarbsPerLog)}g</td><td className="p-3">{round(row.avgProteinsPerLog)}g</td><td className="p-3">{round(row.avgFatsPerLog)}g</td><td className="p-3">{row.latestBmi === null ? "-" : round(row.latestBmi)}</td><td className="p-3">{row.latestBpHigh && row.latestBpLow ? `${round(row.latestBpHigh, 0)}/${round(row.latestBpLow, 0)}` : "-"}</td></tr>)}</tbody>
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
