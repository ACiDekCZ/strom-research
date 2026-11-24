// What lies in a task's folder of the inbox and is not taken yet, in the person's words (spec 141): files named
// otherwise than by the image numbers, taken in the folder's order once nothing more is saved; files whose name gives
// no image number. The menu's What waits and the status say it alike.

import type { InboxState } from "./inboxwait.ts";
import { quietMinutes } from "./inboxsettle.ts";

export function laterWords(t: (key: "ui.wait.later" | "ui.wait.left", params?: Record<string, string | number>) => string, st: InboxState, env?: Record<string, string | undefined>): string {
  const at = st.waitsUntil ? new Date(st.waitsUntil) : undefined;
  const time = at ? `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}` : "";
  return [st.waitsUntil ? t("ui.wait.later", { minutes: quietMinutes(env), time }) : "", st.left?.length ? t("ui.wait.left", { files: st.left.join(", ") }) : ""].filter(Boolean).join(" · ");
}
