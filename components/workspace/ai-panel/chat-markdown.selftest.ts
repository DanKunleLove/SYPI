import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown } from "./chat-markdown";

const render = (children: string) => renderToStaticMarkup(createElement(ChatMarkdown, null, children));
const report = render("## Findings\n\n- **Next.js** detected\n- Database unknown\n\n| Layer | Result |\n| --- | --- |\n| Backend | Unknown |\n\n```ts\nconst saved = true;\n```");
assert.match(report, /<h3[^>]*>Findings<\/h3>/);
assert.match(report, /<ul/);
assert.match(report, /<table/);
assert.match(report, /<pre/);
const unsafe = render('<script>alert(1)</script>\n\n[unsafe](javascript:alert%281%29)\n\n![tracking](https://example.com/pixel)');
assert.doesNotMatch(unsafe, /<script|javascript:|<img/);
assert.match(render('[Evidence](https://example.com)'), /rel="noopener noreferrer"/);
console.log("Chat Markdown: 6 checks passed");
