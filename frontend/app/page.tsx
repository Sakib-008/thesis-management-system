"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/apiClient";

const ROUTES = [
  "login", "register",
  "student/dashboard", "student/profile", "student/proposal/new", "student/thesis",
  "student/milestones", "student/documents", "student/meetings", "student/feedback", "student/evaluation",
  "supervisor/dashboard", "supervisor/profile", "supervisor/proposals", "supervisor/students",
  "supervisor/milestones", "supervisor/meetings", "supervisor/evaluations",
  "coordinator/dashboard", "coordinator/proposals", "coordinator/assignment-runs", "coordinator/assignments",
  "coordinator/research-fields", "coordinator/workload", "coordinator/reports",
  "admin/users", "admin/departments", "admin/programs", "admin/supervisor-designations",
  "admin/settings", "admin/audit-logs",
];

export default function Home() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    apiGet<{ status: string }>("/health")
      .then((r) => setStatus(r.status === "ok" ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  return (
    <>
      <div className="card">
        <h1>Phase 1 scaffold</h1>
        <p>
          Backend API:{" "}
          {status === "checking" && <span>checking…</span>}
          {status === "ok" && <strong className="ok">connected (database reachable)</strong>}
          {status === "down" && <strong className="bad">unreachable</strong>}
        </p>
      </div>
      <div className="card">
        <h2>Route stubs</h2>
        <ul className="routes">
          {ROUTES.map((r) => (
            <li key={r}>
              <Link href={"/" + r}>/{r}</Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}