import { TopBar } from "@/components/layout/TopBar";
import { ContactsClient } from "@/components/jessy/ContactsClient";

/** `/jessy/contacts` — all leads overview across every branch (MENU RESTRUCTURE FINAL), replacing the old flat `/leads` list. */
export default function JessyContactsPage(): React.ReactElement {
  return (
    <main>
      <TopBar title="Contacts" />
      <ContactsClient />
    </main>
  );
}
