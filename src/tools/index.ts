/**
 * Tools module exports
 */

export { dispatch } from "./registry";
export { execute } from "./frameworks/terminal";
export { launch, lookup } from "./frameworks/apps";
export { fileOp } from "./frameworks/files";
export { handleFileManagement, parseFileManagementCommand, parseQuotedArgs } from "./frameworks/file-management";
export { music } from "./frameworks/music";
export { clipboard } from "./frameworks/clipboard";
export { notify } from "./frameworks/notify";
