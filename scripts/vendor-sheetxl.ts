// Rebuild only the open formula sources. No SheetXL SDK or UI is imported.
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: bun scripts/vendor-sheetxl.ts /path/to/pinned-sheetxl/packages/formulas",
  );
const target = path.resolve(
  import.meta.dirname,
  "../packages/spreadsheet/src/vendor/sheetxl",
);
const glob = new Bun.Glob("**/*.ts");
const imports: string[] = [],
  entries: string[] = [];
let count = 0;
for await (const file of glob.scan(path.join(source, "src"))) {
  if (
    file === "index.ts" ||
    file.startsWith("testing/") ||
    file.startsWith("cube/") ||
    file.startsWith("web/")
  )
    continue;
  const text = await readFile(path.join(source, "src", file), "utf8");
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const module = `m${imports.length}`;
  imports.push(
    `import * as ${module} from './${file.replace(/\.ts$/, ".js")}';`,
  );
  for (const statement of ast.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      !statement.name ||
      !statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      continue;
    const comment = text.slice(statement.getFullStart(), statement.getStart());
    if (/@hidden|Unimplemented/i.test(comment)) continue;
    const name = /@name\s+([^\s*]+)/.exec(comment)?.[1] ?? statement.name.text;
    const parameters = statement.parameters.map((parameter) => ({
      type: parameter.type?.getText(ast) ?? "any",
      rest: !!parameter.dotDotDotToken,
      optional:
        !!parameter.questionToken ||
        !!parameter.initializer ||
        !!parameter.dotDotDotToken,
    }));
    entries.push(
      `${JSON.stringify(name.toUpperCase())}: { fn: ${module}.${statement.name.text}, parameters: ${JSON.stringify(parameters)} }`,
    );
    count++;
  }
  const output = path.join(target, file.replace(/\.ts$/, ".js"));
  await mkdir(path.dirname(output), { recursive: true });
  const outputText = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  }).outputText;
  await writeFile(
    output,
    `// SheetXL formula sources, pinned at 0e96d8b38a7f6893b6ee10b043225c8ea4fc22a5. See NOTICE.md.\n${outputText}`,
  );
}
await writeFile(
  path.join(target, "registry.js"),
  `${imports.join("\n")}\nexport const functions = {\n${entries.join(",\n")}\n};\n`,
);
await writeFile(
  path.join(target, "registry.d.ts"),
  "export const functions: Record<string, {fn: (...args: any[]) => any; parameters: {type: string; rest: boolean; optional: boolean}[]}>;\n",
);
await cp(
  path.join(source, "README.md"),
  path.join(target, "UPSTREAM-README.md"),
);
await cp(
  path.join(source, "publish/LICENSE.md"),
  path.join(target, "LICENSE.md"),
).catch(() =>
  cp(
    path.resolve(
      import.meta.dirname,
      "../packages/spreadsheet/node_modules/@sheetxl/formulas/LICENSE.md",
    ),
    path.join(target, "LICENSE.md"),
  ),
);
console.log(`Generated bindings for ${count} implemented SheetXL functions.`);
