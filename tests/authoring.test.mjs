import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { DEFAULT_SETTINGS, QUIZ_TEMPLATES, matchingTemplates, quizFenceTrigger, readSettings, shortcutQuery, templateSnippet, templateSource } = await jiti.import("../src/snippets.ts");
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

test("rejects quiz answers that the controls cannot grade correctly", () => {
	const optionQuiz = (type, correctFlags) => `type: ${type}\noptions:\n${correctFlags.map((correct, i) => `  - content: Option ${i + 1}\n    correct: ${correct}`).join("\n")}`;
	assert.throws(() => parseQuizBlock(optionQuiz("radio", [false, false]), 4), /exactly one correct option/);
	assert.throws(() => parseQuizBlock(optionQuiz("radio", [true, true]), 4), /exactly one correct option/);
	assert.throws(() => parseQuizBlock(optionQuiz("checkbox", [false, false]), 4), /at least one correct option/);
	assert.doesNotThrow(() => parseQuizBlock(optionQuiz("checkbox", [true, true]), 4));

	const pairs = (type, options, answers) => `type: ${type}\noptions:\n${options.map(id => `  - id: ${id}\n    content: ${id}`).join("\n")}\nquestions:\n${answers.map((id, i) => `  - content: Question ${i + 1}\n    correct_option: ${id}`).join("\n")}`;
	assert.throws(() => parseQuizBlock(pairs("noodle", ["a", "b"], ["a", "a"]), 4), /answer to more than one question/);
	assert.throws(() => parseQuizBlock(pairs("noodle", ["a"], ["a", "a"]), 4), /at least as many options as questions/);
	const collidingId = pairs("noodle", ["a", "b"], ["a", "b"]).replace("  - content: Question 2", "  - id: q-0\n    content: Question 2");
	assert.throws(() => parseQuizBlock(collidingId, 4), /Duplicate noodle question id/);
	assert.doesNotThrow(() => parseQuizBlock(pairs("choice", ["a"], ["a", "a"]), 4));
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

test("quiz fences offer templates only at a top-level opening fence", () => {
	assert.deepEqual(quizFenceTrigger("```quiz", 7, []), { indent: "", fence: "```", query: "" });
	assert.deepEqual(quizFenceTrigger("   ~~~quiz:ra", 13, []), { indent: "   ", fence: "~~~", query: "ra" });
	assert.equal(quizFenceTrigger("```quiz extra", 7, []), null);
	assert.equal(quizFenceTrigger("``quiz", 6, []), null);
	assert.equal(quizFenceTrigger("```quiz", 7, ["```markdown"]), null);
	assert.equal(quizFenceTrigger("```quiz", 7, ["---", "title: Test"]), null);
	assert.deepEqual(quizFenceTrigger("```quiz", 7, ["---", "title: Test", "---"]), { indent: "", fence: "```", query: "" });
});

test("saved preferences retain supported values and reject malformed settings", () => {
	assert.deepEqual(readSettings(null), DEFAULT_SETTINGS);
	assert.deepEqual(readSettings({ style: "unknown", shuffle: "false", gated: 1, quickSyntax: "yes" }), DEFAULT_SETTINGS);
	const preferences = { style: "compact", shuffle: true, gated: true, quickSyntax: false };
	assert.deepEqual(readSettings(preferences), preferences);
});
