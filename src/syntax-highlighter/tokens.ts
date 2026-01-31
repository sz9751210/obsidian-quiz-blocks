import { ContextTracker, ExternalTokenizer, type InputStream, type Stack as LrStack } from "@lezer/lr"
import {
	Alias,
	Anchor,
	blockEnd,
	BlockLiteralContent,
	BlockLiteralHeader,
	BoolLiteral,
	BraceL,
	BracketL,
	Colon,
	DirectiveEnd,
	DocEnd,
	eof,
	explicitMapContinueMark,
	explicitMapStartMark,
	flowMapMark,
	FlowMapping,
	FlowSequence,
	Literal,
	mapContinueMark,
	mapStartMark,
	NullLiteral,
	NumberLiteral,
	QuotedLiteral,
	sequenceContinueMark,
	sequenceStartMark,
	Tag
} from "./parser.terms.js"

type char = number;

enum Type {
	// Top document level
	Top = 0,
	// Block sequence
	Seq = 1,
	// Block mapping
	Map = 2,
	// Inside flow content
	Flow = 3,
	// Block literal with explicit indentation
	Lit = 4,
}

class Context {
	hash: number;

	constructor(public parent: Context, public depth: number, public type: Type) {
		this.hash = (parent ? parent.hash + parent.hash << 8 : 0) + depth + (depth << 4) + type
	}

	static top: Context = new Context(null!, -1, Type.Top);
}

type Stack<C> = Omit<LrStack, 'context'> & {
	readonly context: C;
}

function findColumn(input: InputStream, pos: number): number {
	for (let col = 0, p = pos - input.pos - 1; ; p--, col++) {
		let ch = input.peek(p)
		if (isBreakSpace(ch) || ch === -1) return col
	}
}

function isNonBreakSpace(ch: char): boolean {
	return ch === 32 || ch === 9
}

function isBreakSpace(ch: char): boolean {
	return ch === 10 || ch === 13
}

function isSpace(ch: char): boolean {
	return isNonBreakSpace(ch) || isBreakSpace(ch)
}

function isSep(ch: char): boolean {
	return ch < 0 || isSpace(ch)
}

export const indentation = new ContextTracker<Context>({
	start: Context.top,
	reduce(context, term) {
		return context.type === Type.Flow && (term === FlowSequence || term === FlowMapping) ? context.parent : context
	},
	shift(context, term, stack: Stack<Context>, input: InputStream) {
		if (term === sequenceStartMark)
			return new Context(context, findColumn(input, input.pos), Type.Seq)
		if (term === mapStartMark || term === explicitMapStartMark)
			return new Context(context, findColumn(input, input.pos), Type.Map)
		if (term === blockEnd)
			return context.parent
		if (term === BracketL || term === BraceL)
			return new Context(context, 0, Type.Flow)
		if (term === BlockLiteralContent && context.type === Type.Lit)
			return context.parent
		if (term === BlockLiteralHeader) {
			let indent = /[1-9]/.exec(input.read(input.pos, stack.pos))
			if (indent) return new Context(context, context.depth + (+indent[0]), Type.Lit)
		}
		return context
	},
	hash(context) {
		return context.hash
	}
})

function three(input: InputStream, ch: char, off = 0): boolean {
	return input.peek(off) === ch && input.peek(off + 1) === ch && input.peek(off + 2) === ch && isSep(input.peek(off + 3))
}

export const newlines = new ExternalTokenizer((input: InputStream, stack: Stack<Context>) => {
	if (input.next === -1 && stack.canShift(eof))
		return input.acceptToken(eof)
	let prev = input.peek(-1)
	if ((isBreakSpace(prev) || prev < 0) && stack.context.type !== Type.Flow) {
		if (three(input, 45 /* '-' */)) {
			if (stack.canShift(blockEnd)) input.acceptToken(blockEnd)
			else return input.acceptToken(DirectiveEnd, 3)
		}
		if (three(input, 46 /* '.' */)) {
			if (stack.canShift(blockEnd)) input.acceptToken(blockEnd)
			else return input.acceptToken(DocEnd, 3)
		}
		let depth = 0
		while (input.next === 32 /* ' ' */) {
			depth++;
			input.advance()
		}
		if ((depth < stack.context.depth ||
				depth === stack.context.depth && stack.context.type === Type.Seq &&
				(input.next !== 45 /* '-' */ || !isSep(input.peek(1)))) &&
			// Not blank
			input.next !== -1 && !isBreakSpace(input.next) && input.next !== 35 /* '#' */)
			input.acceptToken(blockEnd, -depth)
	}
}, { contextual: true })

