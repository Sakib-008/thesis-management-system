"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/apiClient";
import { downloadFile } from "@/lib/download";
import { formatBytes } from "@/lib/supervisionUi";

// A button that downloads a file from the API with the person's login token.
export function DownloadButton({ path, filename, size, label }: {
  path: string;
  filename: string;
  size?: number;
  label?: string;
}) {
  const toast = useToast();

  async function download() {
    try {
      await downloadFile(path, filename);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={download}>
      <Download className="h-3.5 w-3.5" />
      {label ?? filename}
      {size !== undefined && <span className="text-subtle"> · {formatBytes(size)}</span>}
    </Button>
  );
}