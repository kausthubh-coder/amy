#!/usr/bin/env node
// Drives Amy on Expo web the way a person does and saves evidence for each journey.
// Usage: node .agents/skills/verify-amy/scripts/journey.mjs [onboarding|today-logging|edit-entry|saved-meals|settings-goals ...]
// With no feature named, every journey runs. Exit code 1 when any journey fails.
// Needs a running server (scripts/web.sh start). Browser: the installed Chrome or Edge through Playwright,
// which installs itself into .artifacts/verify/.tools on first use (no browser download).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const tools = path.join(root, ".artifacts", "verify", ".tools");
const baseUrl = process.env.AMY_WEB_URL ?? `http://localhost:${process.env.AMY_WEB_PORT ?? "19077"}`;
const PLAYWRIGHT_VERSION = "1.64";

function loadPlaywright() {
  const manifest = path.join(tools, "package.json");
  if (!existsSync(path.join(tools, "node_modules", "playwright", "package.json"))) {
    console.log(`installing playwright@${PLAYWRIGHT_VERSION} into ${path.relative(root, tools)} (one time, no browser download)`);
    mkdirSync(tools, { recursive: true });
    if (!existsSync(manifest)) writeFileSync(manifest, '{"name":"amy-verify-tools","private":true}\n');
    execSync(`npm install --prefix "${tools}" playwright@${PLAYWRIGHT_VERSION} --no-audit --no-fund --loglevel=error`, { cwd: tools, stdio: "inherit" });
  }
  return createRequire(manifest)("playwright");
}

async function launchBrowser(chromium) {
  const headless = !process.env.AMY_HEADED;
  const errors = [];
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launch({ channel, headless });
    } catch (error) {
      errors.push(`${channel}: ${error.message.split("\n")[0]}`);
    }
  }
  try {
    return await chromium.launch({ headless });
  } catch (error) {
    errors.push(`bundled chromium: ${error.message.split("\n")[0]}`);
  }
  throw new Error(`No browser could start. Install Chrome or Edge, or run "npx playwright install chromium" in ${tools}.\n${errors.join("\n")}`);
}

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

class Journey {
  constructor(name, page, dir, log) {
    this.name = name;
    this.page = page;
    this.dir = dir;
    this.log = log;
    this.shots = 0;
  }

  async step(label, run) {
    this.log(`- ${label}`);
    await run();
  }

  /** Screenshot plus the accessibility tree, numbered in order, so a reader can follow the action and its result. */
  async capture(label) {
    this.shots += 1;
    const base = path.join(this.dir, `${String(this.shots).padStart(2, "0")}-${label}`);
    await this.page.screenshot({ path: `${base}.png` });
    let tree = "";
    try {
      tree = await this.page.locator("body").ariaSnapshot();
      // The body snapshot leaves out an open sheet (React Native Web renders it in a portal), so it is added by hand.
      const sheet = this.page.locator('[aria-modal="true"]');
      if (await sheet.count()) tree += `\n# open sheet\n${await sheet.last().ariaSnapshot()}`;
    } catch (error) {
      tree = `aria snapshot failed: ${error.message}`;
    }
    writeFileSync(`${base}.txt`, `${tree}\n`);
    this.log(`  evidence: ${path.basename(base)}.png, ${path.basename(base)}.txt`);
  }

  button(name) {
    return this.page.getByRole("button", { name, exact: true });
  }

  textbox(name) {
    return this.page.getByRole("textbox", { name, exact: true });
  }

  async see(text, timeout = 10000) {
    await this.page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
  }

  async count(locator, expected) {
    const deadline = Date.now() + 10000;
    let actual = await locator.count();
    while (actual !== expected && Date.now() < deadline) {
      await this.page.waitForTimeout(200);
      actual = await locator.count();
    }
    if (actual !== expected) throw new Error(`expected ${expected} of ${locator}, found ${actual}`);
  }

  async storage(expression) {
    return this.page.evaluate(expression);
  }