export const blockMark = new ExternalTokenizer((input: InputStream, stack: Stack<Context>) => {
	if (stack.context.type === Type.Flow) {
		if (input.next === 63 /* '?' */) {
			input.advance()
			if (isSep(input.next)) input.acceptToken(flowMapMark)
		}
		return
	}
	if (input.next === 45 /* '-' */) {
		input.advance()
		if (isSep(input.next))
			input.acceptToken(stack.context.type === Type.Seq && stack.context.depth === findColumn(input, input.pos - 1)
				? sequenceContinueMark : sequenceStartMark)
	} else if (input.next === 63 /* '?' */) {
		input.advance()
		if (isSep(input.next))
			input.acceptToken(stack.context.type === Type.Map && stack.context.depth === findColumn(input, input.pos - 1)
				? explicitMapContinueMark : explicitMapStartMark)
	} else {
		let start = input.pos
		// Scan over a potential key to see if it is followed by a colon.
		for (; ;) {
			if (isNonBreakSpace(input.next)) {
				if (input.pos === start) return
				input.advance()
			} else if (input.next === 33 /* '!' */) {
				readTag(input)
			} else if (input.next === 38 /* '&' */) {
				readAnchor(input)
			} else if (input.next === 42 /* '*' */) {
				readAnchor(input)
				break
			} else if (input.next === 39 /* "'" */ || input.next === 34 /* '"' */) {
				if (readQuoted(input, true)) break
				return
			} else if (input.next === 91 /* '[' */ || input.next === 123 /* '{' */) {
				if (!scanBrackets(input)) return
				break
			} else {
				readPlain(input, true, false, 0)
				break
			}
		}
		while (isNonBreakSpace(input.next)) input.advance()
		if (input.next === 58 /* ':' */) {
			if (input.pos === start && stack.canShift(Colon)) return
			let after = input.peek(1)
			if (isSep(after))
				input.acceptTokenTo(stack.context.type === Type.Map && stack.context.depth === findColumn(input, start)
					? mapContinueMark : mapStartMark, start)
		}
	}
}, { contextual: true })

function uriChar(ch: char): boolean {
	return ch > 32 && ch < 127 && ch !== 34 && ch !== 37 && ch !== 44 && ch !== 60 &&
		ch !== 62 && ch !== 92 && ch !== 94 && ch !== 96 && ch !== 123 && ch !== 124 && ch !== 125
}

function hexChar(ch: char): boolean {
	return ch >= 48 && ch <= 57 || ch >= 97 && ch <= 102 || ch >= 65 && ch <= 70
}

function readUriChar(input: InputStream, quoted: boolean): boolean {
	if (input.next === 37 /* '%' */) {
		input.advance()
		if (hexChar(input.next)) input.advance()
		if (hexChar(input.next)) input.advance()
		return true
	} else if (uriChar(input.next) || quoted && input.next === 44 /* ',' */) {
		input.advance()
		return true
	}
	return false
}

function readTag(input: InputStream) {
	input.advance() // !
	if (input.next === 60 /* '<' */) {
		input.advance()
		for (; ;) {
			if (!readUriChar(input, true)) {
				if ((input.next as number) === 62 /* '>' */) input.advance()
				break
			}
		}
	} else {
		while (readUriChar(input, false)) {
			// empty
		}
	}
}

function readAnchor(input: InputStream) {
	input.advance()
	while (!isSep(input.next) && charTag(input.next) !== "f") input.advance()
}

