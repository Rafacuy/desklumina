import { escapeHtml } from "./format";

function stripTags(s: string): string {
  let out = "";
  let insideTag = false;
  for (const ch of s) {
    if (ch === "<") {
      insideTag = true;
    } else if (ch === ">") {
      insideTag = false;
    } else if (!insideTag) {
      out += ch;
    }
  }
  return out;
}

export function markdownToPango(text: string): string {
  if (!text) {
    return "";
  }

  const codeBlocks: string[] = [];
  const rawPangoBlocks: string[] = [];

  // Extract raw Pango blocks (e.g. from ToolDisplay) to prevent double escaping
  let result = text.replace(/\x03([\s\S]*?)\x04/g, (match, p1) => {
    rawPangoBlocks.push(p1);
    return `\x05${rawPangoBlocks.length - 1}\x06`;
  });

  // Extract multiline code blocks (with or without language specifier)
  result = result.replace(/```\w*\n([\s\S]*?)```/g, (match, p1) => {
    codeBlocks.push(escapeHtml(p1));
    return `\x01${codeBlocks.length - 1}\x02`;
  });

  // Extract code blocks without newline
  result = result.replace(/```([\s\S]*?)```/g, (match, p1) => {
    codeBlocks.push(escapeHtml(p1));
    return `\x01${codeBlocks.length - 1}\x02`;
  });

  // Extract inline code
  result = result.replace(/`([^`]+)`/g, (match, p1) => {
    codeBlocks.push(escapeHtml(p1));
    return `\x01${codeBlocks.length - 1}\x02`;
  });

  result = escapeHtml(result);

  // Line-level formatting (Headings, Lists)
  // Process these first so they don't break inline formats if they somehow overlap.
  result = result.replace(/^#+\s+(.*)$/gm, '<span weight="bold" size="large">$1</span>');
  result = result.replace(/^(\s*)[-*]\s+(.*)$/gm, "$1  • $2");

  // Bold + Italic (Nested)
  result = result.replace(/\*\*\*(((?!\n\n)[\s\S])+?)\*\*\*/g, "<b><i>$1</i></b>");
  result = result.replace(/___(((?!\n\n)[\s\S])+?)___/g, "<b><i>$1</i></b>");

  // Bold
  result = result.replace(/\*\*(((?!\n\n)[\s\S])+?)\*\*/g, "<b>$1</b>");
  result = result.replace(/__(((?!\n\n)[\s\S])+?)__/g, "<b>$1</b>");

  // Italic
  // Use negative lookbehinds/lookaheads to prevent matching inner/outer parts of existing asterisks
  result = result.replace(/(?<!\*)\*(((?!\n\n)[\s\S])+?)\*(?!\*)/g, "<i>$1</i>");
  result = result.replace(/(?<!_)_(((?!\n\n)[\s\S])+?)_(?!_)/g, "<i>$1</i>");

  // Restore code blocks safely after all formatting is done
  result = result.replace(/\x01(\d+)\x02/g, (match, p1) => {
    const block = codeBlocks[parseInt(p1, 10)];
    return block !== undefined ? `<tt>${block}</tt>` : match;
  });

  // Restore raw Pango blocks
  result = result.replace(/\x05(\d+)\x06/g, (match, p1) => {
    const block = rawPangoBlocks[parseInt(p1, 10)];
    return block !== undefined ? block : match;
  });

  return result;
}

export function wrapPangoText(text: string, width: number): string[] {
  if (!text) return [""];
  
  const result: string[] = [];
  let currentLine = "";
  let currentWidth = 0;
  
  const openTags: string[] = [];
  
  const tokenRegex = /(<\/?[a-zA-Z0-9]+[^>]*>|&[a-z]+;|&#[0-9]+;|&#x[0-9a-fA-F]+;|[\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\u3000-\u303f]|[^\s\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff\u3000-\u303f<>&]+|[ \t]+|\n|\r)/g;
  
  const tokens = text.match(tokenRegex) || [];
  
  function getClosingTag(openingTag: string): string {
    const match = openingTag.match(/^<([a-zA-Z0-9]+)/);
    return match ? `</${match[1]}>` : "";
  }
  
  function closeAllTags(): string {
    let res = "";
    for (let i = openTags.length - 1; i >= 0; i--) {
      const tag = openTags[i];
      if (tag) {
        res += getClosingTag(tag);
      }
    }
    return res;
  }
  
  function openAllTags(): string {
    return openTags.join("");
  }

  currentLine = openAllTags();
  
  for (const token of tokens) {
    if (token.startsWith("<") && token.endsWith(">")) {
      if (token.startsWith("</")) {
        const tagName = token.match(/^<\/([a-zA-Z0-9]+)>/)?.[1];
        if (tagName) {
          for (let j = openTags.length - 1; j >= 0; j--) {
            if (openTags[j]?.startsWith(`<${tagName}`)) {
              openTags.splice(j, 1);
              break;
            }
          }
        }
      } else {
        openTags.push(token);
      }
      currentLine += token;
      continue;
    }
    
    if (token === "\n" || token === "\r") {
      currentLine += closeAllTags();
      result.push(currentLine);
      currentLine = openAllTags();
      currentWidth = 0;
      continue;
    }
    
    let tokenWidth = 0;
    if (token.startsWith("&") && token.endsWith(";")) {
      tokenWidth = 1;
    } else {
      tokenWidth = Array.from(token).reduce((sum, char) => 
        sum + (/[^\x00-\xff]/.test(char) ? 2 : 1), 0);
    }
    
    if (currentWidth + tokenWidth > width) {
      if (stripTags(currentLine).trim() || currentWidth > 0) {
        currentLine += closeAllTags();
        result.push(currentLine.trimEnd());
        currentLine = openAllTags();
        currentWidth = 0;
      }
      
      if (tokenWidth > width && !/^[ \t]+$/.test(token) && !token.startsWith("&")) {
        const chars = Array.from(token);
        for (const char of chars) {
          const charW = /[^\x00-\xff]/.test(char) ? 2 : 1;
          if (currentWidth + charW > width) {
            currentLine += closeAllTags();
            result.push(currentLine);
            currentLine = openAllTags() + char;
            currentWidth = charW;
          } else {
            currentLine += char;
            currentWidth += charW;
          }
        }
      } else {
        if (/^[ \t]+$/.test(token)) {
          // ignore leading spaces on new line
        } else {
          currentLine += token;
          currentWidth += tokenWidth;
        }
      }
    } else {
      currentLine += token;
      currentWidth += tokenWidth;
    }
  }
  
  if (stripTags(currentLine).trim() || currentWidth > 0) {
    currentLine += closeAllTags();
    result.push(currentLine.trimEnd());
  } else if (result.length === 0) {
    result.push("");
  }
  
  return result;
}

