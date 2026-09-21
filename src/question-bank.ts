import type { SectionCache } from "obsidian";

export function matchesTag(tags: string[], selected: string): boolean {
	const target = selected.toLowerCase();
	return tags.some(tag => tag.toLowerCase() === target || tag.toLowerCase().startsWith(`${target}/`));
}

// Use Obsidian's parsed sections so examples inside other fences are not questions.
export function quizSources(markdown: string, sections: SectionCache[]): { source: string; line: number }[] {
	const lines = markdown.split(/\r?\n/);
	return sections.filter(section => section.type === "code").flatMap(section => {
		const start = section.position.start.line;
		const opening = lines[start]?.match(/^([\s>]*)(`{3,}|~{3,})quiz\s*$/);
		if (!opening) return [];
		const prefix = opening[1]!;
		const fence = opening[2]!;
		const body = lines.slice(start + 1, section.position.end.line + 1)
			.map(line => line.startsWith(prefix) ? line.slice(prefix.length) : line);
		const closing = body[body.length - 1]?.trim();
		if (closing && closing.length >= fence.length && [...closing].every(char => char === fence[0])) body.pop();
		return [{ source: body.join("\n"), line: start }];
	});
}
