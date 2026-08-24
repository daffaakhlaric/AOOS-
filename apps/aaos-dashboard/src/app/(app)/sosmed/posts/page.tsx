import { TopBar } from "@/components/layout/TopBar";
import { PostManagerClient } from "@/components/sosmed/PostManagerClient";

/** `/sosmed/posts` — Post Manager (AAOS-SOSMED-AUTOMATION Phase 5, Page 4). */
export default function PostManagerPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Post Manager" />
      <PostManagerClient />
    </main>
  );
}