function readQuoted(input: InputStream, scan: boolean): boolean {
	let quote = input.next, lineBreak = false, start = input.pos
	input.advance()
	for (; ;) {
		let ch = input.next
		if (ch < 0) break
		input.advance()
		if (ch === quote) {
			if (ch === 39 /* "'" */) {
				if (input.next === 39) input.advance()
				else break
			} else {
				break
			}
		} else if (ch === 92 /* "\\" */ && quote === 34 /* '"' */) {
			if (input.next >= 0) input.advance()
		} else if (isBreakSpace(ch)) {
			if (scan) return false
			lineBreak = true
		} else if (scan && input.pos >= start + 1024) {
			return false
		}
	}
	return !lineBreak
}

function scanBrackets(input: InputStream): boolean {
	for (let stack = [], end = input.pos + 1024; ;) {
		if (input.next === 91 /* '[' */ || input.next === 123 /* '{' */) {
			stack.push(input.next)
			input.advance()
		} else if (input.next === 39 /* "'" */ || input.next === 34 /* '"' */) {
			if (!readQuoted(input, true)) return false
		} else if (input.next === 93 /* ']' */ || input.next === 125 /* '}' */) {
			if (stack[stack.length - 1] !== input.next - 2) return false
			stack.pop()
			input.advance()
			if (!stack.length) return true
		} else if (input.next < 0 || input.pos > end || isBreakSpace(input.next)) {
			return false
		} else {
			input.advance()
		}
	}
}

// "Safe char" info for char codes 33 to 125. s: safe, i: indicator, f: flow indicator
const charTable = "iiisiiissisfissssssssssssisssiiissssssssssssssssssssssssssfsfssissssssssssssssssssssssssssfif"

function charTag(ch: char) {
	if (ch < 33) return "u"
	if (ch > 125) return "s"
	return charTable[ch - 33]
}

function isSafe(ch: char, inFlow: boolean): boolean {
	let tag = charTag(ch)
	return tag !== "u" && !(inFlow && tag === "f")
}

function readPlain(input: InputStream, scan: boolean, inFlow: boolean, indent: number): boolean {
	if (charTag(input.next) === "s" ||
		(input.next === 63 /* '?' */ || input.next === 58 /* ':' */ || input.next === 45 /* '-' */) &&
		isSafe(input.peek(1), inFlow)) {
		input.advance()
	} else {
		return false
	}
	let start = input.pos
	for (; ;) {
		let next = input.next, off = 0, lineIndent = indent + 1
		while (isSpace(next)) {
			if (isBreakSpace(next)) {
				if (scan) return false
				lineIndent = 0
			} else {
				lineIndent++
			}
			next = input.peek(++off)
		}
		let safe = next >= 0 &&
			(next === 58 /* ':' */ ? isSafe(input.peek(off + 1), inFlow) :
				next === 35 /* '#' */ ? input.peek(off - 1) !== 32 /* ' ' */ :
					isSafe(next, inFlow))
		if (!safe || !inFlow && lineIndent <= indent ||
			lineIndent === 0 && !inFlow && (three(input, 45, off) || three(input, 46, off)))
			break
		if (scan && charTag(next) === "f") return false
		for (let i = off; i >= 0; i--) input.advance()
		if (scan && input.pos > start + 1024) return false
	}
	return true
}

function digitValue(ch: char): number {
	if (ch >= 48 && ch <= 57) return ch - 48
	if (ch >= 65 && ch <= 70) return ch - 65 + 10
	if (ch >= 97 && ch <= 102) return ch - 97 + 10
	return -1
}

function scanDigits(s: string, i: number, base: number) {
	let had = false
	while (i < s.length) {
		let ch = s.charCodeAt(i)
		if (ch === 95 /* '_' */) {
			i++;
			continue
		}
		let v = digitValue(ch)
		if (v >= 0 && v < base) {
			had = true;
			i++;
			continue
		}
		break
	}
	return { i, had }
}

function scanExponent(s: string, i: number) {
	// FIX: reaching end-of-string is fine when there's no exponent.
	if (i >= s.length) return { i, ok: true }

	let ch = s.charCodeAt(i)
	if (ch !== 101 /* 'e' */ && ch !== 69 /* 'E' */) return { i, ok: true }

	i++
	if (i < s.length) {
		let sign = s.charCodeAt(i)
		if (sign === 43 /* '+' */ || sign === 45 /* '-' */) i++
	}
	let r = scanDigits(s, i, 10)
	if (!r.had) return { i, ok: false }
	return { i: r.i, ok: true }
}

