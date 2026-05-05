import { readFileSync } from "fs";
import { join } from "path";
import { escapeHtml } from "@/lib/markdown";

const MCP_README = readFileSync(join(process.cwd(), "..", "tools", "agent-passport-mcp", "README.md"), "utf-8");

const SAFE_LINK_RE = /^(https?:\/\/|\/|#)/;

function processInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, label: string, href: string) => {
      if (SAFE_LINK_RE.test(href)) {
        return `<a href="${escapeHtml(href)}">${label}</a>`;
      }
      return label;
    }
  );
  return html;
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const tokens: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].startsWith("```")) {
      const lang = lines[i].slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      tokens.push(
        `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`
      );
      continue;
    }
    if (lines[i].startsWith("# ")) {
      tokens.push(`<h1>${processInline(lines[i].slice(2))}</h1>`);
      i++;
      continue;
    }
    if (lines[i].startsWith("## ")) {
      tokens.push(`<h2>${processInline(lines[i].slice(3))}</h2>`);
      i++;
      continue;
    }
    if (lines[i].startsWith("### ")) {
      tokens.push(`<h3>${processInline(lines[i].slice(4))}</h3>`);
      i++;
      continue;
    }
    if (/^\|/.test(lines[i])) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length === 0) continue;
      const isSeparator = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
      const parseRow = (line: string) =>
        line.split("|").slice(1, -1).map((cell) => processInline(cell.trim()));
      const headerIdx = isSeparator(tableLines[1]) ? 0 : -1;
      let headerHtml = "";
      let bodyHtml = "";
      if (headerIdx === 0 && tableLines.length > 1) {
        const cells = parseRow(tableLines[0]);
        headerHtml = `<thead><tr>${cells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
        for (let r = 2; r < tableLines.length; r++) {
          if (!isSeparator(tableLines[r])) {
            const cells = parseRow(tableLines[r]);
            bodyHtml += `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
          }
        }
        bodyHtml = `<tbody>${bodyHtml}</tbody>`;
        tokens.push(`<table>${headerHtml}${bodyHtml}</table>`);
      } else {
        for (const tl of tableLines) {
          if (!isSeparator(tl)) {
            const cells = parseRow(tl);
            bodyHtml += `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
          }
        }
        tokens.push(`<table><tbody>${bodyHtml}</tbody></table>`);
      }
      continue;
    }
    if (lines[i].startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(`<li>${processInline(lines[i].slice(2))}</li>`);
        i++;
      }
      tokens.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${processInline(lines[i].replace(/^\d+\.\s/, ""))}</li>`);
        i++;
      }
      tokens.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    if (lines[i].trim() === "") { i++; continue; }
    if (lines[i].trim() === "---") { tokens.push("<hr />"); i++; continue; }
    tokens.push(`<p>${processInline(lines[i])}</p>`);
    i++;
  }
  return tokens.join("\n");
}

export default function McpPage() {
  const html = markdownToHtml(MCP_README);
  return (
    <section className="grid gap-6">
      <section className="accent-bar relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-surface/95 to-surface-strong/90 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        <div className="mb-3 flex items-end justify-between gap-4 max-[720px]:grid max-[720px]:gap-2">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-accent [text-shadow:0_0_12px_rgba(245,158,11,0.25)]">Developer Tools</p>
            <h1 className="font-heading text-2xl leading-tight text-foreground">MCP Server Setup</h1>
          </div>
          <div className="flex items-center gap-3">
            <a className="w-fit font-semibold text-accent transition-all hover:text-[#FBBF24] hover:[text-shadow:0_0_12px_rgba(245,158,11,0.3)] outline-none" href="/SKILL.md">
              AI Agent Skill
            </a>
          </div>
        </div>
        <div className="docs-content" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </section>
  );
}
