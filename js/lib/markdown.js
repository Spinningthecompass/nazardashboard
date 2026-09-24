// Minimal markdown -> HTML for the manuals: headings, bold, code, lists, rules, pipe tables.
function mdInline(text){
  let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}
function mdToHtml(md){
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  let listType = null; // 'ul' | 'ol' | null
  const closeList = () => { if (listType){ html += "</" + listType + ">"; listType = null; } };

  const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isTableSep = (l) => /^\s*\|[\s:\-|]+\|\s*$/.test(l);
  const splitCells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());

  while (i < lines.length){
    const line = lines[i];

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])){
      closeList();
      const head = splitCells(line);
      let t = '<div class="md-table-wrap"><table><thead><tr>' + head.map(c => "<th>" + mdInline(c) + "</th>").join("") + "</tr></thead><tbody>";
      i += 2;
      while (i < lines.length && isTableRow(lines[i])){
        const cells = splitCells(lines[i]);
        t += "<tr>" + cells.map(c => "<td>" + mdInline(c) + "</td>").join("") + "</tr>";
        i++;
      }
      t += "</tbody></table></div>";
      html += t;
      continue;
    }

    let m = /^(#{1,4})\s+(.*)$/.exec(line);
    if (m){
      closeList();
      const level = m[1].length + 1; // top md # -> h2, keeps room for one h1 doc title
      html += "<h" + level + ">" + mdInline(m[2]) + "</h" + level + ">";
      i++; continue;
    }

    if (/^\s*---+\s*$/.test(line)){
      closeList();
      html += "<hr>";
      i++; continue;
    }

    m = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (m){
      if (listType !== "ol"){ closeList(); html += "<ol>"; listType = "ol"; }
      html += "<li>" + mdInline(m[2]) + "</li>";
      i++; continue;
    }

    m = /^\s*[-*]\s+(.*)$/.exec(line);
    if (m){
      if (listType !== "ul"){ closeList(); html += "<ul>"; listType = "ul"; }
      html += "<li>" + mdInline(m[1]) + "</li>";
      i++; continue;
    }

    if (/^\s*$/.test(line)){
      closeList();
      i++; continue;
    }

    closeList();
    html += "<p>" + mdInline(line) + "</p>";
    i++;
  }
  closeList();
  return html;
}
