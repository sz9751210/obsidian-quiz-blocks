#!/usr/bin/env python3
"""
Quiz Blocks 互動部署精靈 — Python curses 全螢幕 TUI
成功時將選擇結果以 JSON 輸出至 stdout。
退出碼：0 = 確認部署，1 = 使用者取消，2 = 系統錯誤。
"""

from __future__ import annotations

import curses
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / ".quiz-blocks-dev.json"

# ─── Vault discovery ──────────────────────────────────────────────────────────

def discover_vaults() -> list[Path]:
    """從 Obsidian 登錄檔掃描所有已知 Vault。"""
    if sys.platform == "darwin":
        app_data = Path.home() / "Library" / "Application Support"
    elif sys.platform == "win32":
        app_data = Path(os.environ.get("APPDATA", ""))
    else:
        xdg = os.environ.get("XDG_CONFIG_HOME", "")
        app_data = Path(xdg) if xdg else Path.home() / ".config"

    registry = app_data / "obsidian" / "obsidian.json"
    seen: list[Path] = []
    if registry.exists():
        try:
            data = json.loads(registry.read_text("utf-8"))
            for entry in (data.get("vaults") or {}).values():
                raw = entry.get("path", "")
                if raw:
                    p = Path(raw).resolve()
                    if p.is_dir() and p not in seen:
                        seen.append(p)
        except Exception:
            pass
    return seen


def load_preferred() -> Path | None:
    """讀取上次記住的 Vault 路徑。"""
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text("utf-8"))
            raw = data.get("vaultPath", "")
            if raw:
                return Path(raw).resolve()
        except Exception:
            pass
    return None


# ─── Color pairs ──────────────────────────────────────────────────────────────

CP_BORDER   = 1   # cyan  — 邊框與標題
CP_STEP     = 2   # dim cyan — 步驟標籤
CP_SELECTED = 3   # black on cyan — 選中項
CP_HEADER   = 4   # bold cyan — 鍵標籤
CP_DIM      = 5   # dim — 未選中項、提示
CP_SUCCESS  = 6   # green — 成功


def setup_colors() -> None:
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(CP_BORDER,   curses.COLOR_CYAN,  -1)
    curses.init_pair(CP_STEP,     curses.COLOR_CYAN,  -1)
    curses.init_pair(CP_SELECTED, curses.COLOR_BLACK, curses.COLOR_CYAN)
    curses.init_pair(CP_HEADER,   curses.COLOR_CYAN,  -1)
    curses.init_pair(CP_DIM,      -1,                 -1)
    curses.init_pair(CP_SUCCESS,  curses.COLOR_GREEN, -1)


# ─── Drawing helpers ──────────────────────────────────────────────────────────

WIZARD_TITLE = " Quiz Blocks 部署精靈 "
MIN_W, MIN_H  = 60, 20


def safe_addstr(win, y: int, x: int, text: str, attr: int = 0) -> None:
    """addstr that silently ignores out-of-bounds errors."""
    try:
        win.addstr(y, x, text, attr)
    except curses.error:
        pass


