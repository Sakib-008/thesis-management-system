import { ReactNode } from "react";
import { BadgeCheck, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";

const FEATURES = [
  { icon: Sparkles, title: "AI-assisted matching", text: "Proposals are matched to supervisors by research field, expertise and workload." },
  { icon: BadgeCheck, title: "Track every milestone", text: "Proposals, feedback, meetings and documents in one place." },
  { icon: ShieldCheck, title: "Role-based access", text: "Students, supervisors, coordinators and admins see only what they should." },
];

export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold">Thesis Manager</span>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            The whole thesis journey, from proposal to final grade.
          </h2>
          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-indigo-100">{f.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-sm text-indigo-200">AI-Assisted University Thesis Management System</div>
      </div>

      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-on-brand">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-semibold">Thesis Manager</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mb-8 mt-1.5 text-sm text-subtle">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}