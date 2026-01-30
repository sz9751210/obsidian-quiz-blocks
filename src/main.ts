import { Plugin } from "obsidian";
import { checkboxSnippet, choiceSnippet, noodleSnippet, promptSnippet, radioSnippet, textSnippet } from "./snippets";
import { renderQuiz } from "./renderer";
import { yamlSyntaxHighlighter } from "./syntax-highlighter/extension";

export default class QuizBlocksPlugin extends Plugin {
	onload() {
		this.registerEditorExtension(yamlSyntaxHighlighter);

		this.registerMarkdownCodeBlockProcessor("quiz", (source, el, ctx) => {
			renderQuiz({
				app: this.app,
				component: this,
				source,
				el,
				ctx,
			});
		});

		const snippets = [
			{ id: "quiz-block-insert-radio", name: "Insert radio", snippet: radioSnippet },
			{ id: "quiz-block-insert-checkbox", name: "Insert checkbox", snippet: checkboxSnippet },
			{ id: "quiz-block-insert-text", name: "Insert text", snippet: textSnippet },
			{ id: "quiz-block-insert-prompt", name: "Insert prompt", snippet: promptSnippet },
			{ id: "quiz-block-insert-choice", name: "Insert choice", snippet: choiceSnippet },
			{ id: "quiz-block-insert-noodle", name: "Insert noodle", snippet: noodleSnippet },
		];

		for (let { id, name, snippet } of snippets) {
			this.addCommand({
				id,
				name,
				editorCallback: editor => editor.replaceRange(snippet, editor.getCursor()),
			});
		}
	}
}

declare module "obsidian" {
	interface Vault {
		getConfig(key: string): unknown;
	}
}
