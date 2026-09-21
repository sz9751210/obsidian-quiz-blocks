import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import process from "node:process";
import { join } from "node:path";
import { test } from "node:test";

test("deploy respects target precedence, preserves data, and stops on invalid inputs or build failure", () => {
	const root = mkdtempSync(join(tmpdir(), "quiz-deploy-"));
	try {
		mkdirSync(join(root, "scripts"));
		copyFileSync(new URL("../scripts/deploy.mjs", import.meta.url), join(root, "scripts/deploy.mjs"));
		const vault = join(root, "vault with spaces");
		const target = join(vault, ".obsidian/plugins/quiz-blocks");
		mkdirSync(target, { recursive: true });
		writeFileSync(join(target, "data.json"), "saved answers");
		writeFileSync(join(vault, "note.md"), "keep this note");
		const artifacts = { "main.js": "new plugin", "styles.css": "new styles", "manifest.json": '{"id":"quiz-blocks"}' };
		for (const [name, content] of Object.entries(artifacts)) writeFileSync(join(root, name), content);
		const run = (args, demoVault = "", input = "") => spawnSync(process.execPath, [join(root, "scripts/deploy.mjs"), ...args], {
			cwd: tmpdir(), env: { ...process.env, DEMO_VAULT: demoVault }, encoding: "utf8", input,
		});
		assert.equal(run(["--help"]).status, 0);
		assert.equal(run(["--skip-build"]).status, 1);
		writeFileSync(join(root, ".quiz-blocks-dev.json"), JSON.stringify({ vaultPath: "vault with spaces" }));
		assert.equal(run(["--skip-build"]).status, 0);
		assert.equal(run(["--skip-build"], join(root, "missing")).status, 1);
		assert.equal(run(["--vault", vault, "--skip-build"], join(root, "missing")).status, 0);
		assert.equal(run(["--skip-build"], vault).status, 0);
		for (const [name, content] of Object.entries(artifacts)) assert.equal(readFileSync(join(target, name), "utf8"), content);
		assert.equal(readFileSync(join(target, "data.json"), "utf8"), "saved answers");
		assert.equal(readFileSync(join(vault, "note.md"), "utf8"), "keep this note");
		const interactive = run(["--interactive"], "", `invalid\n0\n"${vault}"\ninvalid\n2\ny\ny\n`);
		assert.equal(interactive.status, 0, interactive.stderr);
		assert.match(interactive.stdout, /部署完成/);
		assert.equal(JSON.parse(readFileSync(join(root, ".quiz-blocks-dev.json"), "utf8")).vaultPath, vault);
		const beforeCancel = readFileSync(join(root, ".quiz-blocks-dev.json"), "utf8");
		writeFileSync(join(root, "main.js"), "must not deploy");
		const cancelled = run(["--interactive"], "", "1\n2\ny\nn\n");
		assert.equal(cancelled.status, 0);
		assert.match(cancelled.stdout, /已取消部署/);
		assert.equal(readFileSync(join(root, ".quiz-blocks-dev.json"), "utf8"), beforeCancel);
		assert.equal(readFileSync(join(target, "main.js"), "utf8"), "new plugin");
		assert.match(run(["--interactive"], "", "q\n").stdout, /已取消部署/);
		assert.match(run(["--interactive"], "", "").stdout, /已取消部署/);

		writeFileSync(join(root, "main.js"), "must not deploy");
		assert.equal(run(["--vault", vault]).status, 1); // No Vite in fixture: build fails.
		assert.equal(readFileSync(join(target, "main.js"), "utf8"), "new plugin");
		rmSync(join(root, "styles.css"));
		assert.equal(run(["--skip-build"]).status, 1);
		assert.equal(readFileSync(join(target, "main.js"), "utf8"), "new plugin");
		assert.equal(existsSync(join(root, "missing")), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
