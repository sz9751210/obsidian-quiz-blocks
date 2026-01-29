import { LineCounter, parse, YAMLError } from "yaml";
import { type ZodError } from "zod";
import { type Quiz, QUIZ_TYPES, QuizSchema } from "./schemas";

export function parseQuizBlock(source: string, tabSize: number): Quiz {
	// Tabs are convenient to type, but YAML doesn’t permit them for indentation.
	const raw = replaceLeadingTabsWithSpaces(source.trim(), tabSize);
	if (!raw) throw new Error("Empty quiz block.");

	let parsed: unknown;
	try {
		const lineCounter = new LineCounter();
		parsed = parse(raw, { schema: 'core', logLevel: 'error', stringKeys: true, lineCounter });
	} catch (e) {
		throw new Error(formatYamlParseError(e));
	}

	const result = QuizSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(formatQuizSchemaError(result.error, parsed, source.trimEnd()));
	}
	return result.data;
}

function replaceLeadingTabsWithSpaces(source: string, tabSize: number): string {
	return source.replace(/^[ \t]+/gm, (prefix) => {
		let width = 0;
		for (const char of prefix) {
			// tabs advance to the next tab stop; preceding spaces change where the tab lands
			width += char === "\t" ? tabSize - (width % tabSize) : 1;
		}
		return " ".repeat(width)
	});
}

type ZodIssue = ZodError['issues'][0];

function formatYamlParseError(error: unknown): string {
	if (error instanceof YAMLError) {
		const message = formatFriendlyYamlMessage(error);
		return message ?? error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function formatFriendlyYamlMessage(error: YAMLError): string | null {
	const snippet = extractYamlSnippet(error.message);
	switch (error.code) {
		case "BLOCK_AS_IMPLICIT_KEY": {
			const hint = 'Indentation looks off. Align keys like "type:" and "options:" at the same level.';
			return snippet ? `${hint}\n${snippet}` : hint;
		}
		case "TAB_AS_INDENT": {
			const hint = "Tabs are not allowed for indentation. Replace tabs with spaces.";
			return snippet ? `${hint}\n${snippet}` : hint;
		}
		default:
			return null;
	}
}

function extractYamlSnippet(message: string): string | null {
	const parts = message.split("\n\n");
	if (parts.length < 2) return null;
	return parts.slice(1).join("\n\n");
}

function formatQuizSchemaError(error: ZodError, parsed: unknown, source: string): string {
	const invalidTypeIssue = error.issues.find((issue) =>
		issue.code === "invalid_union" &&
		"discriminator" in issue &&
		issue.discriminator === "type"
	);

	if (invalidTypeIssue) {
		return appendSource(formatTypeError(parsed), source);
	}

	const lines = error.issues.map((issue) => `- ${formatIssue(issue, parsed)}`);
	return appendSource(lines.join("\n"), source);
}

function formatTypeError(parsed: unknown): string {
	const types = QUIZ_TYPES.join(", ");

	if (!isPlainObject(parsed)) {
		return `Expected a YAML object with a "type" field.\nValid types: ${types}.`;
	}

	const rawType = parsed.type;
	if (rawType === undefined) {
		return `Missing required field: type.\nValid types: ${types}.`;
	}

	if (typeof rawType !== "string") {
		return `"type" must be a string.\nValid types: ${types}.`;
	}

	if (!isQuizType(rawType)) {
		return `Unknown quiz type: ${JSON.stringify(rawType)}.\nValid types: ${types}.`;
	}

	return `Invalid definition for type: ${JSON.stringify(rawType)}.`;
}

function formatIssue(issue: ZodIssue, parsed: unknown): string {
	const path = formatPath(issue.path);
	const pathValue = path ? getPathValue(parsed, issue.path) : undefined;

	if (issue.code === "unrecognized_keys" && "keys" in issue) {
		const keys = issue.keys.join(", ");
		return path
			? `${path}: Unknown field${issue.keys.length === 1 ? "" : "s"}: ${keys}.`
			: `Unknown field${issue.keys.length === 1 ? "" : "s"}: ${keys}.`;
	}

	if (issue.code === "invalid_type") {
		if (path && pathValue === undefined) {
			return path ? `Missing required field: ${path}.` : "Missing required value.";
		}
		if (path && "expected" in issue && issue.expected === "array") {
			return `${path} must be a list.`;
		}
		if (path && "expected" in issue && issue.expected === "string") {
			return `${path} must be text.`;
		}
		if (path && "expected" in issue && issue.expected === "boolean") {
			return `${path} must be true or false.`;
		}
	}

	if (issue.code === "too_small" && "origin" in issue && issue.origin === "string" && issue.minimum === 1) {
		return path ? `${path} must not be empty.` : "Value must not be empty.";
	}

	if (
		issue.code === "too_small" &&
		issue.minimum >= 1 &&
		(("origin" in issue && issue.origin === "array") || ("type" in issue && issue.type === "array"))
	) {
		const count = issue.minimum;
		const suffix = count === 1 ? "" : "s";
		return path ? `${path} must have at least ${count} item${suffix}.` : `Must have at least ${count} item${suffix}.`;
	}

	return path ? `${path}: ${issue.message}` : issue.message;
}

function formatPath(path: PropertyKey[]): string {
	if (!path.length) return "";
	let formatted = "";
	for (const segment of path) {
		if (typeof segment === "number") {
			formatted += `[${segment}]`;
		} else {
			formatted += (formatted ? '.' : '') + String(segment);
		}
	}
	return formatted;
}

function getPathValue(root: unknown, path: PropertyKey[]): unknown {
	let current: unknown = root;
	for (const segment of path) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
		current = (current as Record<PropertyKey, unknown>)[segment];
	}
	return current;
}

function appendSource(message: string, source: string): string {
	if (!source) return message;
	return `${message}\n\n${source}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuizType(value: string): value is (typeof QUIZ_TYPES)[number] {
	return (QUIZ_TYPES as readonly string[]).includes(value);
}
