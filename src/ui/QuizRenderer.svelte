<script lang="ts">
	import { onMount } from "svelte";
	import type { AppContext } from "../markdown";
	import type { Quiz } from "../schemas";
	import { scale } from "svelte/transition";

	import InlineMarkdown from "./InlineMarkdown.svelte";
	import QuizChoice from "./QuizChoice.svelte";
	import QuizRadio from "./QuizRadio.svelte";
	import QuizCheckbox from "./QuizCheckbox.svelte";
	import QuizNoodle from "./QuizNoodle.svelte";
	import QuizText from "./QuizText.svelte";

	interface Props {
		ctx: AppContext;
		stableId: string;
		quiz: Quiz;
	}

	let { ctx, stableId, quiz }: Props = $props();

	let rootEl: HTMLElement;

	// --- gated quizzes (preview-only) ---
	let isPreviewMode = $state(false);
	let started = $state(false);
	let active = $state(false);
	let finished = $state(false);

	// Tracks interaction state
	let hoverWithin = $state(false);
	let focusWithin = $state(false);
	let viewContentEl: HTMLElement | null = null;

	// Pointer tracking to handle scroll + leaving without click
	let lastPointerX = $state<number | null>(null);
	let lastPointerY = $state<number | null>(null);

	// Mouse vs keyboard behavior:
	// - mouse: redact only while pointer is inside quiz
	// - keyboard: redact only while focus is inside quiz
	let inputMode = $state<"mouse" | "keyboard">("mouse");

	function inSourceMode(el: HTMLElement): boolean {
		return Boolean(el.closest(".markdown-source-view"));
	}

	function inPreviewMode(el: HTMLElement): boolean {
		return Boolean(el.closest(".markdown-preview-view")) && !inSourceMode(el);
	}

	function clearRedaction() {
		viewContentEl?.classList.remove("quiz-block-gated");
	}

	function updateRedaction() {
		if (!quiz.gated || !isPreviewMode || !active) return;

		const shouldRedact = inputMode === "mouse" ? hoverWithin : focusWithin;
		viewContentEl?.classList.toggle("quiz-block-gated", shouldRedact);
	}

	function activate() {
		if (!quiz.gated || !isPreviewMode) return;

		inputMode = "mouse";
		started = true;
		active = true;
		finished = false;

		// Keep focus inside the quiz block after clicking Start
		rootEl?.focus();

		updateRedaction();
	}

	function finish() {
		// After finishing, gating stops (outside stays visible),
		// but quiz stays visible and other quizzes become interactive again.
		finished = true;
		active = false;
		clearRedaction();
	}

	function onMouseEnter() {
		hoverWithin = true;
		updateRedaction();
	}

	function onMouseLeave() {
		hoverWithin = false;
		updateRedaction();
	}

	function onFocusIn() {
		focusWithin = true;
		updateRedaction();
	}

	function onFocusOut(e: FocusEvent) {
		// If focus moves within the quiz, don't un-redact.
		const next = e.relatedTarget as Node | null;
		if (next && rootEl.contains(next)) return;

		focusWithin = false;
		updateRedaction();
	}

	onMount(() => {
		isPreviewMode = inPreviewMode(rootEl);
		viewContentEl = rootEl.closest<HTMLElement>(".view-content");

		// Only gated preview mode needs global listeners
		if (!quiz.gated || !isPreviewMode) return;

		const previewEl = rootEl.closest<HTMLElement>(".markdown-preview-view");

		const recomputeHoverFromPointer = () => {
			if (!active) return;

			if (lastPointerX === null || lastPointerY === null) {
				hoverWithin = false;
				updateRedaction();
				return;
			}

			const elUnderPointer = document.elementFromPoint(lastPointerX, lastPointerY);
			hoverWithin = !!(elUnderPointer && rootEl.contains(elUnderPointer));
			updateRedaction();
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!active) return;

			inputMode = "mouse";
			lastPointerX = e.clientX;
			lastPointerY = e.clientY;

			// As soon as pointer leaves the quiz, reveal the note
			const target = e.target as Node | null;
			hoverWithin = !!(target && rootEl.contains(target));
			updateRedaction();
		};

		const onPointerDownOrTouchStart = (evt: Event) => {
			if (!active) return;

			inputMode = "mouse";

			const target = evt.target as Node | null;
			if (target && rootEl.contains(target)) return;

			// Clicking/tapping outside should show the note again
			clearRedaction();
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (!active) return;

			// If user starts tabbing, treat gating as keyboard-driven
			if (e.key === "Tab") {
				inputMode = "keyboard";
				updateRedaction();
			}
		};

		// ✅ Better UX: while scrolling, ALWAYS show the outside content immediately.
		const onWheelOrScroll = () => {
			if (!active) return;

			inputMode = "mouse";
			clearRedaction();

			// Next frame: if pointer is still over the quiz, re-hide again
			requestAnimationFrame(recomputeHoverFromPointer);
		};

		const onTouchMove = () => {
			if (!active) return;

			inputMode = "mouse";
			clearRedaction();
			requestAnimationFrame(recomputeHoverFromPointer);
		};

		ctx.component.registerDomEvent(document, "pointermove", onPointerMove, true);
		ctx.component.registerDomEvent(document, "pointerdown", onPointerDownOrTouchStart, true);
		ctx.component.registerDomEvent(document, "touchstart", onPointerDownOrTouchStart, true);
		ctx.component.registerDomEvent(document, "keydown", onKeyDown, true);

		ctx.component.registerDomEvent(document, "wheel", onWheelOrScroll, { capture: true, passive: true });
		previewEl
			? ctx.component.registerDomEvent(previewEl, "scroll", onWheelOrScroll, { capture: true, passive: true })
			: ctx.component.registerDomEvent(document, "scroll", onWheelOrScroll, { capture: true, passive: true });
		ctx.component.registerDomEvent(document, "touchmove", onTouchMove, {
			capture: true,
			passive: true,
		});

		return () => {
			clearRedaction();
		};
	});
