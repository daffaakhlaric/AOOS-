import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function SimulatorLoading(): React.ReactElement {
  return (
    <main className="mx-auto flex max-w-6xl items-center justify-center p-6">
      <LoadingSpinner label="Memuat simulator..." />
    </main>
  );
}
