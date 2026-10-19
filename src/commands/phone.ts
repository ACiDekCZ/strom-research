// The phone: a phone of the person reaches the research on the local network (core/phone.ts). Turned on by the person
// alone; turned off by anyone.

import { register } from "../cli/registry.ts";
import type { Context } from "../cli/context.ts";
import { lines, table } from "../cli/format.ts";
import { ui } from "../cli/ui.ts";
import { StromError } from "../core/errors.ts";
import { pairCode, pairedPhones, pairUrl, phoneConfig, phoneLogFile, phoneProbeNow, phoneState, phoneWindowText, removePhone, servePhone, stopPhone, turnPhoneOn, type PhoneState } from "../core/phone.ts";
import { qrTerminal } from "../core/qr.ts";

/** What the state says to a person, in their language. */
function stateLines(lang: string, s: PhoneState): string {
  const said =
    s.state === "on"
      ? s.addresses.length
        ? ui(lang, "ui.phone.on", { urls: s.addresses.map((a) => a.url).join(", ") })
        : ui(lang, "ui.phone.starting")
      : s.state === "error"
        ? ui(lang, "ui.phone.error", { why: ui(lang, `ui.phone.why.${s.error?.code ?? "bind-failed"}`) })
        : s.state === "confirm"
          ? ui(lang, "ui.phone.confirm")
          : s.state === "declined"
            ? ui(lang, "ui.phone.declined")
            : ui(lang, "ui.phone.off");
  return lines(said, s.phones.length ? ui(lang, "ui.phone.phones", { n: String(s.phones.length) }) : ui(lang, "ui.phone.nophones"));
}

/** What the window of strom phone on says: the question, then what a phone will see. */
function windowSays(ctx: Context, lang: string): string {
  const w = phoneWindowText(ctx.env, lang);
  return `${w.title}\n\n${w.question}`;
}

/** The state once its server says its addresses (just turned on: a few seconds). */
async function withAddresses(ctx: Context): Promise<PhoneState> {
  let s = phoneState(ctx.env);
  for (let waited = 0; s.state === "on" && !s.addresses.length && waited < 6000; waited += 100) {
    await new Promise((r) => setTimeout(r, 100));
    s = phoneState(ctx.env);
  }
  return s;
}

/**
 * The QR code to pair a phone, in the person's terminal: of the first address of the server (or `address`), the page in
 * their language. Never to an agent (--json, no terminal): the code is a phone's way in.
 */
