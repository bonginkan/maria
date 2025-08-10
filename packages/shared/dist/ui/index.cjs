var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ui/index.ts
var ui_exports = {};
__export(ui_exports, {
  cn: () => cn,
  componentsPlaceholder: () => componentsPlaceholder,
  hooksPlaceholder: () => hooksPlaceholder
});
module.exports = __toCommonJS(ui_exports);

// src/ui/components.ts
var componentsPlaceholder = "ui-components";

// src/ui/hooks.ts
var hooksPlaceholder = "ui-hooks";

// src/ui/lib.ts
var import_clsx = require("clsx");
function cn(...inputs) {
  return (0, import_clsx.clsx)(inputs);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  cn,
  componentsPlaceholder,
  hooksPlaceholder
});
//# sourceMappingURL=index.cjs.map