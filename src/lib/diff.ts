/** 简单行级 diff（LCS），用于 fs_write 审批时预览改动 */

export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

export function diffLines(oldText: string, newText: string, maxLines = 300): DiffLine[] {
  const al = oldText.split('\n').slice(0, maxLines);
  const bl = newText.split('\n').slice(0, maxLines);
  const n = al.length;
  const m = bl.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = al[i] === bl[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (al[i] === bl[j]) {
      out.push({ type: 'same', text: al[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: al[i] });
      i++;
    } else {
      out.push({ type: 'add', text: bl[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: al[i++] });
  while (j < m) out.push({ type: 'add', text: bl[j++] });
  return out;
}

/** 折叠未改动区域，只保留改动处上下 context 行 */
export function collapseDiff(lines: DiffLine[], context = 2): (DiffLine | { type: 'gap' })[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, i) => {
    if (l.type !== 'same') {
      for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) {
        keep[k] = true;
      }
    }
  });
  const out: (DiffLine | { type: 'gap' })[] = [];
  let gap = false;
  lines.forEach((l, i) => {
    if (keep[i]) {
      out.push(l);
      gap = false;
    } else if (!gap) {
      out.push({ type: 'gap' });
      gap = true;
    }
  });
  return out;
}
