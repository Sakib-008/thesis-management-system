import { Badge, Tone } from "@/components/ui/Badge";
import { RATING_LABEL, formatDate } from "@/lib/reportStatus";
import { Rating, WeeklyReport } from "@/lib/types";

type SheetReport = Pick<
  WeeklyReport,
  "section_a" | "section_b" | "next_works" | "header" | "status" | "rating" | "supervisor_comment" |
  "signed_by_name" | "signed_at"
>;

const RATING_TONE: Record<Rating, Tone> = {
  poor: "danger",
  average: "warning",
  good: "info",
  excellent: "success",
};

function Section({ letter, title, children }: { letter: string; title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span
          className={
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs " +
            "font-semibold text-on-brand"
          }
        >
          {letter}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-4 py-3 text-sm">{children}</div>
    </section>
  );
}

// The weekly progress report on screen. It has the same sections as the department's CSE 3200 progress sheet
// and the PDF the server makes, in the same style as the rest of the system.
export function ReportSheet({ report }: { report: SheetReport }) {
  const { header } = report;
  const signed = report.status === "signed";
  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="border-b border-line pb-4">
        <h2 className="text-lg font-semibold">{header.department_line}</h2>
        <p className="text-sm text-subtle">{header.university_name}</p>
        <p className="mt-2 text-sm font-semibold text-brand">
          {header.course_code}: {header.sheet_title}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-8 rounded-lg bg-ink/5 px-4 py-3 text-sm">
        <div>
          <div className="text-xs text-subtle">Name of the Student(s):</div>
          {header.students.map((s) => <div key={s.name} className="font-medium">{s.name}</div>)}
        </div>
        <div>
          <div className="text-xs text-subtle">Student ID(s):</div>
          {header.students.map((s) => <div key={s.name}>{s.student_number ?? "-"}</div>)}
        </div>
      </div>

      <Section letter="A" title="Summary of Works Performed in the Previous Week">
        <p className="min-h-[2.5rem] whitespace-pre-line break-words">{report.section_a}</p>
      </Section>

      <Section letter="B" title="Description of Current Week’s Activity">
        <p className="min-h-[3.5rem] whitespace-pre-line break-words">{report.section_b}</p>
      </Section>

      <Section letter="C" title="Proposed Works for the Next Week">
        <ol className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex min-h-[1.5rem] gap-3">
              <span className="w-4 shrink-0 font-semibold text-brand">{i + 1}.</span>
              <span className="break-words">{report.next_works[i] ?? ""}</span>
            </li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-6 pt-4 sm:grid-cols-2">
        <div>
          <div className="flex h-10 items-end justify-between gap-2 border-b border-ink px-1 pb-1 text-sm">
            <span className="italic">{signed ? report.signed_by_name : ""}</span>
            <span className="text-xs text-subtle">
              {signed && report.signed_at ? formatDate(report.signed_at) : ""}
            </span>
          </div>
          <div className="mt-1.5 text-xs font-semibold">Signature &amp; Date of the Supervisor</div>
        </div>
        <div>
          <div className="flex min-h-[2.5rem] items-end gap-2 border-b border-ink px-1 pb-1">
            {signed && report.rating && (
              <Badge tone={RATING_TONE[report.rating]}>{RATING_LABEL[report.rating]}</Badge>
            )}
            {signed && report.supervisor_comment && (
              <span className="text-xs italic text-subtle">{report.supervisor_comment}</span>
            )}
          </div>
          <div className="mt-1.5 text-xs font-semibold">Comments on Weekly Progress</div>
          <div className="text-xs text-subtle">(Poor/Average/Good/Excellent)</div>
        </div>
      </div>

      <p className="border-t border-line pt-3 text-[11px] font-medium text-subtle">
        *** This document must be presented by the student during Progress defense and Final defense for evaluation
        purpose.
      </p>
    </div>
  );
}