</script>

<div
	class={["quiz-block", quiz.gated ? "quiz-block--gated" : "", active ? "quiz-block--active" : ""]}
	data-quiz-id={stableId}
	bind:this={rootEl}
	tabindex="-1"
	role="group"
	onmouseenter={onMouseEnter}
	onmouseleave={onMouseLeave}
	onfocusin={onFocusIn}
	onfocusout={onFocusOut}
>
	{#if quiz.gated && isPreviewMode && !started}
		<div
			class="quiz-gate-overlay"
			aria-hidden="false"
			out:scale={{ duration: 180, start: 0.98 }}
		>

		<button class="quiz-gate-button" type="button" onclick={activate}>
				Start quiz
			</button>
			<div class="quiz-gate-hint">
				The rest of the note will be hidden while you interact with it.
			</div>
		</div>
	{/if}

	<!-- Keep layout height, but hide content until started -->
	<div class="quiz-inner" class:quiz-inner--hidden={quiz.gated && isPreviewMode && !started}>
		<div class="quiz-title">
			<InlineMarkdown {ctx} markdown={quiz.content} />
		</div>

		{#if quiz.type === "choice"}
			<QuizChoice {ctx} quiz={quiz} {finish} />
		{:else if quiz.type === "noodle"}
			<QuizNoodle {ctx} quiz={quiz} {finish} />
		{:else if quiz.type === "text"}
			<QuizText {ctx} {stableId} quiz={quiz} {finish} />
		{:else if quiz.type === "radio"}
			<QuizRadio {ctx} {stableId} quiz={quiz} {finish} />
		{:else if quiz.type === "checkbox"}
			<QuizCheckbox {ctx} {stableId} quiz={quiz} {finish} />
		{/if}
	</div>
</div>

<style>
	.quiz-block {
		position: relative;
		outline: none;
	}

	.quiz-inner--hidden {
		visibility: hidden;
	}

	.quiz-gate-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		z-index: 2;
	}

	.quiz-gate-button {
		padding: 0.5rem 0.9rem;
		border-radius: 8px;
	}

	.quiz-gate-hint {
		font-size: 0.85em;
		opacity: 0.75;
		text-align: center;
		max-width: 42ch;
	}
</style>