function isNumberLike(text: string): boolean {
	// Supports (roughly): signed decimal int/float, .float, exponent, 0b/0o/0x with underscores
	let s = text
	let i = 0
	if (!s.length) return false

	let first = s.charCodeAt(0)
	if (first === 43 /* '+' */ || first === 45 /* '-' */) i++
	if (i >= s.length) return false

	// .digits
	if (s.charCodeAt(i) === 46 /* '.' */) {
		i++
		let r = scanDigits(s, i, 10)
		if (!r.had) return false
		i = r.i
		let e = scanExponent(s, i)
		if (!e.ok) return false
		i = e.i
		return i === s.length
	}

	// base prefixes 0b/0o/0x
	if (s.charCodeAt(i) === 48 /* '0' */ && i + 1 < s.length) {
		let p = s.charCodeAt(i + 1)
		if (p === 98 /* 'b' */ || p === 66 /* 'B' */) {
			i += 2
			let r = scanDigits(s, i, 2)
			return r.had && r.i === s.length
		}
		if (p === 111 /* 'o' */ || p === 79 /* 'O' */) {
			i += 2
			let r = scanDigits(s, i, 8)
			return r.had && r.i === s.length
		}
		if (p === 120 /* 'x' */ || p === 88 /* 'X' */) {
			i += 2
			let r = scanDigits(s, i, 16)
			return r.had && r.i === s.length
		}
	}

	// decimal digits
	let r = scanDigits(s, i, 10)
	if (!r.had) return false
	i = r.i

	// optional fraction
	if (i < s.length && s.charCodeAt(i) === 46 /* '.' */) {
		i++
		// allow 123. or 123.456 (digits after '.' optional)
		let r2 = scanDigits(s, i, 10)
		i = r2.i
	}

	// optional exponent
	let e = scanExponent(s, i)
	if (!e.ok) return false
	i = e.i

	return i === s.length
}

function classifyPlainScalarText(text: string) {
	let s = text.trim()
	if (s === "true" || s === "false") return BoolLiteral
	if (s === "~" || s === "null") return NullLiteral
	if (isNumberLike(s)) return NumberLiteral
	return Literal
}

export const literals = new ExternalTokenizer((input: InputStream, stack: Stack<Context>) => {
	if (input.next === 33 /* '!' */) {
		readTag(input)
		input.acceptToken(Tag)
	} else if (input.next === 38 /* '&' */ || input.next === 42 /* '*' */) {
		let token = input.next === 38 ? Anchor : Alias
		readAnchor(input)
		input.acceptToken(token)
	} else if (input.next === 39 /* "'" */ || input.next === 34 /* '"' */) {
		readQuoted(input, false)
		input.acceptToken(QuotedLiteral)
	} else {
		let start = input.pos
		if (readPlain(input, false, stack.context.type === Type.Flow, stack.context.depth)) {
			let text = input.read(start, input.pos)
			input.acceptToken(classifyPlainScalarText(text))
		}
	}
})

export const blockLiteral = new ExternalTokenizer((input: InputStream, stack: Stack<Context>) => {
	let indent = stack.context.type === Type.Lit ? stack.context.depth : -1, upto = input.pos
	scan: for (; ;) {
		let depth = 0, next = input.next
		while (next === 32 /* ' ' */) next = input.peek(++depth)
		if (!depth && (three(input, 45, depth) || three(input, 46, depth))) break
		if (!isBreakSpace(next)) {
			if (indent < 0) indent = Math.max(stack.context.depth + 1, depth)
			if (depth < indent) break
		}
		for (; ;) {
			if (input.next < 0) break scan
			let isBreak = isBreakSpace(input.next)
			input.advance()
			if (isBreak) continue scan
			upto = input.pos
		}
	}
	input.acceptTokenTo(BlockLiteralContent, upto)
})
