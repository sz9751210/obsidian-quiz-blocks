import { parse } from "yaml";
import { type Quiz, QuizSchema } from "./schemas";

export function parseQuizBlock(source: string, tabSize: number): Quiz {
	// Tabs are convenient to type, but YAML doesn’t permit them for indentation.
	const raw = replaceLeadingTabsWithSpaces(source.trim(), tabSize);
	if (!raw) throw new Error("Empty quiz block.");

	let parsed: unknown;
	try {
		parsed = parse(raw, { schema: 'core', logLevel: 'error', stringKeys: true });
	} catch (e) {
		throw new Error(`Failed to parse quiz block as YAML.\n${String(e)}`);
	}

	return QuizSchema.parse(parsed);
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
