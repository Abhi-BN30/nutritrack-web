import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f8faf7] text-[#172117]">
      <section className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-[#245b35] text-lg font-bold text-white">
              N
            </div>
            <span className="text-lg font-semibold">NutriTrack</span>
          </div>

          <div className="max-w-2xl py-16">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#4f7f5d]">
              Clinical nutrition workspace
            </p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Food logs, medical markers, and admin analytics in one installable web app.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#526052]">
              Patients log meals and biometrics from any device. Admins review every patient,
              compare trends, and maintain one centralized nutrition master table.
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {["PWA ready", "Neon DB", "PIN login", "Admin role"].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-[#dfe8dc] bg-white px-3 py-3 text-sm font-medium"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-[#6a7669]">
            Optimized for phones, tablets, desktop clinics, and Vercel deployment.
          </p>
        </div>

        <div className="flex items-center bg-[#e8f0e4] px-6 py-10 sm:px-10 lg:px-16">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
