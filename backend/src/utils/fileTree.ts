import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

const IGNORED_DIRS = ['.git', 'node_modules', '.DS_Store', 'dist'];

export function getFileTree(rootPath: string, currentPath: string): FileTreeNode {
  const relativePath = path.relative(rootPath, currentPath).split(path.sep).join('/');
  const name = path.basename(currentPath);

  if (name === '.') {
    // Root: use git ls-tree to respect .gitignore
    try {
      const output = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], {
        cwd: rootPath,
        encoding: 'utf-8',
      });
      const files = output.split('\0').filter(Boolean);

      const tree: FileTreeNode = {
        name: path.basename(rootPath),
        path: '',
        type: 'directory',
        children: buildTreeFromPaths(files),
      };
      return tree;
    } catch {
      // Fall back to filesystem walk if git fails
    }
  }

  // Fallback: filesystem walk (for non-root or when git fails)
  try {
    const stat = fs.statSync(currentPath);
    if (stat.isFile()) {
      return {
        name,
        path: relativePath,
        type: 'file',
        size: stat.size,
      };
    }
    if (stat.isDirectory()) {
      if (IGNORED_DIRS.includes(name) && currentPath !== rootPath) {
        return { name, path: relativePath, type: 'directory', children: [] };
      }
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      const children = entries
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        })
        .map((entry) => getFileTree(rootPath, path.join(currentPath, entry.name)));
      return { name, path: relativePath, type: 'directory', children };
    }
  } catch {
    // ignore
  }

  return { name, path: relativePath, type: 'file' };
}

function buildTreeFromPaths(filePaths: string[]): FileTreeNode[] {
  const nodeMap = new Map<string, FileTreeNode>();
  const rootChildren: FileTreeNode[] = [];

  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    let currentPath = '';
    let parentChildren = rootChildren;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!nodeMap.has(currentPath)) {
        const node: FileTreeNode = isFile
          ? {
              name: part,
              path: currentPath,
              type: 'file',
            }
          : {
              name: part,
              path: currentPath,
              type: 'directory',
              children: [],
            };
        nodeMap.set(currentPath, node);
        parentChildren.push(node);
      }

      const node = nodeMap.get(currentPath)!;
      if (node.type === 'directory') {
        parentChildren = node.children!;
      }
    }
  }

  rootChildren.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return rootChildren;
}
