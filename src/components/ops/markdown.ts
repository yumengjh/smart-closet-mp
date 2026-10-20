/** Deliberately small Markdown subset. Raw HTML and images are always plain text; no remote or executable nodes. */
export type RichNode = { type: 'text'; text: string } | { name: string; attrs?: Record<string, string>; children: RichNode[] }
const text = (value: string): RichNode => ({ type: 'text', text: value })
function inline(value: string): RichNode[] {
  const nodes: RichNode[] = [], re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\s)]+\))/g
  let index = 0, match: RegExpExecArray | null
  while ((match = re.exec(value))) {
    if (match.index > index) nodes.push(text(value.slice(index, match.index)))
    const token = match[0]
    if (token.startsWith('`')) nodes.push({ name:'code', attrs: { style:'background:#f5f6f8;' }, children:[text(token.slice(1,-1))] })
    else if (token.startsWith('**')) nodes.push({ name:'strong', children:[text(token.slice(2,-2))] })
    else { const link = token.match(/^\[([^\]]+)\]\((.+)\)$/)!; nodes.push(text(`${link[1]}（${link[2]}）`)) }
    index = re.lastIndex
  }
  if (index < value.length) nodes.push(text(value.slice(index)))
  return nodes
}
export function markdownNodes(markdown: string): RichNode[] {
  const nodes: RichNode[] = []
  let code: string[] | null = null, list: RichNode | null = null
  for (const line of markdown.replace(/\r\n?/g,'\n').split('\n')) {
    if (/^```/.test(line)) { if (code) { nodes.push({ name:'pre', attrs:{ style:'white-space:pre-wrap;background:#f5f6f8;padding:16rpx;' }, children:[text(code.join('\n'))] }); code = null } else { code = []; list = null }; continue }
    if (code) { code.push(line); continue }
    if (!line.trim()) { list = null; continue }
    const heading = line.match(/^(#{1,6})\s+(.+)$/), bullet = line.match(/^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/)
    if (heading) { list = null; nodes.push({ name:`h${heading[1].length}`, attrs:{ style:'font-weight:600;line-height:1.5;margin:28rpx 0 16rpx;' }, children:inline(heading[2]) }) }
    else if (bullet) {
      const name = /^\s*\d+\./.test(line) ? 'ol' : 'ul'
      if (!list || !('name' in list) || list.name !== name) { list = { name, children:[] }; nodes.push(list) }
      if ('children' in list) list.children.push({ name:'li', children:inline(bullet[1]) })
    } else { list = null; nodes.push({ name: line.startsWith('> ') ? 'blockquote' : 'p', attrs:{ style:'line-height:1.9;margin:14rpx 0;word-break:break-word;' }, children:inline(line.replace(/^> /,'')) }) }
  }
  if (code) nodes.push({ name:'pre', children:[text(code.join('\n'))] })
  return nodes
}
