import { StressTestDetail } from "@/components/stress-test/StressTestDetail";

export default function Page({
  params,
}: {
  readonly params: { readonly runId: string };
}): React.ReactElement {
  return <StressTestDetail runId={params.runId} />;
}
