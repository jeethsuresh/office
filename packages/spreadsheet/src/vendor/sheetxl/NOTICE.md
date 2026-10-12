# SheetXL standalone formula bindings

Source: https://github.com/sheetxl/sheetxl/tree/0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5/packages/formulas

Copyright © 2025–present SheetXL Inc. and Michael T. Ford.
The upstream formula README explicitly licenses this function library under MIT.
The upstream published license notice and README are retained alongside these files.

The published `@sheetxl/formulas@0.7.27` registry is a stub (`formulaCount = 0`).
Office generates independent bindings from the open formula implementations,
using the upstream primitives package with its own range/context adapter.
No commercial SheetXL SDK, workbook model, or UI is included.

To regenerate, download the pinned revision above and run:
`bun scripts/vendor-sheetxl.ts /path/to/sheetxl/packages/formulas`.
The script omits functions marked hidden/unimplemented and network-dependent functions.
