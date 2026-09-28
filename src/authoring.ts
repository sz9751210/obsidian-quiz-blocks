import { EditorSuggest, FuzzySuggestModal, type App, type Editor, type EditorPosition, type EditorSuggestContext } from "obsidian";
import { matchingTemplates, QUIZ_TEMPLATES, quizFenceTrigger, shortcutQuery, templateSnippet, templateSource, type QuizSettings, type QuizTemplate } from "./snippets";

export function insertTemplate(editor: Editor, template: QuizTemplate, settings: QuizSettings,
	from = editor.getCursor("from"), to = editor.getCursor("to")) {
	const prefix = from.ch > 0 ? "\n" : "";
	const suffix = editor.getLine(to.line).length > to.ch ? "\n" : "";
	editor.replaceRange(prefix + templateSnippet(template, settings) + suffix, from, to);
	const line = from.line + (prefix ? 3 : 2);
	editor.setSelection({ line, ch: "content: ".length }, { line, ch: editor.getLine(line).length });
	editor.focus();
}

function insertFencedTemplate(editor: Editor, template: QuizTemplate, settings: QuizSettings,
	from: EditorPosition, to: EditorPosition, fence: string, indent: string) {
	const source = [
		`${indent}${fence}quiz`,
		...templateSource(template, settings).split("\n").map(line => `${indent}${line}`),
		`${indent}${fence}`,
	].join("\n");
	editor.replaceRange(source, from, to);
	const contentLine = from.line + 2;
	const contentPrefix = `${indent}content: `;
	editor.setSelection({ line: contentLine, ch: contentPrefix.length }, { line: contentLine, ch: editor.getLine(contentLine).length });
	editor.focus();
}

export class TemplatePicker extends FuzzySuggestModal<QuizTemplate> {
	constructor(app: App, private editor: Editor, private settings: QuizSettings) {
		super(app);
		this.setPlaceholder("選擇題型範本");
	}
	getItems() { return [...QUIZ_TEMPLATES]; }
	getItemText(template: QuizTemplate) { return `${template.name} · quiz:${template.type} · ${template.description}`; }
	onChooseItem(template: QuizTemplate) { insertTemplate(this.editor, template, this.settings); }
}

export class QuizTemplateSuggest extends EditorSuggest<QuizTemplate> {
	constructor(app: App, private getSettings: () => QuizSettings) {
		super(app);
		this.setInstructions([{ command: "↑↓", purpose: "選擇題型" }, { command: "↵", purpose: "插入範本" }, { command: "esc", purpose: "取消" }]);
	}
	onTrigger(cursor: EditorPosition, editor: Editor) {
		if (!this.getSettings().quickSyntax || editor.getSelection()) return null;
		const line = editor.getLine(cursor.line);
		function* precedingLines() {
			for (let i = 0; i < cursor.line; i++) yield editor.getLine(i);
		}
		const fence = quizFenceTrigger(line, cursor.ch, precedingLines());
		if (fence) return { start: { line: cursor.line, ch: 0 }, end: { line: cursor.line, ch: line.length }, query: `fence:${fence.query}` };
		if (!/^quiz:/i.test(line)) return null;
		const query = shortcutQuery(line, cursor.ch, precedingLines());
		return query === null ? null : { start: { line: cursor.line, ch: 0 }, end: { line: cursor.line, ch: line.length }, query };
	}
	getSuggestions(context: EditorSuggestContext) { return matchingTemplates(context.query.replace(/^fence:/, "")); }
	renderSuggestion(template: QuizTemplate, el: HTMLElement) {
		el.createDiv({ text: `${template.name} · quiz:${template.type}` });
		el.createDiv({ cls: "suggestion-note", text: template.description });
	}
	selectSuggestion(template: QuizTemplate) {
		if (!this.context) return;
		const { editor, start, end } = this.context;
		const line = editor.getLine(start.line);
		const fence = quizFenceTrigger(line, end.ch, Array.from({ length: start.line }, (_, i) => editor.getLine(i)));
		if (fence) {
			insertFencedTemplate(editor, template, this.getSettings(), start, end, fence.fence, fence.indent);
			this.close();
			return;
		}
		insertTemplate(editor, template, this.getSettings(), start, end);
		this.close();
	}
}
