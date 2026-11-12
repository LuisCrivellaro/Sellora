/** Destaque de sintaxe mínimo para HTML, CSS e JS (sem dependências). Divide em linhas preservando comentários de várias linhas. */
export type TokenKind = "plain" | "comment" | "tag" | "attr" | "string" | "keyword" | "number" | "property" | "selector" | "punct";
export interface Token { kind: TokenKind; text: string }

const RULES: Record<"html" | "css" | "js", [RegExp, TokenKind][]> = {
  html: [
    [/<!--[\s\S]*?-->/y, "comment"],
    [/<\/?[a-zA-Z][\w:-]*|\/?>/y, "tag"],
    [/"[^"]*"|'[^']*'/y, "string"],
    [/\b[a-zA-Z_:][\w:.-]*(?==)/y, "attr"],
    [/&[a-z#0-9]+;/y, "keyword"],
  ],
  css: [
    [/\/\*[\s\S]*?\*\//y, "comment"],
    [/"[^"]*"|'[^']*'/y, "string"],
    [/@[a-z-]+/y, "keyword"],
    [/--?[a-zA-Z][\w-]*(?=\s*:)/y, "property"],
    [/#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(px|rem|em|%|vh|vw|svh|dvh|ms|s|deg|fr|ch)?\b/y, "number"],
    [/[{}();,:]/y, "punct"],
    [/[.#]?[a-zA-Z_][\w-]*(?=[^{};]*\{)/y, "selector"],
  ],
  js: [
    [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, "comment"],
    [/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y, "string"],
    [/\b(const|let|var|function|return|if|else|for|of|in|while|new|class|import|export|from|async|await|try|catch|true|false|null|undefined|this|document|window)\b/y, "keyword"],
    [/\b\d+(\.\d+)?\b/y, "number"],
    [/[{}()[\];,.=<>!+\-*/&|?:]/y, "punct"],
  ],
};

export function languageOf(path: string): "html" | "css" | "js" | null {
  if (path.endsWith(".html") || path.endsWith(".svg")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  return null;
}

export function tokenize(source: string, language: "html" | "css" | "js"): Token[] {
  const tokens: Token[] = [];
  const rules = RULES[language];
  let index = 0;
  let plain = "";
  const flush = () => { if (plain) { tokens.push({ kind: "plain", text: plain }); plain = ""; } };
  outer: while (index < source.length) {
    for (const [pattern, kind] of rules) {
      pattern.lastIndex = index;
      const match = pattern.exec(source);
      if (match && match[0].length) { flush(); tokens.push({ kind, text: match[0] }); index += match[0].length; continue outer; }
    }
    plain += source[index];
    index += 1;
  }
  flush();
  return tokens;
}

/** Linhas prontas para renderizar: cada linha é uma lista de tokens. */
export function highlightLines(source: string, language: "html" | "css" | "js" | null): Token[][] {
  const tokens = language ? tokenize(source, language) : [{ kind: "plain" as const, text: source }];
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ kind: token.kind, text: part });
    });
  }
  return lines;
}
