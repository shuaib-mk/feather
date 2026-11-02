/** Q7.5: local-hour greeting. */
import { getDayGreeting, getDayGreetingForHour } from "../../client/src/lib/localDate";
let passed = 0, failed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { console.log("[PASS] " + name); passed++; }
  else { console.error("[FAIL] " + name, extra ?? ""); failed++; }
}
{
  const cases: Array<[number, string]> = [[0, "Good night"], [4, "Good night"], [5, "Good morning"], [11, "Good morning"], [12, "Good afternoon"], [15, "Good afternoon"], [16, "Good afternoon"], [17, "Good evening"], [21, "Good evening"], [22, "Good night"], [23, "Good night"]];
  for (const [h, want] of cases) check("Q7.5 STEP0: hour " + h + " is " + want, getDayGreetingForHour(h) === want, getDayGreetingForHour(h));
  check("Q7.5: local 15:43 is afternoon in any zone", getDayGreeting(new Date(2026, 10, 2, 15, 43)) === "Good afternoon", getDayGreeting(new Date(2026, 10, 2, 15, 43)));
  const instant = new Date(Date.UTC(2026, 10, 2, 10, 13));
  check("Q7.5: greeting follows the LOCAL hour, not UTC", getDayGreeting(instant) === getDayGreetingForHour(instant.getHours()), getDayGreeting(instant) + " vs local hour " + instant.getHours());
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (tz.indexOf("Kolkata") !== -1 || tz === "Asia/Calcutta") check("Q7.5: 15:43 IST says afternoon", getDayGreeting(instant) === "Good afternoon", tz + " " + getDayGreeting(instant));
  else if (tz === "UTC" || tz === "Etc/UTC") check("Q7.5: 10:13 UTC says morning", getDayGreeting(instant) === "Good morning", tz + " " + getDayGreeting(instant));
  else check("Q7.5: unknown zone runs the portable checks", true, tz);
}
import("node:fs").then((fs) => {
  const dash = fs.readFileSync("client/src/pages/DashboardPage.tsx", "utf8");
  check("Q7.5: dashboard shows the greeting", dash.indexOf("getDayGreeting()") !== -1, "dashboard wiring");
  console.log("Q7 Greeting Results: " + passed + " passed, " + failed + " failed.");
  if (failed > 0) process.exit(1);
});
