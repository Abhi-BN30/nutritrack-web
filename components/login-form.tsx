"use client";

import { useActionState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { signIn, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={action}
      className="w-full rounded-lg border border-[#d4e0d0] bg-white p-5 shadow-sm sm:p-7"
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4f7f5d]">
          Sign in
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Email and 4 digit PIN</h2>
        <p className="mt-2 text-sm leading-6 text-[#667266]">
          Admins and patients use the same entry point. Your role decides which dashboard opens.
        </p>
      </div>

      <div className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Email</span>
          <span className="flex items-center gap-2 rounded-md border border-[#ccd8c9] bg-white px-3">
            <Mail className="size-4 text-[#6c7a6b]" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 w-full bg-transparent text-sm outline-none"
              placeholder="patient@example.com"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">4 digit PIN</span>
          <span className="flex items-center gap-2 rounded-md border border-[#ccd8c9] bg-white px-3">
            <LockKeyhole className="size-4 text-[#6c7a6b]" />
            <input
              name="pin"
              type="password"
              required
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="current-password"
              className="h-11 w-full bg-transparent text-sm outline-none"
              placeholder="1234"
            />
          </span>
        </label>
      </div>

      {state.message ? (
        <p className="mt-4 rounded-md bg-[#fff4e8] px-3 py-2 text-sm text-[#8a4a12]">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 h-11 w-full rounded-md bg-[#245b35] px-4 text-sm font-semibold text-white transition hover:bg-[#1c492a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in..." : "Open dashboard"}
      </button>
    </form>
  );
}
