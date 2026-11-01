# Licensing and independence audit

Date: 2026-11-01

## Project license

Liangqi (两讫) is licensed under **GNU General Public License v3.0 or later
(GPL-3.0-or-later)**. The full license text is in [`LICENSE`](../LICENSE);
third-party notices are in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).

Copyright (C) 2026 Liangqi contributors.

## Does this project contain Cent code?

An independence audit found **no evidence that Cent source code, copy, icons,
screenshots, or other assets were copied into this repository**.

Upstream reference:

- Cent: <https://github.com/glink25/Cent>
- Audited commit: `03ae57ad3a1d98c9db08fc71224704150765b96f`
- Upstream license: CC BY-NC-SA 4.0
- Audited source: `apps/cent/src`, 317 JS/TS/CSS files (about 2.5 MB)

Method:

1. File-by-file comparison of normalized token shingles (10 tokens) between
   every Liangqi source file and every Cent source file.
2. Exact 20-token sequence search, which would expose copied functions or
   modules even after renaming.
3. Comparison of Chinese UI strings of 12 or more characters.
4. Visual comparison of the application icon, the two-column logo, and
   screenshots.
5. Comparison of the overall source layout and dependency set.

Results:

- No identical source files.
- The highest file-level 10-token containment was 20.8% for
  `src/utils/cn.ts`, a trivial `clsx` wrapper. Every other file was below 9%.
- Exact 20-token matches were limited to generic idioms: date formatting,
  `Array.sort` comparators, and the standard GitHub tree/blob payload. No
  shared domain function or module structure was found.
- No Chinese UI string of 12 or more characters is shared with Cent.
- The Liangqi icon, two-column logo, and screenshots are visually distinct;
  no Cent image assets are included.
- Liangqi uses a different source layout (`src/domain`, `src/remote`,
  `src/store`) and a different application architecture.

Feature ideas were inspired by Cent. That inspiration does not make this
project a fork and does not copy Cent's expression. The attribution is
recorded in [`NOTICE`](../NOTICE).

## Important license boundary

Cent is licensed under **CC BY-NC-SA 4.0**. That license is not compatible
with GPL-3.0-or-later because of its NonCommercial and ShareAlike terms.
Do not merge Cent source code, copy, or assets into this repository unless
the Cent author grants a compatible license.

This document records a technical similarity audit, not legal advice. If you
plan a commercial distribution or a combined work, consult a qualified lawyer.
