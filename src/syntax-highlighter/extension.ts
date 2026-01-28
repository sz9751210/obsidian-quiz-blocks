import { yamlLanguage } from "./language";
import { Line, Range, Text } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	type PluginSpec,
	type PluginValue,
	ViewPlugin,
	type ViewUpdate
} from "@codemirror/view";
import { highlightTree } from "@lezer/highlight";
import { cmClassHighlighter } from "./highlight";

type Block = { open: Line; close: Line };
type Position = number;

/**
 * CodeMirror 6 view plugin for syntax highlighting.
 *
 * Finds ` ```quiz ` code blocks in the visible ranges, parses their YAML,
 * and highlights meaningful tokens using CodeMirror decorations.
 *
 * The parser is based on `@codemirror/lang-yaml` and `@lezer-parser/yaml`,
 * and includes additional literal tokens: `null`, `boolean`, and `number`.
 *
 * @link https://docs.obsidian.md/Plugins/Editor/Decorations#View+plugins
 */
class YamlSyntaxHighlighter implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = YamlSyntaxHighlighter.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = YamlSyntaxHighlighter.buildDecorations(update.view);
		}
	}

	destroy() {
		// empty
	}

	static isOpenFence(s: string): boolean {
		return s.trimEnd() === '```quiz';
	}

	static isCloseFence(s: string): boolean {
		return s.trimEnd() === '```';
	}

	static nextFencedBlock(doc: Text, startLine: Line, endLineNum: number): Block | null {
		let op = startLine;
		while (op.number <= endLineNum && !YamlSyntaxHighlighter.isOpenFence(op.text)) {
			if (op.number === endLineNum) return null;
			op = doc.line(op.number + 1);
		}

		// find closing fence
		let cl = op;
		while (cl.number < doc.lines && !YamlSyntaxHighlighter.isCloseFence(cl.text)) {
			cl = doc.line(cl.number + 1);
		}

		return { open: op, close: cl };
	}

	static buildDecorations(view: EditorView) {
		const doc = view.state.doc;
		const ranges: Range<Decoration>[] = [];
		let block: Block | null = null;

		for (const { from: fromPos, to: toPos } of view.visibleRanges) {
			let line = doc.lineAt(fromPos);
			const endLineNum = doc.lineAt(toPos).number;

			while (line.from <= toPos) {
				// carry the block that began earlier and extend into this visible range
				block ??= YamlSyntaxHighlighter.nextFencedBlock(doc, line, endLineNum);

				// no more fences from this line forward
				if (!block) break;

				// the next fence starts after this visible range; stop scanning
				if (toPos < block.open.from) break;

				YamlSyntaxHighlighter.collectYamlBlockDecorations(ranges, doc, block, fromPos, toPos);

				// block continues past this visible range (or hits EOF), keep it for the next range
				if (block.close.number > endLineNum || block.close.number >= doc.lines) break;

				// block ended inside this visible range; find the next block
				line = doc.line(block.close.number + 1);
				block = null;
			}

			// if the loop ended naturally but the block actually ended within this range,
			// clear it so the next visible range doesn't reuse a finished block
			if (block && block.close.number <= endLineNum) {
				block = null;
			}
		}

		return Decoration.set(ranges, true);
	}

	static collectYamlBlockDecorations(
		ranges: Range<Decoration>[],
		doc: Text,
		{ open, close }: Block,
		visibleFromPos: Position,
		visibleToPos: Position,
	) {
		const hasCloseFence = YamlSyntaxHighlighter.isCloseFence(close.text);
		const startLineNum = open.number + 1;
		const endLineNum = hasCloseFence ? close.number - 1 : close.number;
		if (startLineNum > endLineNum) return;

		const codeFrom: Position = doc.line(startLineNum).from;
		const codeTo: Position = hasCloseFence ? close.from : doc.line(close.number).to;
		const code = doc.sliceString(codeFrom, codeTo);
		const tree = yamlLanguage.parser.parse(code);

		highlightTree(tree, cmClassHighlighter, (a, b, classes) => {
			if (!classes) return;
			const from: Position = codeFrom + a;
			const to: Position = codeFrom + b;
			if (from >= visibleToPos || to <= visibleFromPos) return;
			ranges.push(Decoration.mark({ class: classes }).range(from, to));
		});
	}
}

const pluginSpec: PluginSpec<YamlSyntaxHighlighter> = {
	decorations: (value: YamlSyntaxHighlighter): DecorationSet => value.decorations,
};

export const yamlSyntaxHighlighter = ViewPlugin.fromClass(
	YamlSyntaxHighlighter,
	pluginSpec
);
