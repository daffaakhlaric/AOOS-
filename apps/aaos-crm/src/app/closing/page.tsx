import { ClosingListClient } from "@/components/closing/ClosingListClient";

/** Closing list (spec "/closing"). */
export default function ClosingPage(): React.ReactElement {
  return (
    <main>
      <ClosingListClient />
    </main>
  );
}
