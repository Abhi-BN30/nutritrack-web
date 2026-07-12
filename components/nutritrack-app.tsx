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
  ChevronUp,
  ChevronDown,
  Search,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

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

// Reusable table components with search, sort, and filter
function TableHeader<T>({
  columns,
  sortConfig,
  onSort,
}: {
  columns: { key: string; label: string }[];
  sortConfig: SortConfig | null;
  onSort: (key: string) => void;
}) {
  return (
    <thead className="bg-[#f4f8f2] text-left">
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            className="cursor-pointer p-3 hover:bg-[#e8f0e4]"
            onClick={() => onSort(col.key)}
          >
            <div className="flex items-center gap-2">
              {col.label}
              {sortConfig?.key === col.key ? (
                sortConfig.direction === "asc" ? (
                  <ChevronUp className="size-4 text-[#4f7f5d]" />
                ) : (
                  <ChevronDown className="size-4 text-[#4f7f5d]" />
                )
              ) : (
                <ChevronDown className="size-4 text-[#d8e2d5]" />
              )}
            </div>
          </th>
        ))}
        <th className="p-3"></th>
      </tr>
    </thead>
  );
}

function SearchAndFilter({
  searchTerm,
  onSearchChange,
  placeholder = "Search...",
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6a7669]" />
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#245b35]"
      />
      {searchTerm && (
        <button
          onClick={() => onSearchChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6a7669] hover:text-[#172117]"
        >
          <X className="size-4" />
        </button>
      )}
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

function NutrientCard({
  label,
  value,
  unit,
  target,
  icon: Icon,
}: {
  label: string;
  value: number;
  unit: string;
  target: number;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-lg border border-[#dbe5d8] bg-white p-4 flex flex-col items-center text-center">
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-sm font-medium text-[#5b685a]">{label}</span>
        <Icon className="size-4 text-[#4f7f5d]" />
      </div>
      <div className="my-2">
        <ProgressDonut value={value} target={target} size={50} />
      </div>
      <p className="text-lg font-semibold">{round(value)}{unit}</p>
      <p className="text-xs text-[#6a7669]">Target: {round(target)}{unit}</p>
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

function ProgressDonut({ value, target, size = 60 }: { value: number; target: number; size?: number }) {
  const percentage = target <= 0 ? 0 : Math.min((value / target) * 100, 100);
  const data = [{ value: percentage }, { value: 100 - percentage }];
  const isOverTarget = value > target;

  return (
    <div className="flex flex-col items-center gap-2">
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={data}
            cx={size / 2}
            cy={size / 2}
            innerRadius={size / 2.8}
            outerRadius={size / 2}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
          >
            <Cell fill={isOverTarget ? "#bf5a4c" : "#4f7f5d"} />
            <Cell fill="#e5eee2" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-[#6a7669]">{Math.round(percentage)}% of target</p>
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
              L
            </div>
            <div>
              <p className="font-semibold">LCHF</p>
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
        {/* Page-Specific Summary Section */}
        <section className="mb-5 rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">
              {tab === "tracker" ? "Daily Tracker" : tab === "medical" ? "Health Biometrics" : tab === "graphs" ? "Analytics" : "User"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{data.selectedUser.name}</h1>
            <p className="text-sm text-[#6a7669]">{data.selectedUser.email}</p>
          </div>

          {/* Tab-Specific Summary Tiles */}
          {tab === "tracker" && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <InfoChip 
                label="Avg Daily Calories" 
                value={
                  data.foodLogs.length > 0
                    ? round(sum(data.foodLogs, "calories") / data.foodLogs.length, 0)
                    : "—"
                }
              />
              <InfoChip 
                label="Avg Daily Carbs" 
                value={
                  data.foodLogs.length > 0
                    ? `${round(sum(data.foodLogs, "carbs") / data.foodLogs.length)}g`
                    : "—"
                }
              />
              <InfoChip 
                label="Avg Daily Proteins" 
                value={
                  data.foodLogs.length > 0
                    ? `${round(sum(data.foodLogs, "proteins") / data.foodLogs.length)}g`
                    : "—"
                }
              />
              <InfoChip 
                label="Avg Daily Fats" 
                value={
                  data.foodLogs.length > 0
                    ? `${round(sum(data.foodLogs, "fats") / data.foodLogs.length)}g`
                    : "—"
                }
              />
            </div>
          )}

          {tab === "medical" && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <InfoChip 
                label="Avg Systolic BP" 
                value={
                  data.medicalRecords.length > 0
                    ? `${round(data.medicalRecords.reduce((sum, r) => sum + r.bpHigh, 0) / data.medicalRecords.length, 0)} mmHg`
                    : "—"
                }
              />
              <InfoChip 
                label="Avg Diastolic BP" 
                value={
                  data.medicalRecords.length > 0
                    ? `${round(data.medicalRecords.reduce((sum, r) => sum + r.bpLow, 0) / data.medicalRecords.length, 0)} mmHg`
                    : "—"
                }
              />
              <InfoChip 
                label="Latest BMI" 
                value={
                  data.medicalRecords[0]
                    ? round(data.medicalRecords[0].bmi)
                    : "—"
                }
              />
              <InfoChip 
                label="Medical Records" 
                value={`${data.medicalRecords.length}`}
              />
            </div>
          )}

          {tab === "graphs" && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <InfoChip 
                label="Total Food Logs" 
                value={`${data.foodLogs.length}`}
              />
              <InfoChip 
                label="Total Medical Records" 
                value={`${data.medicalRecords.length}`}
              />
              <InfoChip 
                label="Date Range" 
                value={
                  data.foodLogs.length > 0
                    ? `${Math.ceil((new Date().getTime() - new Date(data.foodLogs[data.foodLogs.length - 1].date).getTime()) / (1000 * 60 * 60 * 24))} days`
                    : "—"
                }
              />
              <InfoChip 
                label="Latest Entry" 
                value={
                  data.foodLogs[0]
                    ? data.foodLogs[0].displayDate
                    : "—"
                }
              />
            </div>
          )}

          {!["tracker", "medical", "graphs"].includes(tab) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          )}
        </section>

        {children}
      </div>
    </main>
  );
}

function Tracker({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodLog, initialState);
  const [selectedDate, setSelectedDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "date", direction: "desc" });
  const [quantityUnit, setQuantityUnit] = useState("g");
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Filter logs by selected date
  const selectedDateLogs = useMemo(
    () => data.foodLogs.filter((log) => log.date === selectedDate),
    [data.foodLogs, selectedDate]
  );

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = selectedDateLogs.filter(
      (log) =>
        log.dishName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.foodItem.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof FoodLog];
      const bVal = b[sortConfig.key as keyof FoodLog];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return filtered;
  }, [selectedDateLogs, searchTerm, sortConfig]);

  const totals = {
    carbs: sum(filteredAndSortedLogs, "carbs"),
    proteins: sum(filteredAndSortedLogs, "proteins"),
    fats: sum(filteredAndSortedLogs, "fats"),
    calories: sum(filteredAndSortedLogs, "calories"),
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const selectedDateObj = new Date(selectedDate);
  const dateDisplay = selectedDateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-5">
      {/* Date and Time Display */}
      <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              Viewing
            </p>
            <p className="text-lg font-semibold">{dateDisplay}</p>
            <p className="text-sm text-[#6a7669]">{timeString}</p>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              Select date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Nutrient Stats with Donut Charts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NutrientCard
          label="Calories"
          value={totals.calories}
          unit=" kcal"
          target={data.selectedUser.targetCalories}
          icon={Activity}
        />
        <NutrientCard
          label="Carbs"
          value={totals.carbs}
          unit="g"
          target={data.selectedUser.targetCarbs}
          icon={Apple}
        />
        <NutrientCard
          label="Proteins"
          value={totals.proteins}
          unit="g"
          target={data.selectedUser.targetProteins}
          icon={Sprout}
        />
        <NutrientCard
          label="Fats"
          value={totals.fats}
          unit="g"
          target={data.selectedUser.targetFats}
          icon={BarChart3}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Form Section */}
        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <input name="userId" type="hidden" value={data.selectedUser.id} />
          <div className="mb-4 flex items-center gap-2">
            <Plus className="size-4 text-[#4f7f5d]" />
            <h2 className="font-semibold">Log daily intake</h2>
          </div>
          <div className="grid gap-3">
            <Field name="date" label="Date" type="date" defaultValue={today} required />
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
            
            <Field name="dishName" label="Dish / meal" defaultValue="Meal" required />
            
            <div className="grid grid-cols-[1fr_0.8fr] gap-2">
              <Field name="quantityGms" label="Quantity" type="number" step="0.1" required placeholder="100" />
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
                  Unit
                </span>
                <select
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"
                >
                  <option value="g">Grams (g)</option>
                  <option value="ml">Millilitres (ml)</option>
                  <option value="count">Count</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-[#6a7669]">Nutrients calculated per 100g from master table</p>
          </div>
          <div className="mt-4">
            <ActionMessage state={state} />
          </div>
          <button className="mt-4 h-10 w-full rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
            Add food log
          </button>
        </form>

        {/* Table Section */}
        <section className="rounded-lg border border-[#dbe5d8] bg-white overflow-hidden flex flex-col">
          <div className="border-b border-[#e4ece1] p-4">
            <div className="mb-3 flex items-center gap-3">
              <div>
                <h2 className="font-semibold">Meals and ingredients</h2>
                <p className="text-sm text-[#6a7669]">{selectedDateLogs.length} entries for {selectedDateLogs.length > 0 ? 'selected' : 'this'} date.</p>
              </div>
            </div>
            <SearchAndFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search by dish or food..."
            />
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredAndSortedLogs.length === 0 ? (
              <p className="p-5 text-center text-sm text-[#6a7669]">No intake logs for this date.</p>
            ) : (
              <table className="w-full text-sm">
                <TableHeader
                  columns={[
                    { key: "dishName", label: "Dish" },
                    { key: "foodItem", label: "Food" },
                    { key: "quantityGms", label: "Qty (g)" },
                    { key: "carbs", label: "Carbs" },
                    { key: "proteins", label: "Protein" },
                    { key: "fats", label: "Fats" },
                    { key: "calories", label: "Cal" },
                  ]}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <tbody>
                  {filteredAndSortedLogs.map((log) => (
                    <tr key={log.id} className="border-t border-[#eef3ec] hover:bg-[#f9fcf8]">
                      <td className="p-2 sm:p-3 whitespace-nowrap">{log.dishName}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-[#6a7669]">{log.foodItem}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.quantityGms, 0)}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.carbs)}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.proteins)}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.fats)}</td>
                      <td className="p-2 sm:p-3 whitespace-nowrap text-right font-medium">{round(log.calories, 0)}</td>
                      <td className="p-2 sm:p-3">
                        <form action={deleteFoodLog}>
                          <input type="hidden" name="id" value={log.id} />
                          <button className="rounded-md border border-[#ead0cb] p-1.5 text-[#a13f32] hover:bg-[#fdf7f5]">
                            <Trash2 className="size-3.5" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
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
          <Field name="weight" label="Weight kg" type="number" step="0.1" required />
          <Field name="height" label="Height cm" type="number" step="0.1" required />
          <Field name="bpLow" label="BP low (diastolic)" type="number" step="1" required />
          <Field name="bpHigh" label="BP high (systolic)" type="number" step="1" required />
          <Field name="date" label="Date" type="date" defaultValue={today} required />
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
  const [startDate, setStartDate] = useState(() => {
    // Default to 30 days ago
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(today);

  const dailyTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        displayDate: string;
        calories: number;
        carbs: number;
        proteins: number;
        fats: number;
      }
    >();
    data.foodLogs.forEach((log) => {
      if (log.date >= startDate && log.date <= endDate) {
        const existing = map.get(log.date) ?? {
          date: log.date,
          displayDate: log.displayDate,
          calories: 0,
          carbs: 0,
          proteins: 0,
          fats: 0,
        };
        existing.calories += log.calories;
        existing.carbs += log.carbs;
        existing.proteins += log.proteins;
        existing.fats += log.fats;
        map.set(log.date, existing);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.foodLogs, startDate, endDate]);

  const dailyMedical = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        displayDate: string;
        weight: number;
        bmi: number;
        bpLow: number;
        bpHigh: number;
      }
    >();
    data.medicalRecords.forEach((record) => {
      if (record.date >= startDate && record.date <= endDate) {
        map.set(record.date, {
          date: record.date,
          displayDate: record.displayDate,
          weight: record.weight,
          bmi: record.bmi,
          bpLow: record.bpLow,
          bpHigh: record.bpHigh,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data.medicalRecords, startDate, endDate]);

  const summaryStats = useMemo(() => {
    if (dailyTotals.length === 0) {
      return {
        avgCalories: 0,
        avgCarbs: 0,
        avgProteins: 0,
        avgFats: 0,
        maxCalories: 0,
      };
    }
    return {
      avgCalories: dailyTotals.reduce((sum, d) => sum + d.calories, 0) / dailyTotals.length,
      avgCarbs: dailyTotals.reduce((sum, d) => sum + d.carbs, 0) / dailyTotals.length,
      avgProteins: dailyTotals.reduce((sum, d) => sum + d.proteins, 0) / dailyTotals.length,
      avgFats: dailyTotals.reduce((sum, d) => sum + d.fats, 0) / dailyTotals.length,
      maxCalories: Math.max(...dailyTotals.map((d) => d.calories)),
    };
  }, [dailyTotals]);

  // Calculate logging consistency metrics
  const consistencyMetrics = useMemo(() => {
    const createdAt = new Date(data.selectedUser.id).getTime(); // Placeholder - would need actual createdAt from data
    const daysActive = Math.floor((new Date().getTime() - createdAt) / (1000 * 60 * 60 * 24)) || 0;
    const daysWithLogs = new Set(data.foodLogs.map((log) => log.date)).size;
    
    return {
      daysActive: daysActive > 0 ? daysActive : data.foodLogs.length > 0 ? Math.ceil((new Date().getTime() - new Date(data.foodLogs[data.foodLogs.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      daysWithLogs,
    };
  }, [data.foodLogs, data.selectedUser.id]);

  // Custom tooltip formatter that rounds values
  const CustomTooltip = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) return null;
    return (
      <div className="rounded-lg border border-[#dbe5d8] bg-white p-3 shadow-lg">
        <p className="text-xs font-medium text-[#172117]">{props.payload[0].payload.displayDate}</p>
        {props.payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: {Math.round(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-5">
      {/* Date Range Picker */}
      <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
        <h3 className="mb-3 font-semibold">Filter by date range</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="h-10 w-full rounded-md border border-[#d8e2d5] bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              Days
            </label>
            <div className="h-10 rounded-md border border-[#d8e2d5] bg-[#f9fcf8] px-3 flex items-center text-sm font-medium">
              {dailyTotals.length} days
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#6a7669]">
              Quick presets
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() - 7);
                  setStartDate(date.toISOString().slice(0, 10));
                  setEndDate(today);
                }}
                className="flex-1 h-10 rounded-md border border-[#d8e2d5] text-xs font-medium hover:bg-[#f4f7f2]"
              >
                7 days
              </button>
              <button
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() - 30);
                  setStartDate(date.toISOString().slice(0, 10));
                  setEndDate(today);
                }}
                className="flex-1 h-10 rounded-md border border-[#d8e2d5] text-xs font-medium hover:bg-[#f4f7f2]"
              >
                30 days
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Avg Daily Calories"
          value={round(summaryStats.avgCalories, 0)}
          helper={`From ${dailyTotals.length} days`}
          icon={Activity}
        />
        <StatCard
          label="Avg Daily Carbs"
          value={`${round(summaryStats.avgCarbs)}g`}
          helper={`From ${dailyTotals.length} days`}
          icon={Apple}
        />
        <StatCard
          label="Avg Daily Protein"
          value={`${round(summaryStats.avgProteins)}g`}
          helper={`From ${dailyTotals.length} days`}
          icon={Sprout}
        />
        <StatCard
          label="Avg Daily Fats"
          value={`${round(summaryStats.avgFats)}g`}
          helper={`From ${dailyTotals.length} days`}
          icon={BarChart3}
        />
      </div>

      {/* Logging Consistency Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          label="Days with Logs"
          value={`${consistencyMetrics.daysWithLogs}`}
          helper={`${data.foodLogs.length} total food logs`}
          icon={Database}
        />
        <StatCard
          label="Logging Consistency"
          value={`${consistencyMetrics.daysActive > 0 ? Math.round((consistencyMetrics.daysWithLogs / consistencyMetrics.daysActive) * 100) : 0}%`}
          helper={`Over ${consistencyMetrics.daysActive} days`}
          icon={Activity}
        />
      </div>

      {/* Nutrition Chart with Dual Axes */}
      {dailyTotals.length === 0 ? (
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-8 text-center">
          <p className="text-sm text-[#6a7669]">Log food to build charts and trends.</p>
        </div>
      ) : (
        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h3 className="mb-4 font-semibold">Daily Nutrition Intake (Dual Axis View)</h3>
          <p className="mb-3 text-xs text-[#6a7669]">Left axis: Carbs, Proteins, Fats (grams) • Right axis: Calories (kcal)</p>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={dailyTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5d8" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                stroke="#6a7669"
              />
              {/* Left Y Axis - Carbs, Proteins, Fats */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke="#6a7669"
                label={{ value: "Grams (g)", angle: -90, position: "insideLeft" }}
              />
              {/* Right Y Axis - Calories */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#4f7f5d"
                label={{ value: "Calories (kcal)", angle: 90, position: "insideRight" }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {/* Carbs Line - Distinct Color */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="carbs"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={false}
                name="Carbs (g)"
              />
              {/* Proteins Line - Distinct Color */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="proteins"
                stroke="#ec4899"
                strokeWidth={3}
                dot={false}
                name="Proteins (g)"
              />
              {/* Fats Line - Distinct Color */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="fats"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={false}
                name="Fats (g)"
              />
              {/* Calories Line - Right Axis */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="calories"
                stroke="#4f7f5d"
                strokeWidth={3.5}
                dot={false}
                name="Calories (kcal)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Medical Data Chart */}
      {dailyMedical.length > 0 ? (
        <section className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h3 className="mb-4 font-semibold">Biometric Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={dailyMedical}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe5d8" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 12 }}
                stroke="#6a7669"
              />
              {/* Left Y Axis - Weight & BMI */}
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                stroke="#6a7669"
                label={{ value: "Weight (kg) / BMI", angle: -90, position: "insideLeft" }}
              />
              {/* Right Y Axis - BP */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                stroke="#bf5a4c"
                label={{ value: "Blood Pressure (mmHg)", angle: 90, position: "insideRight" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #dbe5d8",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight"
                stroke="#4f7f5d"
                strokeWidth={2.5}
                dot={false}
                name="Weight (kg)"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="bmi"
                stroke="#8b7d52"
                strokeWidth={2.5}
                dot={false}
                name="BMI"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bpHigh"
                stroke="#bf5a4c"
                strokeWidth={2.5}
                dot={false}
                name="BP Systolic"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bpLow"
                stroke="#d4876b"
                strokeWidth={2.5}
                dot={false}
                name="BP Diastolic"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </section>
      ) : null}

      {/* Latest Medical Data Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Latest BMI"
          value={data.medicalRecords[0] ? round(data.medicalRecords[0].bmi) : "—"}
          helper="From newest medical record"
          icon={HeartPulse}
        />
        <StatCard
          label="Latest BP"
          value={
            data.medicalRecords[0]
              ? `${round(data.medicalRecords[0].bpHigh, 0)}/${round(data.medicalRecords[0].bpLow, 0)}`
              : "—"
          }
          helper="Systolic / diastolic"
          icon={Activity}
        />
        <StatCard
          label="Target Adherence"
          value={
            dailyTotals.length > 0
              ? `${round((summaryStats.avgCalories / data.selectedUser.targetCalories) * 100)}%`
              : "—"
          }
          helper="Avg vs target calories"
          icon={Apple}
        />
        <StatCard
          label="Weight"
          value={data.medicalRecords[0] ? `${round(data.medicalRecords[0].weight)} kg` : "—"}
          helper="Latest recorded weight"
          icon={Sprout}
        />
      </div>
    </div>
  );
}

function DatabaseTab({ data }: { data: DashboardData }) {
  const [state, action] = useActionState(saveFoodItem, initialState);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "itemName", direction: "asc" });
  const [historySearchTerm, setHistorySearchTerm] = useState("");
  const [historySortConfig, setHistorySortConfig] = useState<SortConfig>({ key: "date", direction: "desc" });
  const canEdit = data.currentUser.role === "ADMIN";

  // Calculate overall statistics for summary tiles
  const allTimeStats = useMemo(() => {
    const logs = data.foodLogs;
    if (logs.length === 0) {
      return { avgCalories: 0, avgCarbs: 0, avgProteins: 0, avgFats: 0, adherence: 0 };
    }

    const totalCalories = sum(logs, "calories");
    const totalCarbs = sum(logs, "carbs");
    const totalProteins = sum(logs, "proteins");
    const totalFats = sum(logs, "fats");

    return {
      avgCalories: totalCalories / logs.length,
      avgCarbs: totalCarbs / logs.length,
      avgProteins: totalProteins / logs.length,
      avgFats: totalFats / logs.length,
      adherence: (totalCalories / logs.length / data.selectedUser.targetCalories) * 100,
    };
  }, [data.foodLogs, data.selectedUser.targetCalories]);

  // Filter and sort food items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = data.foodItems.filter((item) =>
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof FoodItem];
      const bVal = b[sortConfig.key as keyof FoodItem];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return filtered;
  }, [data.foodItems, searchTerm, sortConfig]);

  // Filter and sort history logs
  const filteredAndSortedHistory = useMemo(() => {
    let filtered = data.foodLogs.filter(
      (log) =>
        log.dishName.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        log.foodItem.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
        log.displayDate.includes(historySearchTerm)
    );

    filtered.sort((a, b) => {
      const aVal = a[historySortConfig.key as keyof FoodLog];
      const bVal = b[historySortConfig.key as keyof FoodLog];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return historySortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return historySortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return filtered;
  }, [data.foodLogs, historySearchTerm, historySortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleHistorySort = (key: string) => {
    setHistorySortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="space-y-5">
      {/* Summary Tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Avg Calories"
          value={round(allTimeStats.avgCalories, 0)}
          helper="Per log entry"
          icon={Activity}
        />
        <StatCard
          label="Avg Carbs"
          value={`${round(allTimeStats.avgCarbs)}g`}
          helper="Per log entry"
          icon={Apple}
        />
        <StatCard
          label="Avg Proteins"
          value={`${round(allTimeStats.avgProteins)}g`}
          helper="Per log entry"
          icon={Sprout}
        />
        <StatCard
          label="Avg Fats"
          value={`${round(allTimeStats.avgFats)}g`}
          helper="Per log entry"
          icon={BarChart3}
        />
        <StatCard
          label="Adherence"
          value={`${round(allTimeStats.adherence, 0)}%`}
          helper="All-time average"
          icon={HeartPulse}
        />
        <div className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-[#5b685a]">Records</span>
            <Database className="size-4 text-[#4f7f5d]" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{data.foodLogs.length + data.medicalRecords.length}</p>
          <p className="mt-1 text-xs text-[#6a7669]">{data.foodLogs.length} food, {data.medicalRecords.length} medical</p>
        </div>
      </div>

      {/* Log History Table */}
      <section className="rounded-lg border border-[#dbe5d8] bg-white">
        <div className="border-b border-[#e4ece1] p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Log history</h2>
              <p className="text-sm text-[#6a7669]">Complete intake history. {filteredAndSortedHistory.length} entries</p>
            </div>
            <button
              onClick={() =>
                downloadCsv("nutritrack-log-history.csv", [
                  ["Date", "Dish", "Food", "Qty (g)", "Carbs", "Protein", "Fats", "Calories"],
                  ...filteredAndSortedHistory.map((log) => [
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
              className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"
              disabled={filteredAndSortedHistory.length === 0}
            >
              <Download className="size-4" />
            </button>
          </div>
          <SearchAndFilter
            searchTerm={historySearchTerm}
            onSearchChange={setHistorySearchTerm}
            placeholder="Search by date, dish, or food..."
          />
        </div>

        <div className="overflow-x-auto">
          {filteredAndSortedHistory.length === 0 ? (
            <p className="p-5 text-center text-sm text-[#6a7669]">No food logs found.</p>
          ) : (
            <table className="w-full text-xs sm:text-sm">
              <TableHeader
                columns={[
                  { key: "displayDate", label: "Date" },
                  { key: "dishName", label: "Dish" },
                  { key: "foodItem", label: "Food" },
                  { key: "quantityGms", label: "Qty (g)" },
                  { key: "carbs", label: "Carbs" },
                  { key: "proteins", label: "Protein" },
                  { key: "fats", label: "Fats" },
                  { key: "calories", label: "Calories" },
                ]}
                sortConfig={historySortConfig}
                onSort={handleHistorySort}
              />
              <tbody>
                {filteredAndSortedHistory.map((log) => (
                  <tr key={log.id} className="border-t border-[#eef3ec] hover:bg-[#f9fcf8]">
                    <td className="p-2 sm:p-3 whitespace-nowrap text-[#6a7669]">{log.displayDate}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap">{log.dishName}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-[#6a7669]">{log.foodItem}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.quantityGms, 0)}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.carbs)}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.proteins)}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-right">{round(log.fats)}</td>
                    <td className="p-2 sm:p-3 whitespace-nowrap text-right font-medium">{round(log.calories, 0)}</td>
                    <td className="p-2 sm:p-3 space-x-1 flex">
                      <form action={deleteFoodLog}>
                        <input type="hidden" name="id" value={log.id} />
                        <button className="rounded-md border border-[#ead0cb] p-1.5 text-[#a13f32] hover:bg-[#fdf7f5]">
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Master Food Database Section */}
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
            </div>
          </form>
        ) : null}

        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="flex items-center justify-between border-b border-[#e4ece1] p-4">
            <div>
              <h2 className="font-semibold">Food database</h2>
              <p className="text-sm text-[#6a7669]">Centralized for every patient. {filteredAndSortedItems.length} items</p>
            </div>
            <button
              onClick={() =>
                downloadCsv("nutritrack-food-master.csv", [
                  ["Item", "Carbohydrates", "Proteins", "Fats", "Calories"],
                  ...filteredAndSortedItems.map((item) => [
                    item.itemName,
                    item.carbohydrates,
                    item.proteins,
                    item.fats,
                    item.calories,
                  ]),
                ])
              }
              className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"
            >
              <Download className="size-4" />
            </button>
          </div>

          <div className="border-b border-[#e4ece1] p-4">
            <SearchAndFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search food items..."
            />
          </div>

          <div className="overflow-x-auto">
            {filteredAndSortedItems.length === 0 ? (
              <p className="p-5 text-center text-sm text-[#6a7669]">No food items found.</p>
            ) : (
              <table className="w-full text-xs sm:text-sm">
                <TableHeader
                  columns={[
                    { key: "itemName", label: "Item" },
                    { key: "carbohydrates", label: "Carbs" },
                    { key: "proteins", label: "Proteins" },
                    { key: "fats", label: "Fats" },
                    { key: "calories", label: "Calories" },
                  ]}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <tbody>
                  {filteredAndSortedItems.map((item) => (
                    <tr key={item.id} className="border-t border-[#eef3ec] hover:bg-[#f9fcf8]">
                      <td className="p-2 sm:p-3 font-medium">{item.itemName}</td>
                      <td className="p-2 sm:p-3 text-right">{round(item.carbohydrates)}g</td>
                      <td className="p-2 sm:p-3 text-right">{round(item.proteins)}g</td>
                      <td className="p-2 sm:p-3 text-right">{round(item.fats)}g</td>
                      <td className="p-2 sm:p-3 text-right">{round(item.calories, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
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
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [comparisonSearchTerm, setComparisonSearchTerm] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [userSortConfig, setUserSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" });
  const [comparisonSortConfig, setComparisonSortConfig] = useState<SortConfig>({ key: "name", direction: "asc" });

  if (!data.adminMetrics) {
    return null;
  }

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = data.users.filter(
      (user) =>
        user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aVal = a[userSortConfig.key as keyof UserSummary];
      const bVal = b[userSortConfig.key as keyof UserSummary];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return userSortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return userSortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return filtered;
  }, [data.users, userSearchTerm, userSortConfig]);

  // Filter and sort comparison rows based on selected patients
  const filteredAndSortedComparison = useMemo(() => {
    let filtered = data.comparisonRows;

    // If specific patients are selected, only show those
    if (selectedPatientIds.size > 0) {
      filtered = filtered.filter((row) => selectedPatientIds.has(row.userId));
    }

    // Apply search
    filtered = filtered.filter(
      (row) =>
        row.name.toLowerCase().includes(comparisonSearchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(comparisonSearchTerm.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[comparisonSortConfig.key as keyof ComparisonRow];
      const bVal = b[comparisonSortConfig.key as keyof ComparisonRow];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return comparisonSortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return comparisonSortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return filtered;
  }, [data.comparisonRows, selectedPatientIds, comparisonSearchTerm, comparisonSortConfig]);

  const handleUserSort = (key: string) => {
    setUserSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleComparisonSort = (key: string) => {
    setComparisonSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const togglePatientSelection = (userId: string) => {
    const newSet = new Set(selectedPatientIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedPatientIds(newSet);
  };

  const clearPatientSelection = () => {
    setSelectedPatientIds(new Set());
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-4 lg:max-w-sm">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Patients" value={`${data.adminMetrics.totalPatients}`} helper="Patient accounts" icon={Users} />
          <StatCard label="Food logs" value={`${data.adminMetrics.totalFoodLogs}`} helper="Latest loaded records" icon={Apple} />
          <StatCard label="Avg calories" value={round(data.adminMetrics.avgCalories, 0)} helper="Average per log" icon={Activity} />
          <StatCard label="High BP records" value={`${data.adminMetrics.highBpCount}`} helper=">= 130/80" icon={HeartPulse} />
        </div>

        <form action={action} className="rounded-lg border border-[#dbe5d8] bg-white p-4">
          <h2 className="font-semibold">Create user</h2>
          <div className="mt-4 grid gap-3">
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
          <button className="mt-4 h-10 w-full rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white">
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-5">
        {/* Users Table */}
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4">
            <h2 className="mb-3 font-semibold">Users</h2>
            <SearchAndFilter
              searchTerm={userSearchTerm}
              onSearchChange={setUserSearchTerm}
              placeholder="Search by name or email..."
            />
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <TableHeader
                columns={[
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "role", label: "Role" },
                  { key: "foodLogs", label: "Logs" },
                  { key: "medicalRecords", label: "Medical" },
                ]}
                sortConfig={userSortConfig}
                onSort={handleUserSort}
              />
              <tbody>
                {filteredAndSortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 sm:p-5 text-center text-sm text-[#6a7669]">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedUsers.map((user) => (
                    <tr key={user.id} className="border-t border-[#eef3ec] hover:bg-[#f9fcf8]">
                      <td className="p-2 sm:p-3 font-medium">
                        <a href={`/dashboard?userId=${user.id}`} className="text-[#245b35] hover:underline">
                          {user.name}
                        </a>
                      </td>
                      <td className="p-2 sm:p-3 text-[#6a7669] truncate">{user.email}</td>
                      <td className="p-2 sm:p-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap inline-block ${
                          user.role === "ADMIN"
                            ? "bg-[#fff4e8] text-[#8a4a12]"
                            : "bg-[#edf7ec] text-[#245b35]"
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-2 sm:p-3 text-right">{user.foodLogs ?? 0}</td>
                      <td className="p-2 sm:p-3 text-right">{user.medicalRecords ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cross-patient Comparison */}
        <section className="rounded-lg border border-[#dbe5d8] bg-white">
          <div className="border-b border-[#e4ece1] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Cross-patient comparison</h2>
                <p className="text-sm text-[#6a7669]">
                  {selectedPatientIds.size > 0
                    ? `Comparing ${selectedPatientIds.size} patient${selectedPatientIds.size === 1 ? "" : "s"}`
                    : "Check boxes to compare patients"}
                </p>
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
                    ...filteredAndSortedComparison.map((row) => [
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
                className="rounded-md border border-[#d8e2d5] p-2 hover:bg-[#f4f7f2]"
                disabled={filteredAndSortedComparison.length === 0}
              >
                <Download className="size-4" />
              </button>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SearchAndFilter
                  searchTerm={comparisonSearchTerm}
                  onSearchChange={setComparisonSearchTerm}
                  placeholder="Search patients..."
                />
              </div>
              {selectedPatientIds.size > 0 && (
                <button
                  onClick={clearPatientSelection}
                  className="h-10 rounded-md border border-[#d8e2d5] px-3 text-sm whitespace-nowrap hover:bg-[#f4f7f2]"
                >
                  Clear ({selectedPatientIds.size})
                </button>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            {data.comparisonRows.length === 0 ? (
              <p className="p-5 text-center text-sm text-[#6a7669]">
                No patients available for comparison.
              </p>
            ) : (
              <table className="w-full min-w-full text-xs sm:text-sm">
                <thead className="bg-[#f4f8f2] text-left sticky top-0">
                  <tr>
                    <th className="p-2 sm:p-3 w-12">
                      <input
                        type="checkbox"
                        checked={selectedPatientIds.size === filteredAndSortedComparison.length && filteredAndSortedComparison.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSet = new Set(selectedPatientIds);
                            filteredAndSortedComparison.forEach((row) => newSet.add(row.userId));
                            setSelectedPatientIds(newSet);
                          } else {
                            clearPatientSelection();
                          }
                        }}
                        className="rounded border-[#d8e2d5]"
                      />
                    </th>
                    <th
                      className="cursor-pointer p-2 sm:p-3 hover:bg-[#e8f0e4] whitespace-nowrap"
                      onClick={() => handleComparisonSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        User
                        {comparisonSortConfig.key === "name" ? (
                          comparisonSortConfig.direction === "asc" ? (
                            <ChevronUp className="size-3 sm:size-4 text-[#4f7f5d]" />
                          ) : (
                            <ChevronDown className="size-3 sm:size-4 text-[#4f7f5d]" />
                          )
                        ) : (
                          <ChevronDown className="size-3 sm:size-4 text-[#d8e2d5]" />
                        )}
                      </div>
                    </th>
                    <th
                      className="cursor-pointer p-2 sm:p-3 hover:bg-[#e8f0e4] whitespace-nowrap"
                      onClick={() => handleComparisonSort("totalLogs")}
                    >
                      <div className="flex items-center gap-1">
                        Logs
                        {comparisonSortConfig.key === "totalLogs" ? (
                          comparisonSortConfig.direction === "asc" ? (
                            <ChevronUp className="size-3 sm:size-4 text-[#4f7f5d]" />
                          ) : (
                            <ChevronDown className="size-3 sm:size-4 text-[#4f7f5d]" />
                          )
                        ) : (
                          <ChevronDown className="size-3 sm:size-4 text-[#d8e2d5]" />
                        )}
                      </div>
                    </th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Avg kcal</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Avg carbs</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Avg proteins</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Avg fats</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Latest BMI</th>
                    <th className="p-2 sm:p-3 whitespace-nowrap">Latest BP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedComparison.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-5 text-center text-sm text-[#6a7669]">
                        {comparisonSearchTerm ? "No results found." : "Select patients to compare."}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedComparison.map((row) => (
                      <tr key={row.userId} className="border-t border-[#eef3ec] hover:bg-[#f9fcf8]">
                        <td className="p-2 sm:p-3">
                          <input
                            type="checkbox"
                            checked={selectedPatientIds.has(row.userId)}
                            onChange={() => togglePatientSelection(row.userId)}
                            className="rounded border-[#d8e2d5]"
                          />
                        </td>
                        <td className="p-2 sm:p-3 min-w-[150px]">
                          <a href={`/dashboard?userId=${row.userId}`} className="font-medium text-[#245b35] hover:underline block text-xs sm:text-sm">
                            {row.name}
                          </a>
                          <p className="text-xs text-[#6a7669]">{row.email}</p>
                        </td>
                        <td className="p-2 sm:p-3 text-right">{row.totalLogs}</td>
                        <td className="p-2 sm:p-3 text-right">{round(row.avgCaloriesPerLog, 0)}</td>
                        <td className="p-2 sm:p-3 text-right">{round(row.avgCarbsPerLog)}g</td>
                        <td className="p-2 sm:p-3 text-right">{round(row.avgProteinsPerLog)}g</td>
                        <td className="p-2 sm:p-3 text-right">{round(row.avgFatsPerLog)}g</td>
                        <td className="p-2 sm:p-3 text-right">{row.latestBmi ? round(row.latestBmi) : "—"}</td>
                        <td className="p-2 sm:p-3 text-right">
                          {row.latestBpHigh && row.latestBpLow
                            ? `${round(row.latestBpHigh, 0)}/${round(row.latestBpLow, 0)}`
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
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
