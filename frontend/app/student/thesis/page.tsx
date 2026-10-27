import Link from "next/link";
import { Building2, Mail, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { StatusTimeline } from "@/components/ui/StatusTimeline";
import { STUDENT_THESIS } from "@/lib/mock/studentDemo";
import { PROPOSAL } from "@/lib/mock/thesisDemo";

const LIFECYCLE = ["Proposal approved", "Supervisor assigned", "Milestones", "Final submission", "Evaluation", "Completed"];

export default function MyThesisPage() {
  return (
    <>
      <PageHeader title="My thesis" description="Your thesis, your supervisor and where you are in the process." />
      <DemoBanner />

      <Card className="mb-6">
        <CardHeader title="Thesis journey" />
        <CardContent><StatusTimeline steps={LIFECYCLE} current={2} /></CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-6 sm:flex-row">
            <ProgressRing value={STUDENT_THESIS.progress} label="complete" />
            <div className="flex-1 space-y-3">
              <Badge tone="brand">{STUDENT_THESIS.status}</Badge>
              <h2 className="text-xl font-semibold leading-snug">{STUDENT_THESIS.title}</h2>
              <p className="text-sm text-subtle">{PROPOSAL.abstract}</p>
              <div className="flex flex-wrap gap-2">
                {PROPOSAL.fields.map((f) => <Badge key={f} tone="brand">{f}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/student/proposal/1"><Button variant="secondary" size="sm">View proposal</Button></Link>
                <Link href="/student/proposal/1/recommendations">
                  <Button variant="secondary" size="sm"><Sparkles className="h-4 w-4" />AI recommendations</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader title="My supervisor" />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name="A Rahman" className="h-12 w-12 text-sm" />
              <div>
                <div className="font-semibold">Dr. A. Rahman</div>
                <div className="text-sm text-subtle">Professor</div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-subtle">
              <li className="flex items-center gap-2"><Building2 className="h-4 w-4" />Computer Science and Engineering</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" />a.rahman@university.edu</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">Deep Learning</Badge>
              <Badge tone="brand">Computer Vision</Badge>
            </div>
            <p className="border-t border-line pt-4 text-xs text-subtle">Assigned by the thesis coordinator.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}