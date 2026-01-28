import { styleTags, tagHighlighter, tags as t } from "@lezer/highlight"

export const yamlHighlighting = styleTags({
	": , -": t.separator,
	"?": t.punctuation,
	"Anchor Alias": t.labelName,
	"DirectiveEnd DocEnd": t.meta,
	"Key/Literal Key/QuotedLiteral Key/BoolLiteral Key/NullLiteral Key/NumberLiteral": t.definition(t.propertyName),
	"[ ]": t.squareBracket,
	"{ }": t.brace,
	// Keys should still be highlighted as property names, even if they look like bool/null/number
	BlockLiteralContent: t.content,
	BlockLiteralHeader: t.special(t.string),
	BoolLiteral: t.bool,
	Comment: t.lineComment,
	DirectiveContent: t.attributeValue,
	DirectiveName: t.keyword,
	Literal: t.content,
	NullLiteral: t.null,
	NumberLiteral: t.number,
	QuotedLiteral: t.string,
	Tag: t.typeName,
});

export const cmClassHighlighter = tagHighlighter([
	{ tag: t.punctuation, class: "cm-punctuation" },
	{ tag: t.meta, class: "cm-meta" },
	{ tag: t.propertyName, class: "cm-property" },
	{ tag: t.definition(t.propertyName), class: "cm-property" },
	{ tag: t.string, class: "cm-string" },
	{ tag: t.special(t.string), class: "cm-string-2" },
	{ tag: t.bool, class: "cm-keyword" },
	{ tag: t.comment, class: "cm-comment" },
	{ tag: t.keyword, class: "cm-keyword" },
	{ tag: t.literal, class: "cm-keyword" },
	{ tag: t.null, class: "cm-keyword" },
	{ tag: t.number, class: "cm-number" },
	{ tag: t.tagName, class: "cm-tag" },
]);
