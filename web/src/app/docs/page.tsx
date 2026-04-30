import { DOCS_MARKDOWN } from "../../lib/docs-content";

export const metadata = {
  title: "Documentation — AgentPassport",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SAFE_LINK_RE = /^(https?:\/\/|\/|#)/;

function processInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );
  html = html.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, label, href) => {
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

      const isSeparator = (line: string) =>
        /^\|[\s:|-]+\|$/.test(line.trim());
      const parseRow = (line: string) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => processInline(cell.trim()));

      const headerIdx = isSeparator(tableLines[1]) ? 0 : -1;
      const bodyRows: string[] = [];
      let headerHtml = "";
      let bodyHtml = "";

      if (headerIdx === 0 && tableLines.length > 1) {
        const cells = parseRow(tableLines[0]);
        headerHtml = `<thead><tr>${cells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
        for (let r = 2; r < tableLines.length; r++) {
          if (!isSeparator(tableLines[r])) {
            const cells = parseRow(tableLines[r]);
            bodyRows.push(
              `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`
            );
          }
        }
        bodyHtml = `<tbody>${bodyRows.join("")}</tbody>`;
        tokens.push(`<table>${headerHtml}${bodyHtml}</table>`);
      } else {
        for (let r = 0; r < tableLines.length; r++) {
          if (!isSeparator(tableLines[r])) {
            const cells = parseRow(tableLines[r]);
            bodyRows.push(
              `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`
            );
          }
        }
        tokens.push(`<table><tbody>${bodyRows.join("")}</tbody></table>`);
      }
      continue;
    }

    if (lines[i].startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(
          `<li>${processInline(lines[i].slice(2))}</li>`
        );
        i++;
      }
      tokens.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    if (lines[i].trim() === "---") {
      tokens.push("<hr />");
      i++;
      continue;
    }

    tokens.push(`<p>${processInline(lines[i])}</p>`);
    i++;
  }

  return tokens.join("\n");
}

export default function DocsPage() {
  const html = markdownToHtml(DOCS_MARKDOWN);
  return (
    <section className="stack-lg">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Documentation</p>
            <h1 className="section-title">AgentPassport Reference</h1>
          </div>
          <a className="text-link" href="/docs.md">Raw markdown</a>
        </div>
        <div className="docs-content" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </section>
  );
}