function qrLines(ctx: Context, s: PhoneState, address?: string): string {
  const lang = ctx.uiLang();
  const url = address ? s.addresses.find((a) => a.url === address.replace(/\/+$/, ""))?.url : s.addresses[0]?.url;
  const addresses = s.addresses.map((a) => a.url).join(", ");
  if (!url) throw new StromError(`no address of the phone's server: ${address}`, { hint: `one of: ${addresses}`, code: "phone.address", params: { address: address ?? "", addresses } });
  // in a tree's folder: the page opens that tree once paired
  let tree: string | undefined;
  try {
    tree = ctx.hasTree() ? ctx.tree().config.id : undefined;
  } catch {
    // a tree this strom cannot open: the page opens the one it chose
  }
  const { code, expiresAt } = pairCode(ctx.env, tree ? { tree } : {});
  const time = new Date(expiresAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
  return lines(
    qrTerminal(pairUrl(url, code, lang)),
    "",
    ui(lang, "ui.phone.qr", { time }),
    ui(lang, "ui.phone.qr.url", { url }),
    ...s.addresses.filter((a) => a.url !== url).map((a) => ui(lang, "ui.phone.qr.more", { url: a.url })),
  );
}

/** The person's own terminal: a QR code may be shown. */
const showsQr = (ctx: Context) => ctx.io.tty && !ctx.json;

async function status(ctx: Context) {
  const s = phoneState(ctx.env);
  const probe = await phoneProbeNow(ctx.env);
  return { text: stateLines(ctx.uiLang(), s), data: { ...s, ...probe } };
}

register(
  {
    path: ["phone"],
    summary: "The phone connection: a server of this computer for a phone on the local network (on, off, paired phones)",
    group: "setup",
    description:
      "A server of its own on this computer's private addresses (Wi-Fi or a cable at home: 10.x, 172.16–31.x, 192.168.x —\n" +
      "never every address, never a VPN's or a virtual machine's), port 47800 (the next free one when another program has\n" +
      "it). It answers only devices of that network that ask it by its own address. On or off is this computer's, the\n" +
      "same for every research. Turned on by the user alone (their terminal, or a window of the system); turned off by\n" +
      "anyone, the paired phones stay paired. Started again by itself where the bridges are (a session, strom updated).\n" +
      "What it did: phone.log in strom's settings folder.",
    examples: ["strom phone", "strom phone --json", "strom phone off"],
    run: (ctx) => status(ctx),
  },
  {
    path: ["phone", "status"],
    summary: "Whether the phone connection is on, at which addresses, and the phones paired",
    group: "setup",
    run: (ctx) => status(ctx),
  },
  {
    path: ["phone", "on"],
    summary: "Turn the phone connection on (the user alone: their terminal, or a window of the system)",
    group: "setup",
    description: "An agent cannot answer for the user: without a terminal of theirs or a window of the system it ends with needs-input (exit 4).",
    async run(ctx) {
      const lang = ctx.uiLang();
      if (!phoneConfig(ctx.env).on) {
        // in a terminal too, the person's own yes (it opens the computer to its network; Enter says no): a terminal an agent
        // opened round its markers turns nothing on by itself
        const w = phoneWindowText(ctx.env, lang);
        const how = await ctx.requireHumanYes(
          "Turn on the connection with a phone on the local network (a phone paired by its QR code sees an overview of the research and sends photos into it)?",
          "strom phone on",
          "phone",
          windowSays(ctx, lang),
          { terminal: w.question, ask: w.title },
        );
        if (!how) return { text: ui(lang, "ui.phone.notturned"), data: phoneState(ctx.env) };
        turnPhoneOn(ctx.env, how === "terminal" ? "strom phone on, yes in the user's terminal" : "strom phone on, yes in a window");
      } else turnPhoneOn(ctx.env, "on already");
      // the QR code to pair a phone right away, in the person's terminal; to an agent only where it is
      const s = showsQr(ctx) ? await withAddresses(ctx) : phoneState(ctx.env);
      const qr = s.state !== "on" ? "" : showsQr(ctx) && s.addresses.length ? qrLines(ctx, s) : ui(lang, "ui.phone.qr.app");
      return { text: lines(stateLines(lang, s), ...(qr ? ["", qr] : [])), data: phoneState(ctx.env) };
    },
  },
  {
    path: ["phone", "qr"],
    summary: "Show a QR code to pair a phone, in the user's terminal (one phone, 10 minutes)",
    group: "setup",
    description:
      "The phone's camera opens the page of the phone's server on this computer and pairs it (the same Wi-Fi). The code\n" +
      "holds 10 minutes, for one phone; shown again meanwhile, the same code. Only in the user's own terminal — never\n" +
      "with --json or without a terminal: the code is a phone's way into the research (the Strom app shows it too:\n" +
      "Research → Connect phone…). The page is in the research language.",
    options: [{ name: "address", type: "string", value: "<url>", description: "another address of this computer (strom phone says them), e.g. a cable's beside the Wi-Fi" }],
    examples: ["strom phone qr", "strom phone qr --address http://192.168.0.5:47800"],
    async run(ctx, { opts }) {
      const lang = ctx.uiLang();
      if (!showsQr(ctx)) throw new StromError("the QR code to pair a phone is shown in the user's own terminal or in the Strom app, never to an agent", { hint: "the user runs strom phone qr in their terminal, or Research → Connect phone… in the Strom app", code: "phone.qr-terminal" });
      const s = await withAddresses(ctx);
      if (s.state !== "on" || !s.addresses.length) return { text: s.state === "on" || s.state === "error" ? stateLines(lang, s) : ui(lang, "ui.phone.qr.off"), data: { state: s.state } };
      return { text: qrLines(ctx, s, typeof opts.address === "string" ? opts.address : undefined), data: { state: s.state } };
    },
  },
  {
    path: ["phone", "off"],
    summary: "Turn the phone connection off (anyone may): its server ends, the paired phones stay paired",
    group: "setup",
    run(ctx) {
      const how = stopPhone(ctx.env, "strom phone off");
      const s = phoneState(ctx.env);
      return { text: lines(ui(ctx.uiLang(), "ui.phone.turnedoff"), stateLines(ctx.uiLang(), s)), data: { ...s, how } };
    },
  },
  {
    path: ["phone", "list"],
    summary: "The phones paired with this computer",
    group: "setup",
    run(ctx) {
      const s = phoneState(ctx.env);
      const lang = ctx.uiLang();
      return {
        text: s.phones.length ? table(s.phones.map((p) => [p.id, p.name, p.pairedAt.slice(0, 10), p.lastSeenAt?.slice(0, 16).replace("T", " ") ?? "", p.address, p.stale ? ui(lang, "ui.phone.stale") : ""])) : ui(lang, "ui.phone.nophones"),
        data: { phones: s.phones },
      };
    },
  },
  {
    path: ["phone", "remove"],
    summary: "Take a phone off the paired ones (it reaches the research no more until paired again)",
    group: "setup",
    args: [{ name: "id", description: "the phone's ph_… (strom phone list)", required: true }],
    examples: ["strom phone remove ph_k3m9q2xa"],
    run(ctx, { args }) {
      const id = args[0]!;
      const gone = removePhone(ctx.env, id);
      if (!gone) throw new StromError(`no paired phone ${id}`, { hint: "strom phone list", code: "phone.unknown", params: { id } });
      return { text: ui(ctx.uiLang(), "ui.phone.removed", { name: gone.name || id }), data: { removed: id, phones: pairedPhones(ctx.env).map((p) => p.id) } };
    },
  },
  {
    path: ["phone", "serve"],
    summary: "Run the phone's server here, in the foreground (strom phone on runs it in the background; only while on)",
    group: "setup",
    async run(ctx) {
      if (!phoneConfig(ctx.env).on) throw new StromError("the phone connection is off", { hint: "the user turns it on: strom phone on", code: "phone.off" });
      const why = await servePhone(ctx.env);
      // a server that ended is gone as a process, whatever still holds it
      setTimeout(() => process.exit(), 3000).unref();
      return { text: `${ui(ctx.uiLang(), "ui.phone.ended")} (${why}; ${ctx.display(phoneLogFile(ctx.env))})`, data: { ended: why } };
    },
  },
);
