"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";




import { Spinner } from "@/components/ui/Spinner";
import { apiGet } from "@/lib/apiClient";
import { Proposal } from "@/lib/types";

// The "Proposal" menu item: open my proposal, or start a new one if I have none yet.
export default function ProposalIndexPage() {
  const router = useRouter();

    useEffect(() => {
      apiGet<Proposal>("/api/v1/proposals/me")
        .then((p) => router.replace(`/student/proposal/${p.id}`))
        .catch(() => router.replace("/student/proposal/new"));
    }, [router]);

    return <Spinner className="mt-20 h-8 w-8" />;
}
