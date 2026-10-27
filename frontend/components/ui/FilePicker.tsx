"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "./Button";

export function FilePicker({ label = "Choose file", accept, onChange }: {
  label?: string;
  accept?: string;
  onChange?: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setName(file?.name ?? null);
          onChange?.(file);
        }} />
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>
        <Paperclip className="h-4 w-4" />{label}
      </Button>
      <span className="truncate text-sm text-subtle">{name ?? "No file selected"}</span>
    </div>
  );
}