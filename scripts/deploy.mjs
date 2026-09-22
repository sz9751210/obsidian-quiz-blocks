import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import process from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, ".quiz-blocks-dev.json");
const normalize = value =>
	resolve(root, value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value);

// ─── ANSI helpers (build phase only) ─────────────────────────────────────────
const ESC = "\x1b[";
const ansi = {
	reset:      "\x1b[0m",
	bold:       "\x1b[1m",
	dim:        "\x1b[2m",
	green:      "\x1b[32m",
	red:        "\x1b[31m",
	cyan:       "\x1b[36m",
	yellow:     "\x1b[33m",
	showCursor: "\x1b[?25h",
};
const c    = (color, text) => `${ansi[color]}${text}${ansi.reset}`;
const bold = text => `${ansi.bold}${text}${ansi.reset}`;
const dim  = text => `${ansi.dim}${text}${ansi.reset}`;
const col0 = `${ESC}1G`;
const moveUp = n => `${ESC}${n}A`;

// ─── Spinner ──────────────────────────────────────────────────────────────────
function spinner(text) {
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	let i = 0;
	process.stdout.write("\x1b[?25l");
	const id = setInterval(() => {
		process.stdout.write(`\r${col0}\x1b[2K${c("cyan", frames[i % frames.length])} ${text}`);
		i++;
	}, 80);
	return {
		stop(success, message) {
			clearInterval(id);
			process.stdout.write(`\r${col0}\x1b[2K`);
			process.stdout.write(ansi.showCursor);
			if (message) {
				const icon = success ? c("green", "✓") : c("red", "✗");
				console.log(`${icon} ${message}`);
			}
		},
	};
}

// ─── Python wizard ────────────────────────────────────────────────────────────
/**
 * Spawns the Python curses wizard.
 * Uses stdio:"inherit" so curses gets the real TTY.
 * Result is passed back via a temp file to avoid stdout/TTY conflicts.
 * Returns the chosen config object, or null if the user cancelled.
 */
function runPythonWizard() {
	const script  = join(root, "scripts", "deploy-ui.py");
	const outFile = join(tmpdir(), `quiz-blocks-${process.pid}.json`);
	let result;
	try {
		const proc = spawnSync("python3", [script, "--output", outFile], {
			stdio: "inherit",   // all 3 fds → real TTY; curses works correctly
		});
		if (proc.error) {
			if (proc.error.code === "ENOENT") {
				throw new Error("找不到 python3，請確認已安裝 Python 3.9+。");
			}
			throw proc.error;
		}
		if (proc.status === 1) return null;   // user cancelled
		if (proc.status !== 0) throw new Error(`部署精靈異常退出（exit ${proc.status}）。`);
		if (!existsSync(outFile)) throw new Error("部署精靈未產生輸出，請回報此問題。");
		result = JSON.parse(readFileSync(outFile, "utf8"));
	} finally {
		try { unlinkSync(outFile); } catch { /* ignore */ }
	}
	return result;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
try {
	const { values } = parseArgs({ options: {
		vault:       { type: "string" },
		"skip-build":{ type: "boolean", default: false },
		interactive: { type: "boolean", short: "i" },
		help:        { type: "boolean", short: "h" },
	} });

	if (values.help) {
		console.log([
			"",
			bold("Quiz Blocks 部署工具"),
			"",
			`  ${c("cyan", "用法：")} node scripts/deploy.mjs [選項]`,
			"",
			"  選項：",
			`    ${c("yellow", "--vault <path>")}      指定 Vault 路徑（略過互動精靈）`,
			`    ${c("yellow", "--skip-build")}        略過編譯，直接部署現有產物`,
			`    ${c("yellow", "--interactive, -i")}  強制進入互動精靈`,
			`    ${c("yellow", "--help, -h")}          顯示此說明`,
			"",
			"  Vault 解析順序：--vault > DEMO_VAULT > .quiz-blocks-dev.json",
			"",
		].join("\n"));
		process.exit(0);
	}

	let vaultPath = values.vault || process.env.DEMO_VAULT;
	if (!vaultPath && existsSync(configPath)) {
		vaultPath = JSON.parse(readFileSync(configPath, "utf8")).vaultPath;
	}
	let skipBuild = values["skip-build"];
	let save      = false;

	// Launch interactive wizard when: -i flag OR running in a TTY with no vault arg
	const isInteractive = values.interactive || (process.stdin.isTTY && process.argv.length === 2);
	if (isInteractive) {
		const selected = runPythonWizard();
		if (!selected) {
			console.log(`\n${dim("  已取消部署，未修改任何檔案。")}\n`);
			process.exit(0);
		}
		({ vaultPath, skipBuild, save } = selected);
		// Blank line to separate wizard output from build output
		console.log();
	}

	if (typeof vaultPath !== "string" || !vaultPath.trim()) {
		throw new Error("請使用 --vault、DEMO_VAULT 或 .quiz-blocks-dev.json 的 vaultPath 指定 Vault。");
	}
	const vault = normalize(vaultPath);
	if (!existsSync(vault) || !statSync(vault).isDirectory()) {
		throw new Error(`Vault 目錄不存在：${vault}`);
	}

	// ── Build ─────────────────────────────────────────────────────────────────
	if (!skipBuild) {
		const spin  = spinner("正在編譯 Quiz Blocks…");
		const build = spawnSync(
			process.execPath,
			[join(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "production"],
			{ cwd: root, stdio: ["inherit", "pipe", "pipe"] },
		);
		if (build.error) { spin.stop(false, "編譯時發生錯誤"); throw build.error; }
		if (build.status !== 0) {
			spin.stop(false, "編譯失敗");
			if (build.stderr) process.stderr.write(build.stderr);
			throw new Error("編譯失敗，未部署。請確認已安裝專案依賴（pnpm install）。");
		}
		spin.stop(true, "編譯完成");
	}

	// ── Copy files ────────────────────────────────────────────────────────────
	const files = ["main.js", "styles.css", "manifest.json"];
	for (const file of files) {
		if (!existsSync(join(root, file)) || !statSync(join(root, file)).isFile()) {
			throw new Error(`缺少 ${file}，請先執行 pnpm build。`);
		}
	}
	const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
	if (manifest.id !== "quiz-blocks") throw new Error("manifest.json 的插件 ID 必須是 quiz-blocks。");
	const target = join(vault, ".obsidian", "plugins", manifest.id);
	mkdirSync(target, { recursive: true });
	for (const file of files) copyFileSync(join(root, file), join(target, file));

	// ── Save config ───────────────────────────────────────────────────────────
	if (save) {
		try {
			const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
			writeFileSync(configPath, `${JSON.stringify({ ...config, vaultPath: vault }, null, 2)}\n`);
		} catch (err) {
			console.warn(c("yellow", `  ⚠ 部署成功，但無法儲存預設 Vault：${err.message}`));
		}
	}

	console.log(`\n${c("green", "  ✓")} ${bold("部署完成！")}`);
	console.log(`  ${dim("→")} ${target}`);
	console.log(`  ${dim("請在 Obsidian「設定 → 社群外掛」啟用 Quiz Blocks；")}`);
	console.log(`  ${dim("  若已啟用，關閉後重新開啟即可載入新版本。")}\n`);

} catch (error) {
	process.stdout.write(ansi.showCursor);
	console.error(`\n${c("red", "  ✗")} ${bold(error instanceof Error ? error.message : String(error))}\n`);
	process.exitCode = 1;
}
