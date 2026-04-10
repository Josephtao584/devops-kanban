import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  isBinary?: boolean;
  children?: FileTreeNode[];
}

const IGNORED_DIRS = ['.git', 'node_modules', '.DS_Store', 'dist'];

function isBinaryFile(filePath: string): boolean {
  const BUFFER_SIZE = 8192;
  const buffer = fs.readFileSync(filePath);
  const slice = buffer.subarray(0, BUFFER_SIZE);

  if (slice.length === 0) return false;
  for (let i = 0; i < slice.length; i++) {
    if (slice[i] === 0) return true;
  }
  return false;
}

export function getFileTree(rootPath: string, currentPath: string): FileTreeNode {
  const stat = fs.statSync(currentPath);
  const name = path.basename(currentPath);
  const relativePath = path.relative(rootPath, currentPath);

  if (stat.isFile()) {
    return {
      name,
      path: relativePath,
      type: 'file',
      size: stat.size,
      isBinary: isBinaryFile(currentPath),
    };
  }

  if (stat.isDirectory()) {
    if (IGNORED_DIRS.includes(name) && currentPath !== rootPath) {
      return {
        name,
        path: relativePath,
        type: 'directory',
        children: [],
      };
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return {
        name,
        path: relativePath,
        type: 'directory',
        children: [],
      };
    }

    const children: FileTreeNode[] = entries
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((entry) => {
        const childPath = path.join(currentPath, entry.name);
        return getFileTree(rootPath, childPath);
      });

    return {
      name,
      path: relativePath,
      type: 'directory',
      children,
    };
  }

  return {
    name,
    path: relativePath,
    type: 'file',
  };
}