  async equal(actual, expected, what) {
    if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  /** Fresh diary, through the screens a person sees: clear storage, reload, finish onboarding with the defaults. */
  async freshToday() {
    await this.page.goto(baseUrl, { waitUntil: "load", timeout: 90000 });
    await this.page.evaluate(() => localStorage.clear());
    await this.page.reload({ waitUntil: "load", timeout: 90000 });
    await this.see("Set your target", 60000);
    await this.button("Continue").click();
    await this.see("Smart estimates");
    await this.button("Skip for now").click();
    await this.textbox("Food log for Today").waitFor({ state: "visible" });
  }

  /** Types into the note at the end, keystroke by keystroke; a trailing newline completes the line. */
  async typeLine(text) {
    // A closing sheet keeps its focus trap for the 300 ms slide-out; keystrokes sent then are lost.
    await this.page.waitForFunction(() => !document.querySelector('[aria-modal="true"]'));
    const note = this.textbox("Food log for Today");
    await note.click();
    await this.page.keyboard.press("Control+End");
    // A line Amy appended itself (saved meal, barcode, photo) has no newline after it, like any note.
    const current = await note.inputValue();
    if (current && !current.endsWith("\n")) await this.page.keyboard.press("Enter");
    await note.pressSequentially(text);
  }
}

const journeys = {
  async onboarding(j) {
    await j.step("start with an empty diary", async () => {
      await j.page.goto(baseUrl, { waitUntil: "load", timeout: 90000 });
      await j.page.evaluate(() => localStorage.clear());
      await j.page.reload({ waitUntil: "load", timeout: 90000 });
      await j.see("Set your target", 60000);
      await j.equal(await j.textbox("Daily calorie target").inputValue(), "2000", "default target");
      await j.capture("set-your-target");
    });
    await j.step("a target of 500 is refused with an inline error", async () => {
      await j.textbox("Daily calorie target").fill("500");
      await j.button("Continue").click();
      await j.see("Enter a daily calorie target between 800 and 10,000.");
      await j.capture("target-too-low");
    });
    await j.step("2200 goes to step 2", async () => {
      await j.textbox("Daily calorie target").fill("2200");
      await j.button("Continue").click();
      await j.see("Smart estimates");
      await j.capture("smart-estimates");
    });
    await j.step("Skip for now opens an empty Today", async () => {
      await j.button("Skip for now").click();
      await j.textbox("Food log for Today").waitFor({ state: "visible" });
      await j.button("0 calories logged. Show details").waitFor({ state: "visible" });
      await j.capture("today-empty");
    });
    await j.step("the goal is stored", async () => {
      const goal = await j.storage(() => JSON.parse(localStorage.getItem("@amy/v2/meta")).goal.dailyCalories);
      await j.equal(goal, 2200, "stored dailyCalories");
    });
  },

  async "today-logging"(j) {
    await j.freshToday();
    await j.step("an inline-calorie line logs at once and a bare line waits for calories", async () => {
      await j.typeLine("protein shake 160 cal\ncoffee\n");
      await j.button("Edit protein shake, 160 calories").waitFor({ state: "visible" });
      await j.button("Add calories for coffee").waitFor({ state: "visible" });
      await j.button("160 calories logged. Show details").waitFor({ state: "visible" });
      await j.button("1 day streak").waitFor({ state: "visible" });
      await j.capture("two-lines");
    });
    await j.step("deleting a line removes its food and offers Undo", async () => {
      await j.textbox("Food log for Today").fill("coffee\n");
      await j.see("Removed protein shake (160 cal)");
      await j.button("Undo").waitFor({ state: "visible" });
      await j.button("0 calories logged. Show details").waitFor({ state: "visible" });
      await j.capture("removed-with-undo");
    });
    await j.step("Undo brings the line and its calories back", async () => {
      await j.button("Undo").click();
      await j.button("Edit protein shake, 160 calories").waitFor({ state: "visible" });
      await j.button("160 calories logged. Show details").waitFor({ state: "visible" });
      await j.equal((await j.textbox("Food log for Today").inputValue()).trimEnd(), "protein shake 160 cal\ncoffee", "note text after undo");
      await j.capture("after-undo");
    });
    await j.step("the diary survives a reload", async () => {
      await j.page.waitForTimeout(800);
      await j.page.reload({ waitUntil: "load", timeout: 90000 });
      await j.button("Edit protein shake, 160 calories").waitFor({ state: "visible", timeout: 60000 });
      await j.button("Add calories for coffee").waitFor({ state: "visible" });
      await j.capture("after-reload");
      const month = new Date().toISOString().slice(0, 7);
      const stored = await j.storage(() => ({ months: JSON.parse(localStorage.getItem("@amy/v2/meta")).months, keys: Object.keys(localStorage).filter((k) => k.startsWith("@amy/")) }));
      await j.equal(stored.months.includes(month), true, `meta.months lists ${month}`);
      await j.equal(stored.keys.includes(`@amy/v2/month/${month}`), true, `shard @amy/v2/month/${month} exists`);
    });
  },

  async "edit-entry"(j) {
    await j.freshToday();
    await j.step("+ cal opens the manual sheet and Log it records the number", async () => {
      await j.typeLine("coffee\n");
      await j.button("Add calories for coffee").click();
      await j.see("Add calories");
      await j.textbox("Calories").fill("5");
      await j.capture("manual-sheet");
      await j.button("Log it").click();
      await j.see('Logged 5 cal. Amy will remember "coffee".');
      await j.button("Edit coffee, 5 calories").waitFor({ state: "visible" });
      await j.capture("logged-five");
    });
    await j.step("Enter in the Calories field saves the edit", async () => {
      await j.button("Edit coffee, 5 calories").click();
      await j.see("Edit Food");
      await j.textbox("Calories").fill("12");
      await j.textbox("Calories").press("Enter");
      await j.button("Edit coffee, 12 calories").waitFor({ state: "visible" });
      await j.capture("edited-twelve");
    });
    await j.step("typing the same line again logs the remembered number without the network", async () => {
      await j.typeLine("coffee\n");
      await j.count(j.button("Edit coffee, 12 calories"), 2);
      await j.button("24 calories logged. Show details").waitFor({ state: "visible" });
      await j.capture("remembered");
    });
    await j.step("Remove deletes the food and its line, with Undo", async () => {
      await j.button("Edit coffee, 12 calories").first().click();
      await j.button("Remove").click();
      await j.see("Removed coffee");
      await j.button("Undo").waitFor({ state: "visible" });
      await j.count(j.button("Edit coffee, 12 calories"), 1);
      await j.capture("removed");
    });
  },

  async "saved-meals"(j) {
    await j.freshToday();
    await j.step("create a quick meal", async () => {
      await j.button("Open saved meals").click();
      await j.see("Saved Meals");
      await j.textbox("Meal name").fill("Overnight oats");
      await j.textbox("Calories").fill("320");
      await j.button("Save meal").click();
      await j.button("Add Overnight oats, 320 calories").waitFor({ state: "visible" });
      await j.capture("meal-created");
    });
    await j.step("Add logs it and closes the sheet", async () => {
      await j.button("Add Overnight oats, 320 calories").click();
      await j.see("Logged Overnight oats: 320 cal");
      await j.button("Edit Overnight oats, 320 calories").waitFor({ state: "visible" });
      await j.capture("meal-logged");
    });
    await j.step("typing its name logs it again without the network", async () => {
      await j.typeLine("overnight oats\n");
      await j.count(j.button("Edit Overnight oats, 320 calories"), 2);
      await j.button("640 calories logged. Show details").waitFor({ state: "visible" });
      await j.capture("meal-typed");
    });
    await j.step("delete offers Undo", async () => {
      await j.button("Open saved meals").click();
      await j.button("Delete saved meal Overnight oats").click();
      await j.see('Deleted "Overnight oats"');
      // A toast raised inside a sheet also renders at the root, behind the backdrop; the sheet's copy is the live one.
      await j.page.locator('[aria-modal="true"]').getByRole("button", { name: "Undo", exact: true }).waitFor({ state: "visible" });
      await j.count(j.button("Add Overnight oats, 320 calories"), 0);
      await j.capture("meal-deleted");
    });
  },

  async "settings-goals"(j) {
    await j.page.addInitScript(() => {
      // The clipboard is the OS boundary; capturing what Amy hands it is the test.
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: (text) => ((window.__amyCopied = text), Promise.resolve()), readText: () => Promise.resolve(window.__amyCopied ?? "") }
      });
    });
    await j.freshToday();
    await j.step("a daily goal typed as 2,200 saves as two thousand two hundred", async () => {
      await j.button("Open settings").click();
      await j.see("Settings");
      await j.textbox("Daily calories").fill("2,200");
      await j.button("Save goals").click();
      await j.see("Goals saved.");
      const goal = await j.storage(() => JSON.parse(localStorage.getItem("@amy/v2/meta")).goal.dailyCalories);
      await j.equal(goal, 2200, "stored dailyCalories");
      await j.capture("goals-saved");
    });
    await j.step("logging a weight keeps an unsaved goal edit", async () => {
      await j.textbox("Daily calories").fill("2,300");
      await j.textbox("Current weight in pounds").fill("180");
      await j.button("Log weight & update goal").click();
      await j.see("Weight logged for Today.");
      await j.equal(await j.textbox("Daily calories").inputValue(), "2,300", "Daily calories field after logging a weight");
      const weight = await j.storage(() => JSON.parse(localStorage.getItem("@amy/v2/meta")).goal.currentWeightLbs);
      await j.equal(weight, 180, "stored currentWeightLbs");
      await j.capture("weight-logged");
    });
    await j.step("Copy JSON exports without the key", async () => {
      await j.button("Copy JSON").click();
      await j.page.waitForTimeout(300);
      const copied = await j.storage(() => window.__amyCopied ?? "");
      await j.equal(copied.startsWith("{"), true, "clipboard holds JSON");
      const parsed = JSON.parse(copied);
      await j.equal(parsed.kind, "amy-local-export", "export kind");
      await j.equal(parsed.data.settings.openRouterKey, "", "exported openRouterKey");
      await j.equal("androidExportDirectoryUri" in parsed.data.settings, false, "exported folder grant");
    });
    await j.step("an export with no data section is refused", async () => {
      await j.button("Paste JSON").click();
      await j.textbox("Pasted Amy JSON export").fill('{"kind":"amy-local-export"}');
      await j.button("Import pasted JSON").click();
      await j.see("no Amy data section");
      const goal = await j.storage(() => JSON.parse(localStorage.getItem("@amy/v2/meta")).goal.dailyCalories);
      await j.equal(goal, 2200, "dailyCalories after the refused import");
      await j.capture("import-refused");
    });
  }
};

