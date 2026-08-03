"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { toLatinDigits } from "@/lib/mobile";

/**
 * Segmented one-time-code field, one box per digit, as in
 * /design-reference/stepper-otpFiled.jpg.
 *
 * The row is `dir="ltr"` inside an otherwise RTL page. A one-time code is a
 * number, not Persian text: its digits are ordered most-significant-first and
 * read left to right, exactly like the mobile number two lines above it. Left
 * in the document's RTL direction the boxes would fill rightwards, so a code
 * read off a phone as 1-2-3-4-5 would appear on screen as 5-4-3-2-1.
 *
 * The value handed up is always a plain ASCII string: every entry point runs
 * through `toLatinDigits`, because the API validates the code with an ASCII
 * `^\d{5}$` and a code typed on a Persian keyboard would otherwise be rejected
 * as malformed.
 *
 * The inputs deliberately have NO `maxLength`. It would truncate a pasted code
 * to its first character, and pasting the whole thing out of an SMS is the most
 * common way this field gets filled. Over-long input is sliced here instead.
 *
 * EVERY EDIT IS A STRING SPLICE, never an assignment into a per-box array.
 * An array would let a hole open in the middle -- box 1 empty, box 2 filled --
 * and joining it back into a code would silently slide the later digits left.
 * Splicing keeps the value dense by construction, which in turn means focus can
 * always be derived from its length rather than tracked separately.
 */
export function OtpInput({
  value,
  onChange,
  length,
  disabled,
  invalid,
  autoFocus,
  "aria-label": ariaLabel = "کد تأیید",
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  const chars = React.useMemo(
    () => Array.from({ length }, (_, index) => value[index] ?? ""),
    [value, length],
  );

  const focusBox = (index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const box = refs.current[clamped];
    box?.focus();
    // Select so the next keystroke replaces rather than appends -- with no
    // maxLength, appending would otherwise push two digits into one box.
    box?.select();
  };

  /**
   * `focusAt` is where the caret belongs after the edit, capped at the first
   * empty box -- which, because the value is dense, is exactly its length.
   *
   * Both halves matter. Without the cap, typing into box 1 would let focus run
   * ahead into boxes the user has not filled yet. Without `focusAt`, focus
   * would always land on that first empty box, so correcting the first digit of
   * a complete code would fling the caret to the end instead of stepping to the
   * second digit.
   */
  const commit = (next: string, focusAt: number) => {
    const trimmed = next.slice(0, length);
    onChange(trimmed);
    focusBox(Math.min(focusAt, trimmed.length));
  };

  const handleChange = (index: number, raw: string) => {
    const previous = chars[index] ?? "";
    let digits = toLatinDigits(raw).replace(/\D/g, "");

    /**
     * The box's existing character comes back inside `raw`, so strip it once --
     * typing over a filled box has to replace, not insert.
     *
     * Which END it arrives on depends on where the caret was: clicking to the
     * left of the digit yields "new"+"old", clicking to the right yields
     * "old"+"new". Checking only one of them turns half the corrections into
     * insertions that shove the rest of the code along. When the box's content
     * was selected (every programmatic focus does that) `raw` is just the typed
     * character and neither branch fires.
     */
    if (previous) {
      if (digits.startsWith(previous)) digits = digits.slice(previous.length);
      else if (digits.endsWith(previous)) digits = digits.slice(0, -previous.length);
    }

    // Emptied by the user (select-all + delete, or cut).
    if (!digits) {
      commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }

    const head = value.slice(0, index);
    commit(
      head + digits + value.slice(head.length + digits.length),
      index + digits.length,
    );
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !chars[index] && index > 0) {
      // Nothing here to delete, so step back and clear that one instead --
      // otherwise backspace at an empty box appears to do nothing.
      event.preventDefault();
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
      return;
    }

    // Arrows follow the visual order, which the container's dir="ltr" makes the
    // same as the index order -- unlike the rest of this page.
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      dir="ltr"
      // w-fit so the LTR row does not stretch and pull the boxes away from the
      // inline-start edge the rest of the form is aligned to.
      className="flex w-fit gap-2"
    >
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          // Only the first box advertises the SMS code, so the browser fills
          // the whole value into it and the splice spreads it across the rest.
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={`رقم ${index + 1}`}
          aria-invalid={invalid || undefined}
          value={char}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          className={cn(
            "h-14 w-12 rounded-md border bg-surface-sunken text-center text-lg font-bold text-fg",
            "outline-none transition-colors duration-150",
            "focus:border-primary-500 focus:shadow-glow-sm",
            invalid ? "border-danger" : "border-border",
            disabled && "opacity-50",
          )}
        />
      ))}
    </div>
  );
}
