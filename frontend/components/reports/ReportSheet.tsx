import { RATING_LABEL, formatDate } from "@/lib/reportStatus";
import { WeeklyReport } from "@/lib/types";
type SheetReport = Pick<
  WeeklyReport,
  "section_a" | "section_b" | "next_works" | "header" | "status" | "rating" | "supervisor_comment" |
  "signed_by_name" | "signed_at"
>;
const serif = { fontFamily: '"Times New Roman", Times, serif' };
// The department's weekly progress sheet, drawn on screen. It always looks like white paper, in light or
// dark mode. The PDF the server makes follows the same layout.
export function ReportSheet({ report }: { report: SheetReport }) {
  const { header } = report;
  const signed = report.status === "signed";
  return (
    <div
      className={
        "mx-auto w-full max-w-[640px] rounded border border-line bg-white p-6 text-[13px] " +
        "text-black shadow-sm"
      }
      style={serif}
    >
      <div className="text-center text-[15px] leading-snug">
        <div className="font-bold">{header.department_line}</div>
        <div>{header.university_name}</div>
        <div className="mt-2 font-bold underline">{header.course_code}: {header.sheet_title}</div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-x-8">
        <div>
          <div>Name of the Student(s):</div>
          {header.students.map((s) => <div key={s.name} className="pl-1">{s.name}</div>)}
        </div>
        <div>
          <div>Student ID(s):</div>
          {header.students.map((s) => <div key={s.name}>{s.student_number ?? "-"}</div>)}
        </div>
      </div>
      <div className="mt-4 border border-black">
        <div className="min-h-[150px] border-b border-black p-2">
          <div className="italic"><b>A.</b> Summary of Works Performed in the Previous Week:</div>
          <p className="mt-1 whitespace-pre-line break-words">{report.section_a}</p>
        </div>
               <div className="min-h-[220px] border-b border-black p-2">
          <div className="italic"><b>B.</b> Description of Current Week’s Activity:</div>
          <p className="mt-1 whitespace-pre-line break-words">{report.section_b}</p>
        </div>
        <div className="min-h-[140px] p-2">
          <div className="italic"><b>C.</b>&nbsp;&nbsp; Proposed Works for the Next Week:</div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="mt-2 flex min-h-[28px] gap-2">
              <span className="italic">{i + 1}.</span>
              <span className="break-words">{report.next_works[i] ?? ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-6 text-center text-[12px] font-bold">
        <div>
          <div className="flex h-10 items-end justify-between border-b border-black px-1 pb-0.5 font-normal italic">
            <span>{signed ? report.signed_by_name : ""}</span>
            <span>{signed && report.signed_at ? formatDate(report.signed_at) : ""}</span>
          </div>
          <div className="mt-1">Signature &amp; Date of the Supervisor</div>
        </div>
        <div>
          <div className="flex h-10 flex-col items-center justify-end border-b border-black pb-0.5">
            {signed && report.supervisor_comment && (
              <span className="text-[10px] font-normal italic leading-tight">{report.supervisor_comment}</span>
            )}
            <span>{signed && report.rating ? RATING_LABEL[report.rating] : ""}</span>
          </div>
          <div className="mt-1">Comments on Weekly Progress<br />(Poor/Average/Good/Excellent)</div>
        </div>
      </div>
      <p className="mt-6 text-[10px] font-bold">
        *** This document must be presented by the student during Progress defense and Final defense for evaluation
        purpose.
      </p>
    </div>
  );
}