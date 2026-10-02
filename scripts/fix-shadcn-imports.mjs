// Fixes the import paths emitted by the raw shadcn registry payloads:
//  - `from "cn"`                                -> `from "@/lib/utils"`
//  - `@/registry/radix-nova/ui/x`               -> `@/components/ui/x`
//  - `@/app/(create)/components/icon-placeholder` -> local lucide shim
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "src/components/ui";
let changed = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
  const p = join(dir, file);
  let src = readFileSync(p, "utf8");
  const before = src;
  src = src.replaceAll('from "cn"', 'from "@/lib/utils"');
  src = src.replaceAll('"@/registry/radix-nova/ui/', '"@/components/ui/');
  src = src.replaceAll('from "@/app/(create)/components/icon-placeholder"', 'from "@/components/ui/icon-placeholder"');
  if (src !== before) {
    writeFileSync(p, src);
    changed++;
    console.log("fixed", file);
  }
}
console.log(`done: ${changed} files`);