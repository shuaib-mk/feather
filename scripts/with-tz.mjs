// Runs a command twice-under different TZ values without new dependencies.
// Usage: node scripts/with-tz.mjs <TZ> <command...>
import { spawn } from "node:child_process";
const [tz, ...cmd] = process.argv.slice(2);
if (!tz || cmd.length === 0) { console.error("usage: with-tz.mjs <TZ> <command...>"); process.exit(2); }
const child = spawn(cmd.join(" "), { shell: true, stdio: "inherit", env: { ...process.env, TZ: tz } });
child.on("exit", (code) => process.exit(code ?? 1));
