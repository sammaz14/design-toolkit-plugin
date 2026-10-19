---
name: clean-copy
description: Cuts interface copy that should not exist (captions that restate a label, hints that pre-empt a worry the user never had, warnings that are scar tissue from a fixed bug) and tightens what survives. Use when writing or reviewing any user-facing string (labels, hints, empty states, toasts, confirmations, error messages, button text), or on "clean up the copy", "tighten this text", "review the UI copy". Do NOT use for marketing or long-form prose, for legal or compliance text, or for code comments (that is build-standards:code-quality).
---

# Clean Copy

Most bad copy is not badly written. It is copy that should not be on the screen. Editing it for tone only makes the wrong thing read better. So the first question is never "how should this be phrased". It is **should this exist**.

## The Ladder

Walk a string down these rungs in order. Stop at the first one that fires, and cut.

**1. Does this need to surface at all?**
Would the user ever have wondered about this, unprompted? If they would never have thought to ask, the copy does not answer a question. It plants one. Nobody opens an avatar cropper wondering whether the circle is a true circle. A caption reading "the preview is rendered at the exact size used on your profile" makes them wonder whether it might not be.

**2. Does the caption need to exist?**
A caption earns its place only when the value is meaningless without it. If the label, the field, or the value beside it already says the thing, the caption is noise. A field labelled "Retry limit" does not need "how many times we retry" beneath it. A bare "30" does need "seconds" beside it, so that one stays.

**3. Does it pre-empt something the user would never have had to consider?**
The tell: copy that rules out a failure instead of describing a behaviour.

> Cancel upload
> *Always keeps the files already transferred, and never wipes the folder like the old cancel did.*

The second clause exists because of a bug. The user does not know about the bug, does not share your memory of fixing it, and now has a worry they arrived without. **The fix for a fixed bug is the fix, not a caption about the fix.** The same goes for copy that defends a design decision, or hedges about something that simply works: "this may look slow but it is not", "don't worry if the count seems off for a moment".

**4. Rewrite to remove the offending part. If nothing is left, delete the element.**
Do not keep a hint just because a hint was there. An empty `hint` prop comes off the component. An explanatory `<p>` gets deleted, not shortened to a stub.

## Never Cut

The ladder does not apply to these. Tighten their wording if the owner agrees, but never delete them on the ladder's say-so:

- Legal, regulatory, consent, and privacy text, and anything a contract or policy requires on the screen.
- Accessibility text: `aria-label`, `alt`, screen-reader-only text, and form error associations. A sighted reviewer never sees them, so they always look redundant on screen.
- Safety warnings where a wrong action harms a person or loses money.

## What Survives

Copy stays when the user cannot act without it:

- A real consequence at the moment of choosing. Under a destructive button: *"Anything not yet synced is lost."* The user needs it before they click and cannot infer it.
- A compatibility or scope fact the user cannot see. *"Works with keys issued after March. Older keys need rotating first."* The checkbox alone does not say whether it applies to them.
- What a blank state means and what to do next. *"No projects yet. Create one and it will appear here."*
- Units, scale, or format on a bare value.

The first example is one sentence. Had it gone on with *"Only use this when a sync is stuck"*, that half would go: it tells the user when they may press a button they can already see. Keep the consequence, cut the permission slip.

## Error Messages

An error is the copy a user needs most, at the moment they are least patient. It survives the ladder when it does three things, in this order:

1. **What happened**, in the user's terms: "The file is larger than 25 MB." Not "Upload failed" and not "Error 413".
2. **What to do**: "Compress it or upload a smaller file." Leave this out only when the user can do nothing, and then say who can ("Ask your admin to raise the limit").
3. **Whether their work is safe**, when it is in doubt: "Your other files were uploaded."

Cut from errors: apologies that carry no fact ("Oops! Something went wrong"), blame ("You entered an invalid value"), internal detail the user cannot act on (stack traces, raw codes; log them instead), and a second sentence that restates the first.

## Working Style

- Read the string next to what is on screen around it: the label, the value, the button. Redundancy is invisible when you read the string alone.
- Cut whole clauses, not words. Tightening "Leave this blank to use the default setting for your account" into "Leave blank for the default" is a smaller win than noticing which half of a two-sentence hint does no work.
- When reviewing a batch, report each string as `file:line` with the current text and either the rewrite or `cut`, and name in a few words the rung it failed. Do not rewrite copy that passes.
- If a string matters only in a rare state, move it into that state instead of leaving it on the page all the time.
