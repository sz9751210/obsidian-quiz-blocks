export const QUIZ_TEMPLATES = [
	{ type: "radio", name: "單選題", description: "選擇一個正確答案", source: `type: radio
content: 台灣的首都是哪裡？
options:
  - content: 台北
    correct: true
  - content: 台南
  - content: 高雄` },
	{ type: "checkbox", name: "多選題", description: "選擇所有正確答案", source: `type: checkbox
content: 下列哪些是質數？
options:
  - content: "2"
    correct: true
  - content: "3"
    correct: true
  - content: "4"` },
	{ type: "text", name: "簡答題", description: "輸入答案後查看參考解答", source: `type: text
content: 水的化學式是什麼？
correct: H₂O
feedback: 一個水分子由兩個氫原子與一個氧原子組成。` },
	{ type: "prompt", name: "填空題", description: "用 ==答案== 標記要隱藏的內容", source: `type: prompt
content: 水的化學式是 ==H₂O==，標準大氣壓下的冰點是 ==0°C==。
feedback: 按下 Check 查看答案。` },
	{ type: "choice", name: "下拉配對題", description: "為每個項目選擇對應答案", source: `type: choice
content: 為各國選擇首都。
options:
  - id: tokyo
    content: 東京
  - id: paris
    content: 巴黎
questions:
  - content: 日本
    correct_option: tokyo
  - content: 法國
    correct_option: paris` },
	{ type: "noodle", name: "連線配對題", description: "連接左右兩側的對應項目", source: `type: noodle
content: 將國家與首都連起來。
options:
  - id: tokyo
    content: 東京
  - id: paris
    content: 巴黎
questions:
  - content: 日本
    correct_option: tokyo
  - content: 法國
    correct_option: paris` },
] as const;

export type QuizTemplate = typeof QUIZ_TEMPLATES[number];
export type QuizSettings = {
	quickSyntax: boolean;
	style: "default" | "card" | "compact";
	shuffle: boolean;
	gated: boolean;
};

export const DEFAULT_SETTINGS: QuizSettings = { quickSyntax: true, style: "default", shuffle: false, gated: false };

export function readSettings(data: unknown): QuizSettings {
	const saved = data && typeof data === "object" ? data as Partial<QuizSettings> : {};
	return {
		quickSyntax: typeof saved.quickSyntax === "boolean" ? saved.quickSyntax : true,
		style: saved.style === "card" || saved.style === "compact" ? saved.style : "default",
		shuffle: saved.shuffle === true,
		gated: saved.gated === true,
	};
}

export function templateSource(template: QuizTemplate, settings = DEFAULT_SETTINGS): string {
	return [template.source, ...(settings.shuffle ? ["shuffle: true"] : []), ...(settings.gated ? ["gated: true"] : [])].join("\n");
}

export function templateSnippet(template: QuizTemplate, settings = DEFAULT_SETTINGS): string {
	return `\`\`\`quiz\n${templateSource(template, settings)}\n\`\`\``;
}

export function matchingTemplates(query: string): QuizTemplate[] {
	const normalized = query.toLowerCase();
	return QUIZ_TEMPLATES.filter(template => template.type.startsWith(normalized)
		|| (template.type === "radio" && "ratio".startsWith(normalized)));
}

// A shortcut occupies its own top-level line; leave YAML and code examples alone.
export function shortcutQuery(line: string, ch: number, precedingLines: Iterable<string>): string | null {
	const match = /^quiz:([a-z]*)$/i.exec(line.slice(0, ch));
	if (!match || line.slice(ch).trim()) return null;
	let fence = "";
	let frontmatter = false;
	let first = true;
	for (const previous of precedingLines) {
		if (first && previous.trim() === "---") { frontmatter = true; first = false; continue; }
		first = false;
		if (frontmatter) {
			if (/^(---|\.\.\.)\s*$/.test(previous)) frontmatter = false;
			continue;
		}
		if (fence) {
			const closing = previous.trim();
			if (closing.length >= fence.length && [...closing].every(char => char === fence[0])) fence = "";
		} else {
			fence = /^ {0,3}(`{3,}|~{3,})/.exec(previous)?.[1] ?? "";
		}
	}
	return fence || frontmatter ? null : match[1]!;
}
