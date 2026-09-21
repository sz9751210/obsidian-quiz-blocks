import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import process from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, ".quiz-blocks-dev.json");
const normalize = value => resolve(root, value === "~" ? homedir() : value.startsWith("~/") ? join(homedir(), value.slice(2)) : value);
const isDirectory = value => {
	try { return statSync(value).isDirectory(); } catch { return false; }
};

async function chooseDeployment(preferred, skipBuild) {
	const candidates = new Set();
	if (typeof preferred === "string" && preferred.trim()) candidates.add(normalize(preferred));
	const appData = process.platform === "darwin" ? join(homedir(), "Library/Application Support")
		: process.platform === "win32" ? process.env.APPDATA
			: process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	if (appData) {
		const registry = join(appData, "obsidian/obsidian.json");
		if (existsSync(registry)) {
			try {
				for (const entry of Object.values(JSON.parse(readFileSync(registry, "utf8")).vaults ?? {})) {
					if (typeof entry?.path === "string" && isDirectory(entry.path)) candidates.add(normalize(entry.path));
				}
			} catch { console.log("無法讀取 Obsidian 的 Vault 清單，仍可手動輸入路徑。"); }
		}
	}
	const vaults = [...candidates];
	console.log("\nQuiz blocks 互動部署\n");
	vaults.forEach((vault, index) => console.log(`  ${index + 1}. ${vault}${vault === normalize(preferred || "") ? "（目前設定）" : ""}`));
	console.log("  0. 手動輸入 Vault 路徑\n  q. 取消\n");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answers = rl[Symbol.asyncIterator]();
	rl.on("SIGINT", () => rl.close());
	const ask = async prompt => {
		process.stdout.write(prompt);
		const answer = await answers.next();
		return answer.done ? null : answer.value.trim();
	};
	try {
		let vault;
		while (!vault) {
			const choice = await ask(`選擇 Vault [${vaults.length ? "1" : "0"}]：`);
			if (choice === null || choice.toLowerCase() === "q") return null;
			const selected = choice || (vaults.length ? "1" : "0");
			let path;
			if (selected === "0") {
				path = await ask("Vault 路徑（可用 ~/，輸入 q 取消）：");
				if (path === null || path.toLowerCase() === "q") return null;
				path = path.replace(/^(["'])(.*)\1$/, "$2");
			} else if (/^\d+$/.test(selected)) path = vaults[Number(selected) - 1];
			if (!path || !isDirectory(normalize(path))) {
				console.log("路徑不存在或選項無效，請重新選擇。");
				continue;
			}
			vault = normalize(path);
		}
		let mode;
		while (!mode) {
			const answer = await ask(`部署方式：1. 重新編譯（建議）  2. 使用現有產物 [${skipBuild ? "2" : "1"}]：`);
			if (answer === null || answer.toLowerCase() === "q") return null;
			mode = answer || (skipBuild ? "2" : "1");
			if (mode !== "1" && mode !== "2") { console.log("請輸入 1 或 2。"); mode = undefined; }
		}
		const save = await ask("成功後記住這個 Vault？[y/N]：");
		if (save === null || save.toLowerCase() === "q") return null;
		console.log(`\n目標：${join(vault, ".obsidian/plugins/quiz-blocks")}\n方式：${mode === "1" ? "重新編譯" : "使用現有產物"}\n更新 main.js、styles.css、manifest.json，保留設定與筆記。`);
		const confirm = await ask("開始部署？[y/N]：");
		if (!/^y(es)?$/i.test(confirm ?? "")) return null;
		return { vaultPath: vault, skipBuild: mode === "2", save: /^y(es)?$/i.test(save) };
	} finally { rl.close(); }
}

try {
	const { values } = parseArgs({ options: {
		vault: { type: "string" },
		"skip-build": { type: "boolean", default: false },
		interactive: { type: "boolean", short: "i" },
		help: { type: "boolean", short: "h" },
	} });
	if (values.help) {
		console.log("Usage: npm run deploy -- [--interactive] [--vault /path/to/vault] [--skip-build]\nRun without arguments in a terminal for the interactive wizard.\nVault: --vault > DEMO_VAULT > .quiz-blocks-dev.json (vaultPath).\nRelative paths resolve from the project directory.");
	} else {
		let vaultPath = values.vault || process.env.DEMO_VAULT;
		if (!vaultPath && existsSync(configPath)) {
			vaultPath = JSON.parse(readFileSync(configPath, "utf8")).vaultPath;
		}
		let skipBuild = values["skip-build"];
		let save = false;
		if (values.interactive || (process.stdin.isTTY && process.argv.length === 2)) {
			const selected = await chooseDeployment(vaultPath, skipBuild);
			if (!selected) { console.log("已取消部署，未修改檔案。"); process.exit(0); }
			({ vaultPath, skipBuild, save } = selected);
		}
		if (typeof vaultPath !== "string" || !vaultPath.trim()) {
			throw new Error("請使用 --vault、DEMO_VAULT 或 .quiz-blocks-dev.json 的 vaultPath 指定 Vault。");
		}
		const vault = normalize(vaultPath);
		if (!existsSync(vault) || !statSync(vault).isDirectory()) {
			throw new Error(`Vault 目錄不存在：${vault}`);
		}
		if (!skipBuild) {
			console.log("正在編譯 Quiz blocks…");
			// Run the existing Vite build directly; no extra package manager is required.
			const build = spawnSync(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "build", "--mode", "production"], {
				cwd: root, stdio: "inherit",
			});
			if (build.error) throw build.error;
			if (build.status !== 0) throw new Error("編譯失敗，未部署。請確認已安裝專案依賴。");
		}
		const files = ["main.js", "styles.css", "manifest.json"];
		for (const file of files) {
			if (!existsSync(join(root, file)) || !statSync(join(root, file)).isFile()) {
				throw new Error(`缺少 ${file}，請先執行 npm run build。`);
			}
		}
		const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
		if (manifest.id !== "quiz-blocks") throw new Error("manifest.json 的插件 ID 必須是 quiz-blocks。");
		const target = join(vault, ".obsidian", "plugins", manifest.id);
		mkdirSync(target, { recursive: true });
		for (const file of files) copyFileSync(join(root, file), join(target, file));
		if (save) {
			try {
				const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
				writeFileSync(configPath, `${JSON.stringify({ ...config, vaultPath: vault }, null, 2)}\n`);
			} catch (error) { console.warn(`部署成功，但無法儲存預設 Vault：${error.message}`); }
		}
		console.log(`部署完成：${target}\n請在 Obsidian「設定 → 社群外掛」啟用 Quiz blocks；若已啟用，關閉後重新開啟即可載入新版。`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
