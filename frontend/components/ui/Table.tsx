import { ReactNode, TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

// Shows a spinner while loading, an empty message when there are no rows, otherwise the rows.
export function Table({ headers, children, loading, emptyText }: {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  emptyText?: string;
}) {
  const span = headers.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-subtle">
            {headers.map((h, i) => <th key={i} className="px-5 py-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading ? (
            <tr><td colSpan={span} className="px-5 py-12 text-center"><Spinner /></td></tr>
          ) : emptyText ? (
            <tr><td colSpan={span} className="px-5 py-12 text-center text-subtle">{emptyText}</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-3.5 align-middle", className)} {...props} />;
}