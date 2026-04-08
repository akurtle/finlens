import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const relativePath = specifier.slice(2);
      const basePath = path.resolve(process.cwd(), relativePath);
      const candidates = [
        `${basePath}.ts`,
        `${basePath}.tsx`,
        path.join(basePath, "index.ts"),
        path.join(basePath, "index.tsx")
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          return {
            shortCircuit: true,
            url: pathToFileURL(candidate).href
          };
        }
      }
    }

    return nextResolve(specifier, context);
  }
});
