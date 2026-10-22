import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export function readComponentLiteral(root, relativePath, variableName) {
  const filename = path.join(root, relativePath);
  const sourceText = fs.readFileSync(filename, "utf8");
  const sourceFile = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) initializer = declaration.initializer;
    }
  });
  if (!initializer) throw new Error(`Could not find ${variableName} in ${relativePath}`);
  const printed = ts.createPrinter().printNode(ts.EmitHint.Expression, initializer, sourceFile);
  const output = ts.transpileModule(`module.exports = ${printed};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports }, { filename });
  return JSON.parse(JSON.stringify(module.exports));
}
