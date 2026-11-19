import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = join(
  root,
  '.tools',
  'graphify',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
const options = {
  cwd: root,
  windowsHide: true,
  env: {
    ...process.env,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    GRAPHIFY_QUERY_LOG_ENABLE: '0',
  },
};
const run = (command, args) => {
  const result = spawnSync(command, args, { ...options, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};
try {
  if (!existsSync(python)) {
    const candidates = [process.env.GRAPHIFY_PYTHON];
    const installed = process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Python');
    if (process.platform === 'win32' && installed && existsSync(installed))
      for (const dir of readdirSync(installed)
        .filter((name) => name.startsWith('pythoncore-'))
        .sort()
        .reverse())
        candidates.push(join(installed, dir, 'python.exe'));
    candidates.push('python3', 'python');
    const base = candidates
      .filter(Boolean)
      .find(
        (command) =>
          spawnSync(command, ['-c', 'import sys; assert sys.version_info >= (3, 11)'], options)
            .status === 0,
      );
    if (!base)
      throw Error(
        'Không tìm thấy Python 3.11+. Cài Python hoặc đặt GRAPHIFY_PYTHON tới python.exe thật, rồi chạy lại.',
      );
    console.log('Tạo môi trường Graphify riêng trong .tools/graphify…');
    run(base, ['-m', 'venv', join(root, '.tools', 'graphify')]);
  }
  const check = spawnSync(
    python,
    [
      '-c',
      'import importlib.metadata as m; import tree_sitter_sql; assert m.version("graphifyy") == "0.9.108"',
    ],
    options,
  );
  if (check.status !== 0) {
    console.log('Cài Graphify từ requirements của dự án…');
    run(python, [
      '-m',
      'pip',
      'install',
      '--disable-pip-version-check',
      '--cache-dir',
      join(root, '.tools', 'pip-cache'),
      '-r',
      join(root, 'scripts', 'graphify-requirements.txt'),
    ]);
  }
  const output = join(root, 'graphify-out');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, '.graphify_python'), python, 'utf8');
  writeFileSync(join(output, '.graphify_root'), root, 'utf8');
  const args = process.argv.slice(2);
  if (['update', 'watch', 'extract', 'cluster-only'].includes(args[0])) {
    if (!args[1]) args.push(root);
    else if (args[1] === '.') args[1] = root;
  }
  if (args[0] === 'setup')
    run(python, [
      '-c',
      'import sys, importlib.metadata as m; print("Graphify " + m.version("graphifyy")); print(sys.executable)',
    ]);
  else run(python, ['-m', 'graphify', ...(args.length ? args : ['--help'])]);
} catch (error) {
  console.error(`Graphify chưa chạy được: ${error.message}`);
  process.exitCode = 1;
}
