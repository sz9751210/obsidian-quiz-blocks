import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";
import { DEFAULT_SETTINGS, QUIZ_TEMPLATES, matchingTemplates, readSettings, shortcutQuery, templateSnippet, templateSource } from "../src/snippets.ts";

const jiti = createJiti(import.meta.url);
const { parseQuizBlock } = await jiti.import("../src/parse.ts");

test("all six templates parse with all combinations of insertion defaults", () => {
	assert.equal(QUIZ_TEMPLATES.length, 6);
	for (const template of QUIZ_TEMPLATES) {
		for (const shuffle of [false, true]) for (const gated of [false, true]) {
			const settings = { ...DEFAULT_SETTINGS, shuffle, gated };
			const quiz = parseQuizBlock(templateSource(template, settings), 4);
			assert.equal(quiz.type, template.type);
			assert.equal(quiz.shuffle, shuffle);
			assert.equal(quiz.gated, gated);
			assert.ok(quiz.content.length);
			assert.equal(templateSnippet(template, settings), `\`\`\`quiz\n${templateSource(template, settings)}\n\`\`\``);
		}
	}
});

test("quick syntax recognizes radio and ratio without changing ordinary text or code", () => {
	assert.equal(matchingTemplates("").length, 6);
	for (const query of ["ra", "rad", "radio", "rat", "ratio", "RATIO"]) {
		assert.deepEqual(matchingTemplates(query).map(template => template.type), ["radio"]);
	}
	assert.deepEqual(matchingTemplates("unknown"), []);
	assert.equal(shortcutQuery("quiz:", 5, []), "");
	assert.equal(shortcutQuery("quiz:radio", 10, ["Some text"]), "radio");
	assert.equal(shortcutQuery("quiz:radio trailing text", 10, []), null);
	assert.equal(shortcutQuery("example quiz:radio", 18, []), null);
	assert.equal(shortcutQuery("    quiz:radio", 14, []), null);
	for (const fence of ["```", "~~~", "````"]) {
		assert.equal(shortcutQuery("quiz:radio", 10, [`${fence}yaml`]), null);
		assert.equal(shortcutQuery("quiz:radio", 10, [`${fence}yaml`, fence]), "radio");
	}
	assert.equal(shortcutQuery("quiz:radio", 10, ["````markdown", "```"]), null);
	assert.equal(shortcutQuery("quiz:radio", 10, ["---", "title: Test"]), null);
	assert.equal(shortcutQuery("quiz:radio", 10, ["---", "title: Test", "---"]), "radio");
});

test("saved preferences retain supported values and reject malformed settings", () => {
	assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings({ style: "unknown", shuffle: "false", gated: 1, quickSyntax: "yes" }), DEFAULT_SETTINGS);
	const preferences = { style: "compact", shuffle: true, gated: true, quickSyntax: false };
	assert.deepEqual(readSettings(preferences), preferences);
});