def draw_box(win) -> None:
    """圓角邊框 + 頂部嵌入標題。"""
    h, w = win.getmaxyx()
    ba = curses.color_pair(CP_BORDER)
    ta = curses.color_pair(CP_BORDER) | curses.A_BOLD

    # Corners
    safe_addstr(win, 0,   0,   "╭", ba)
    safe_addstr(win, 0,   w-1, "╮", ba)
    safe_addstr(win, h-1, 0,   "╰", ba)
    safe_addstr(win, h-1, w-1, "╯", ba)

    # Edges
    for x in range(1, w-1):
        safe_addstr(win, 0,   x, "─", ba)
        safe_addstr(win, h-1, x, "─", ba)
    for y in range(1, h-1):
        safe_addstr(win, y, 0,   "│", ba)
        safe_addstr(win, y, w-1, "│", ba)

    # Title centered in top edge
    t = WIZARD_TITLE
    tx = max(2, (w - len(t)) // 2)
    safe_addstr(win, 0, tx, t, ta)


def clip(s: str, max_len: int) -> str:
    """截斷超長字串並附加省略號。"""
    return s if len(s) <= max_len else s[:max_len - 1] + "…"


def check_size(stdscr) -> bool:
    h, w = stdscr.getmaxyx()
    if h < MIN_H or w < MIN_W:
        stdscr.clear()
        msg = f" 終端機過小（{w}×{h}），請調整至 {MIN_W}×{MIN_H} 以上後重試。"
        safe_addstr(stdscr, h // 2, max(0, (w - len(msg)) // 2), msg, curses.A_BOLD)
        stdscr.refresh()
        stdscr.getch()
        return False
    return True


# ─── Widget: arrow-key menu (with optional real-time filter) ──────────────────

def select_menu(
    stdscr,
    title: str,
    options: list[str],
    *,
    default_idx: int = 0,
    max_visible: int = 8,
    step_label: str = "",
    filterable: bool = False,
) -> int | None:
    """
    全螢幕居中選單，支援捲動與即時過濾（filterable=True 時啟用）。

    - 方向鍵 ↑↓ 移動、Enter 確認、q/ESC 取消
    - filterable=True：輸入任何字元即可縮小清單，Backspace 刪除
    - 回傳「原始 options 清單」中的索引，或 None（取消）
    """
    if not check_size(stdscr):
        return None

    sh, sw = stdscr.getmaxyx()

    # ── Layout (fixed height) ─────────────────────────────────────────────────
    max_opt_w = max((len(o) for o in options), default=20)
    box_w     = min(sw - 4, max(56, max_opt_w + 10))
    inner_w   = box_w - 4

    # Box height is always FIXED so the dialog never jumps when filter changes:
    #   border(2) + step(1) + blank(1) + title(1) + blank(1)
    #   + [filter_row(1) + separator(1)]  when filterable
    #   + ▲(1) + max_visible items + ▼(1)   always reserved
    #   + blank(1) + hint(1)
    filter_extra = 2 if filterable else 0
    box_h = 10 + filter_extra + max_visible
    box_h = min(box_h, sh - 2)

    box_y = max(0, (sh - box_h) // 2)
    box_x = max(0, (sw - box_w) // 2)

    # ── Filter state ──────────────────────────────────────────────────────────
    filter_text = ""

    def apply_filter(q: str) -> list[int]:
        """Return original indices that match the query (case-insensitive)."""
        if not q:
            return list(range(len(options)))
        ql = q.lower()
        return [i for i, o in enumerate(options) if ql in o.lower()]

    filtered    = apply_filter("")
    f_cursor    = max(0, min(default_idx, len(filtered) - 1))
    f_scroll_top = max(0, min(f_cursor - max_visible // 2,
                              max(0, len(filtered) - max_visible)))

    hint_base   = "  ↑↓ 移動    Enter 確認    q/ESC 取消"
    hint_filter = "    輸入字元過濾    Backspace 刪除  "
    hint        = hint_base + (hint_filter if filterable else "  ")

    # ── Render + event loop ───────────────────────────────────────────────────
    while True:
        stdscr.erase()
        win = curses.newwin(box_h, box_w, box_y, box_x)
        win.keypad(True)
        win.erase()
        draw_box(win)

        row = 1

        # Step label
        if step_label:
            safe_addstr(win, row, 3, clip(step_label, inner_w),
                        curses.color_pair(CP_STEP) | curses.A_DIM)
        row += 2

        # Title
        safe_addstr(win, row, 3, clip(title, inner_w), curses.A_BOLD)
        row += 2

        # Filter input row + separator
        if filterable:
            if filter_text:
                label = clip(f"  /  {filter_text}", inner_w)
                safe_addstr(win, row, 2, label,
                            curses.color_pair(CP_HEADER) | curses.A_BOLD)
                # count badge
                badge = f"  {len(filtered)} 個結果"
                bx    = box_w - 2 - len(badge)
                if bx > 2 + len(label):
                    safe_addstr(win, row, bx, badge, curses.A_DIM)
            else:
                safe_addstr(win, row, 2,
                            clip("  /  輸入字元過濾清單…", inner_w),
                            curses.A_DIM)
            row += 1
            safe_addstr(win, row, 2, "─" * inner_w, curses.A_DIM)
            row += 1

        # ▲ scroll indicator (always rendered for stable height)
        can_up = f_scroll_top > 0
        if can_up:
            safe_addstr(win, row, 2,
                        clip(f"  ▲  （還有 {f_scroll_top} 個）", inner_w),
                        curses.color_pair(CP_HEADER))
        else:
            safe_addstr(win, row, 2, "  ─", curses.A_DIM)
        row += 1

        # Item rows — always max_visible slots (pad with blanks when fewer items)
        for slot in range(max_visible):
            f_idx = f_scroll_top + slot
            if not filtered:
                # No results: show message in first slot only
                if slot == 0:
                    safe_addstr(win, row, 2,
                                clip("  （無符合結果）", inner_w), curses.A_DIM)
                else:
                    safe_addstr(win, row, 2, " " * inner_w)
            elif f_idx < len(filtered):
                orig_idx = filtered[f_idx]
                active   = f_idx == f_cursor
                label    = clip(options[orig_idx], inner_w - 4)
                if active:
                    line = f"❯ {label}"
                    pad  = max(0, inner_w - len(line))
                    safe_addstr(win, row, 2, line + " " * pad,
                                curses.color_pair(CP_SELECTED) | curses.A_BOLD)
                else:
                    safe_addstr(win, row, 2, f"  {label}", curses.A_DIM)
            else:
                safe_addstr(win, row, 2, " " * inner_w)
            row += 1

        # ▼ scroll indicator (always rendered)
        remaining = len(filtered) - (f_scroll_top + max_visible)
        if remaining > 0:
            safe_addstr(win, row, 2,
                        clip(f"  ▼  （還有 {remaining} 個）", inner_w),
                        curses.color_pair(CP_HEADER))
        else:
            safe_addstr(win, row, 2, "  ─", curses.A_DIM)
        row += 1

        # Hint bar
        row += 1
        if row < box_h - 1:
            hx = max(2, (box_w - len(hint)) // 2)
            safe_addstr(win, row, hx, clip(hint, inner_w), curses.A_DIM)

        stdscr.refresh()
        win.refresh()

        # ── Key handling ──────────────────────────────────────────────────────
        key = win.getch()

        if key in (ord("q"), ord("Q"), 27):       # q, Q, ESC
            return None
        elif key == 3:                             # Ctrl+C
            raise KeyboardInterrupt
        elif key in (curses.KEY_ENTER, 10, 13):   # Enter
            if filtered:
                return filtered[f_cursor]
        elif key == curses.KEY_UP:
            if filtered:
                f_cursor = (f_cursor - 1 + len(filtered)) % len(filtered)
                if f_cursor == len(filtered) - 1:
                    f_scroll_top = max(0, len(filtered) - max_visible)
                elif f_cursor < f_scroll_top:
                    f_scroll_top = f_cursor
        elif key == curses.KEY_DOWN:
            if filtered:
                f_cursor = (f_cursor + 1) % len(filtered)
                if f_cursor == 0:
                    f_scroll_top = 0
                elif f_cursor >= f_scroll_top + max_visible:
                    f_scroll_top = f_cursor - max_visible + 1
        elif filterable and key in (curses.KEY_BACKSPACE, 127, 8):
            filter_text   = filter_text[:-1]
            filtered      = apply_filter(filter_text)
            f_cursor      = min(f_cursor, max(0, len(filtered) - 1))
            f_scroll_top  = min(f_scroll_top,
                                max(0, len(filtered) - max_visible))
        elif filterable and 32 <= key <= 126:
            filter_text   += chr(key)
            filtered       = apply_filter(filter_text)
            f_cursor       = 0
            f_scroll_top   = 0


# ─── Widget: text input ───────────────────────────────────────────────────────

def text_input_dialog(
    stdscr,
    title: str,
    prompt: str,
    *,
    step_label: str = "",
) -> str | None:
    """單行文字輸入框。回傳輸入字串或 None（取消）。"""
    if not check_size(stdscr):
        return None

    curses.curs_set(1)
    sh, sw = stdscr.getmaxyx()
    box_w = min(sw - 4, 68)
    box_h = 9
    box_y = max(0, (sh - box_h) // 2)
    box_x = max(0, (sw - box_w) // 2)
    inner_w = box_w - 4
    field_w = inner_w - 4
    text = ""

    while True:
        stdscr.erase()
        win = curses.newwin(box_h, box_w, box_y, box_x)
        win.keypad(True)
        win.erase()
        draw_box(win)

        row = 1
        if step_label:
            safe_addstr(win, row, 3, clip(step_label, inner_w),
                        curses.color_pair(CP_STEP) | curses.A_DIM)
        row += 2
        safe_addstr(win, row, 3, clip(title, inner_w), curses.A_BOLD)
        row += 2
        safe_addstr(win, row, 3, clip(prompt, inner_w), curses.A_DIM)
        row += 1

        # Input field  ┤ text… ├
        display = text[-field_w:] if len(text) > field_w else text
        safe_addstr(win, row, 2, "┤ ", curses.color_pair(CP_BORDER))
        safe_addstr(win, row, 4, display + " " * max(0, field_w - len(display)))
        safe_addstr(win, row, 4 + field_w, " ├", curses.color_pair(CP_BORDER))
        try:
            win.move(row, 4 + min(len(display), field_w))
        except curses.error:
            pass

        stdscr.refresh()
        win.refresh()

        key = win.getch()

        if key in (curses.KEY_ENTER, 10, 13):
            curses.curs_set(0)
            return text.strip() or None
        elif key == 27:   # ESC
            curses.curs_set(0)
            return None
        elif key == 3:    # Ctrl+C
            raise KeyboardInterrupt
        elif key in (curses.KEY_BACKSPACE, 127, 8):
            text = text[:-1]
        elif 32 <= key <= 126:
            text += chr(key)


# ─── Widget: confirmation summary ─────────────────────────────────────────────

def summary_confirm(
    stdscr,
    vault_path: str,
    skip_build: bool,
    *,
    step_label: str = "",
) -> bool:
    """顯示部署摘要並詢問確認。回傳 True=確認，False=取消。"""
    if not check_size(stdscr):
        return False

    sh, sw = stdscr.getmaxyx()
    pairs = [
        ("目標", vault_path),
        ("方式", "使用現有產物" if skip_build else "重新編譯後部署"),
        ("更新", "main.js、styles.css、manifest.json"),
    ]
    max_val_w = max(len(v) for _, v in pairs)
    box_w = min(sw - 4, max(56, max_val_w + 14))
    inner_w = box_w - 4

    # border(2) + step(1) + blank(1) + title(1) + blank(1) + pairs + blank(1) + 2 opts + blank(1) + hint(1)
    box_h = 2 + 1 + 1 + 1 + 1 + len(pairs) + 1 + 2 + 1 + 1
    box_h = min(box_h, sh - 2)
    box_y = max(0, (sh - box_h) // 2)
    box_x = max(0, (sw - box_w) // 2)

    cursor  = 0   # 0 = 確認, 1 = 取消
    options = ["確認部署", "取消"]
    hint    = "  ↑↓ 移動    Enter 確認    q / ESC 取消  "

    while True:
        stdscr.erase()
        win = curses.newwin(box_h, box_w, box_y, box_x)
        win.keypad(True)
        win.erase()
        draw_box(win)

        row = 1
        if step_label:
            safe_addstr(win, row, 3, clip(step_label, inner_w),
                        curses.color_pair(CP_STEP) | curses.A_DIM)
        row += 2
        safe_addstr(win, row, 3, "部署摘要", curses.A_BOLD)
        row += 2

        for key, val in pairs:
            k_str = f"{key}："
            v_str = clip(val, inner_w - len(k_str))
            safe_addstr(win, row, 3, k_str,
                        curses.color_pair(CP_HEADER) | curses.A_BOLD)
            safe_addstr(win, row, 3 + len(k_str), v_str)
            row += 1

        row += 1
        for i, opt in enumerate(options):
            active = i == cursor
            if active:
                line = f"❯ {opt}"
                pad  = max(0, inner_w - len(line))
                safe_addstr(win, row, 2, line + " " * pad,
                            curses.color_pair(CP_SELECTED) | curses.A_BOLD)
            else:
                safe_addstr(win, row, 2, f"  {opt}", curses.A_DIM)
            row += 1

        row += 1
        if row < box_h - 1:
            hx = max(2, (box_w - len(hint)) // 2)
            safe_addstr(win, row, hx, clip(hint, inner_w), curses.A_DIM)

        stdscr.refresh()
        win.refresh()

        key = win.getch()

        if key in (ord("q"), ord("Q"), 27):
            return False
        elif key == 3:
            raise KeyboardInterrupt
        elif key in (curses.KEY_ENTER, 10, 13):
            return cursor == 0
        elif key in (curses.KEY_UP, curses.KEY_DOWN):
            cursor ^= 1   # toggle 0 ↔ 1


# ─── Main wizard ──────────────────────────────────────────────────────────────

def wizard(stdscr) -> dict | None:
    setup_colors()
    curses.curs_set(0)
    stdscr.clear()
    stdscr.refresh()

    vaults    = discover_vaults()
    preferred = load_preferred()

    # Build vault labels (mark preferred with ★)
    labels = [
        str(v) + ("  ★" if preferred and v == preferred else "")
        for v in vaults
    ]
    labels.append("手動輸入 Vault 路徑…")

    default_idx = 0
    if preferred:
        try:
            default_idx = vaults.index(preferred)
        except ValueError:
            pass

    # ── Step 1: Select vault ──────────────────────────────────────────────────
    choice = select_menu(
        stdscr, "選擇目標 Vault", labels,
        default_idx=default_idx,
        step_label="步驟 1 / 4　選擇 Vault",
        filterable=True,
    )
    if choice is None:
        return None

    if choice == len(labels) - 1:
        # Manual path entry
        raw = text_input_dialog(
            stdscr,
            "手動輸入 Vault 路徑",
            "輸入絕對路徑或 ~/…，Enter 確認，ESC 取消",
            step_label="步驟 1 / 4　選擇 Vault",
        )
        if not raw:
            return None
        raw = raw.strip("'\"")
        if raw.startswith("~/"):
            raw = str(Path.home() / raw[2:])
        vault_p = Path(raw).resolve()
        if not vault_p.is_dir():
            # Brief error screen
            sh, sw = stdscr.getmaxyx()
            msg = f" 路徑不存在或不是目錄：{vault_p} "
            stdscr.clear()
            safe_addstr(stdscr, sh // 2, max(0, (sw - len(msg)) // 2),
                        msg, curses.A_BOLD | curses.A_REVERSE)
            safe_addstr(stdscr, sh // 2 + 1,
                        max(0, (sw - 14) // 2), "  按任意鍵退出…")
            stdscr.refresh()
            stdscr.getch()
            return None
        vault_path = str(vault_p)
    else:
        vault_path = str(vaults[choice])

    # ── Step 2: Build mode ────────────────────────────────────────────────────
    build_choice = select_menu(
        stdscr,
        "選擇部署方式",
        ["重新編譯後部署（建議）", "使用現有產物直接部署"],
        default_idx=0,
        step_label="步驟 2 / 4　部署方式",
    )
    if build_choice is None:
        return None
    skip_build = build_choice == 1

    # ── Step 3: Save vault ────────────────────────────────────────────────────
    already_saved = preferred and str(preferred) == vault_path
    save_choice = select_menu(
        stdscr,
        "成功後記住此 Vault 作為預設？",
        ["是，記住此 Vault", "否，不記住"],
        default_idx=1 if already_saved else 0,
        step_label="步驟 3 / 4　儲存設定",
    )
    if save_choice is None:
        return None
    save = save_choice == 0

    # ── Step 4: Confirm ───────────────────────────────────────────────────────
    ok = summary_confirm(
        stdscr, vault_path, skip_build,
        step_label="步驟 4 / 4　確認部署",
    )
    if not ok:
        return None

    return {"vaultPath": vault_path, "skipBuild": skip_build, "save": save}


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Quiz Blocks 互動部署精靈")
    parser.add_argument(
        "--output", metavar="FILE",
        help="將選擇結果以 JSON 寫入此檔案（由 deploy.mjs 傳入）",
    )
    args = parser.parse_args()

    result_holder: list[dict | None] = [None]

    def run(stdscr):
        result_holder[0] = wizard(stdscr)

    try:
        curses.wrapper(run)
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as exc:
        sys.stderr.write(f"\n精靈發生錯誤：{exc}\n")
        sys.exit(2)

    result = result_holder[0]
    if result is None:
        sys.exit(1)

    # Write result JSON to temp file (stdout may be piped by caller)
    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False)
        except Exception as exc:
            sys.stderr.write(f"\n無法寫入輸出檔案：{exc}\n")
            sys.exit(2)
    else:
        # Fallback: direct stdout (only works if stdout is a TTY)
        print(json.dumps(result, ensure_ascii=False))

    sys.exit(0)


if __name__ == "__main__":
    main()