async function main() {
  const requested = process.argv.slice(2);
  const unknown = requested.filter((name) => !journeys[name]);
  if (unknown.length) {
    console.error(`unknown journey: ${unknown.join(", ")}. Known: ${Object.keys(journeys).join(", ")}`);
    process.exit(2);
  }
  const names = requested.length ? requested : Object.keys(journeys);
  const runDir = path.join(root, ".artifacts", "verify", `${stamp()}-${requested.length ? requested.join("+") : "all"}`);
  mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, "run.md");
  const log = (line) => {
    appendFileSync(logFile, `${line}\n`);
    console.log(line);
  };
  let head = "unknown";
  try {
    head = execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Not a git checkout; the run is still valid.
  }
  log(`# Amy verify run ${path.basename(runDir)}\n\nURL: ${baseUrl}\nHEAD: ${head}\nViewport: 412x915 (Pixel 7)\nOpenRouter key: empty, so no request leaves the browser.\n`);

  const { chromium } = loadPlaywright();
  const browser = await launchBrowser(chromium);
  const failures = [];
  try {
    for (const name of names) {
      const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const dir = path.join(runDir, name);
      mkdirSync(dir, { recursive: true });
      const journey = new Journey(name, page, dir, log);
      log(`\n## ${name}`);
      try {
        await journeys[name](journey);
        log(`PASS ${name}`);
      } catch (error) {
        failures.push(name);
        try {
          await journey.capture("failure");
        } catch {
          // The page may be gone; the error below still says what failed.
        }
        log(`FAIL ${name}: ${error.message.split("\n")[0]}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  log(`\n${failures.length ? `FAILED: ${failures.join(", ")}` : `PASS: ${names.join(", ")}`}\nEvidence: ${runDir}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
