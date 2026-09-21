import assert from "node:assert/strict";
import { test } from "node:test";
import { quizSources, matchesTag } from "../src/question-bank.ts";

const section = (start, end, type = "code") => ({
	type,
	position: { start: { line: start }, end: { line: end } },
});

test("tags match exact names and descendants, but not similar prefixes", () => {
	assert.ok(matchesTag(["#Study/history"], "#study"));
	assert.ok(matchesTag(["#study"], "#STUDY"));
	assert.equal(matchesTag(["#study-guide"], "#study"), false);
	assert.equal(matchesTag([], "#study"), false);
});

test("extracts actual quiz sections, preserving YAML and ignoring code examples", () => {
	const markdown = [
		"```quiz", "type: text", "content: First", "```",
		"````markdown", "```quiz", "type: text", "```", "````",
		"> ~~~quiz", "> type: text", "> content: Second", "> ~~~~",
		"```quiz", "type: prompt", "content: Unclosed",
	].join("\r\n");
	assert.deepEqual(quizSources(markdown, [section(0, 3), section(4, 8), section(9, 12), section(13, 15)]), [
		{ source: "type: text\ncontent: First", line: 0 },
		{ source: "type: text\ncontent: Second", line: 9 },
		{ source: "type: prompt\ncontent: Unclosed", line: 13 },
	]);
	assert.deepEqual(quizSources(markdown, []), []);
});
