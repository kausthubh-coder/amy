# Amy feature map

One file per user-facing feature. Each says what it is, how a person reaches it, how `scripts/journey.mjs` drives it, and the observable end state that proves it works. A proof that drives one convenient entry point is incomplete when the file lists others.

| Feature | File | Journey | Proves |
| --- | --- | --- | --- |
| Line logging on Today | [today-logging.md](today-logging.md) | `today-logging` | typing a line logs it, inline calories, the no-key path, deleting a line, undo, persistence |
| Editing a logged food | [edit-entry.md](edit-entry.md) | `edit-entry` | the edit sheet changes numbers, remembers them, removes a food |
| Saved meals | [saved-meals.md](saved-meals.md) | `saved-meals` | creating, logging, and typing a saved meal's name, delete with undo |
| Settings and goals | [settings-goals.md](settings-goals.md) | `settings-goals` | daily goal parsing and range, weight logging keeps edits, export without the key, refused import |
| Onboarding | [onboarding.md](onboarding.md) | `onboarding` | first launch to an empty Today, target range |

Not on the map because web cannot show them: barcode camera scanning, photo and label estimates, dictation, Android widgets, the splash screen, AI estimates (they need a key and the network). Barcode lookup by typed digits works on web but calls Open Food Facts over the network; only drive it by hand when the task is about that lookup.
