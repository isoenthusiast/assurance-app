import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import CreateAssessmentForm from "./CreateAssessmentForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const loaOptions = [
  { value: "FirstLine", label: "1st Line" },
  { value: "SecondLine", label: "2nd Line" },
  { value: "ThirdLine", label: "3rd Line" },
];

export default async function NewAssessmentPage() {
  const session = await auth();
  const currentUserId = (session?.user as { id?: string })?.id;
  const [activityTypes, users] = await Promise.all([
    prisma.assuranceActivityType.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (activityTypes.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-8">
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create at least one Assurance Activity Type before planning an assessment.{" "}
          <Link href="/setup/activity-types" className="underline">
            Go to Activity Types
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">Plan Assessment</h1>

      <CreateAssessmentForm activityTypes={activityTypes} users={users} loaOptions={loaOptions} currentUserId={currentUserId} />
    </div>
  );
}
