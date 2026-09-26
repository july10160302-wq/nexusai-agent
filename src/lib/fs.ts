/**
 * 工作区文件系统 —— 基于 File System Access API。
 * 用户授权一个本地文件夹后，Agent 即可在其中读写文件（Codex 式工作区）。
 * 句柄保存在内存中，刷新页面后需重新授权。
 */

let root: FileSystemDirectoryHandle | null = null;
let rootName = '';

export function getWorkspaceName(): string | null {
  return root ? rootName : null;
}

export async function pickWorkspace(): Promise<string> {
  const picker = (window as unknown as Record<string, unknown>).showDirectoryPicker as
    | ((opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>)
    | undefined;
  if (!picker) {
    throw new Error('当前浏览器不支持文件夹访问（File System Access API），请使用 Chrome 或 Edge');
  }
  root = await picker({ mode: 'readwrite' });
  rootName = root.name;
  return rootName;
}

function segs(path: string): string[] {
  return path
    .split(/[\\/]+/)
    .filter(Boolean)
    .filter((s) => s !== '.' && s !== '..');
}

async function resolveDir(path: string[], create = false): Promise<FileSystemDirectoryHandle> {
  if (!root) throw new Error('尚未绑定工作区文件夹，请先在「设置」页选择文件夹');
  let dir = root;
  for (const s of path) {
    dir = await dir.getDirectoryHandle(s, { create });
  }
  return dir;
}

export async function fsList(path = '.'): Promise<string> {
  const dir = await resolveDir(segs(path));
  const out: string[] = [];
  const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iterable) {
    out.push(handle.kind === 'directory' ? `${name}/` : name);
  }
  return out.sort().join('\n') || '（空目录）';
}

export async function fsRead(path: string): Promise<string> {
  const parts = segs(path);
  const file = parts.pop();
  if (!file) throw new Error('缺少文件名');
  const dir = await resolveDir(parts);
  const fh = await dir.getFileHandle(file);
  const f = await fh.getFile();
  if (f.size > 512 * 1024) throw new Error('文件过大（超过 512KB），请分段处理');
  return await f.text();
}

export async function fsWrite(path: string, content: string): Promise<string> {
  const parts = segs(path);
  const file = parts.pop();
  if (!file) throw new Error('缺少文件名');
  const dir = await resolveDir(parts, true);
  const fh = await dir.getFileHandle(file, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
  return `已写入 ${path}（${content.length} 字符）`;
}

export async function fsDelete(path: string): Promise<string> {
  const parts = segs(path);
  const name = parts.pop();
  if (!name) throw new Error('缺少路径');
  const dir = await resolveDir(parts);
  await dir.removeEntry(name, { recursive: true });
  return `已删除 ${path}`;
}

export async function fsMkdir(path: string): Promise<string> {
  await resolveDir(segs(path), true);
  return `已创建目录 ${path}`;
}

/** 递归列出工作区中的文件（相对路径），用于 @ 文件引用 */
export async function fsWalk(maxDepth = 3, maxFiles = 300): Promise<string[]> {
  if (!root) throw new Error('尚未绑定工作区文件夹，请先在「设置」页选择文件夹');
  const out: string[] = [];
  async function walk(dir: FileSystemDirectoryHandle, prefix: string, depth: number) {
    if (depth > maxDepth || out.length >= maxFiles) return;
    const iterable = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
    for await (const [name, handle] of iterable) {
      if (out.length >= maxFiles) return;
      if (name.startsWith('.') || name === 'node_modules') continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        await walk(handle as FileSystemDirectoryHandle, rel, depth + 1);
      } else {
        out.push(rel);
      }
    }
  }
  await walk(root, '', 1);
  return out.sort();
}
