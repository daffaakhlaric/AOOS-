import { redirect } from "next/navigation";

/** Home route — no home content of its own (spec "Folder Structure": `page.tsx  ← home → redirect to /simulator`). */
export default function HomePage(): never {
  redirect("/simulator");
}
