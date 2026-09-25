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
		writeFileSync(join(root, "scripts/deploy-ui.py"), `import os, sys\nresult = os.environ.get("QUIZ_DEPLOY_WIZARD")\nif not result: sys.exit(1)\nwith open(sys.argv[sys.argv.index("--output") + 1], "w") as output: output.write(result)\n`);
		const vault = join(root, "vault with spaces");
		const target = join(vault, ".obsidian/plugins/quiz-blocks");
		mkdirSync(target, { recursive: true });
		writeFileSync(join(target, "data.json"), "saved answers");
		writeFileSync(join(vault, "note.md"), "keep this note");
		const artifacts = { "main.js": "new plugin", "styles.css": "new styles", "manifest.json": '{"id":"quiz-blocks"}' };
		for (const [name, content] of Object.entries(artifacts)) writeFileSync(join(root, name), content);
		const run = (args, demoVault = "", wizard = "") => spawnSync(process.execPath, [join(root, "scripts/deploy.mjs"), ...args], {
			cwd: tmpdir(), env: { ...process.env, DEMO_VAULT: demoVault, QUIZ_DEPLOY_WIZARD: wizard }, encoding: "utf8",
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
		const interactive = run(["--interactive"], "", JSON.stringify({ vaultPath: vault, skipBuild: true, save: true }));
		assert.equal(interactive.status, 0, interactive.stderr);
		assert.equal(JSON.parse(readFileSync(join(root, ".quiz-blocks-dev.json"), "utf8")).vaultPath, vault);
		writeFileSync(join(root, "main.js"), "must not deploy");
		assert.equal(run(["--interactive"]).status, 0);
		assert.equal(readFileSync(join(target, "main.js"), "utf8"), "new plugin");
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
