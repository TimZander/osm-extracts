// Requirements: "Publishing replaces the site with one orphan commit", "The previous site is read from
// the data branch". Runs src/fetch-previous.sh and src/publish.sh against a local bare repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname
const tmp = () => mkdtempSync(join(tmpdir(), 'osm-pub-'))
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function setup() {
  const d = tmp()
  const remote = join(d, 'remote.git')
  git(d, 'init', '-q', '--bare', remote)
  const work = join(d, 'work')
  git(d, 'init', '-q', work)
  git(work, 'remote', 'add', 'origin', remote)
  return { d, remote, work }
}

function seedData(d, remote, files) {
  const seed = join(d, 'seed')
  git(d, 'init', '-q', seed)
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(join(seed, p, '..'), { recursive: true })
    writeFileSync(join(seed, p), t)
  }
  git(seed, 'add', '-A')
  git(seed, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'seed')
  git(seed, 'push', '-q', remote, '+HEAD:refs/heads/data')
  return git(seed, 'rev-parse', 'HEAD')
}

function sh(cwd, script, args, env = {}) {
  const output = join(cwd, '..', `gh-output-${Math.random()}`)
  writeFileSync(output, '')
  const r = spawnSync('bash', [join(SRC, script), ...args], { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: output, ...env } })
  return { ...r, outputs: Object.fromEntries(readFileSync(output, 'utf8').split('\n').filter(Boolean).map((l) => l.split('='))) }
}

function site(d, files) {
  const s = join(d, `site-${Math.random()}`)
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(join(s, p, '..'), { recursive: true })
    writeFileSync(join(s, p), t)
  }
  return s
}

const pushEnv = { GITHUB_TOKEN: 'dummy-token-for-tests' }

// Manifests of the manifest's form: one listing a region, and one listing none.
const region = (dataDate) => ({ id: 'colorado', name: 'Colorado', bounds: { south: 37.01, west: -109.04, north: 40.99, east: -102.06 }, dataDate, cells: ['158_-425'], split: [] })
const manifest = (dataDate = '2026-10-28') => JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL)', categoriesFrom: 'x', regions: [region(dataDate)] }) + '\n'
const EMPTY = JSON.stringify({ attribution: '© OpenStreetMap contributors (ODbL)', categoriesFrom: 'x', regions: [] }) + '\n'

test('the placeholder branch is read as the previous tree', () => {
  const { d, remote, work } = setup()
  seedData(d, remote, { 'index.html': 'placeholder', '404.html': 'x' })
  const prev = join(d, 'prev')
  const r = sh(work, 'fetch-previous.sh', [prev])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readdirSync(prev).sort(), ['404.html', 'index.html'])
})

test('no data branch yet: an empty previous tree', () => {
  const { d, work } = setup()
  const prev = join(d, 'prev')
  const r = sh(work, 'fetch-previous.sh', [prev])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readdirSync(prev), [])
})

test('a data branch that can\'t be read fails', () => {
  const { d, work } = setup()
  git(work, 'remote', 'set-url', 'origin', join(d, 'no-such-remote.git'))
  const r = sh(work, 'fetch-previous.sh', [join(d, 'prev')])
  assert.notEqual(r.status, 0)
  assert.match(r.stdout + r.stderr, /Couldn't read the data branch/)
})

test('a changed tree becomes one parentless commit on data', () => {
  const { d, remote, work } = setup()
  const old = seedData(d, remote, { 'index.html': 'placeholder' })
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  const s = site(d, { 'manifest.json': manifest(), 'colorado/158_-425.json': '{"a":1}\n', '_headers': 'h\n' })
  const prep = sh(work, 'publish.sh', ['prepare', s])
  assert.equal(prep.status, 0, prep.stderr)
  assert.equal(prep.outputs.changed, 'true')
  const push = sh(work, 'publish.sh', ['push'], pushEnv)
  assert.equal(push.status, 0, push.stderr)
  const head = git(remote, 'rev-parse', 'refs/heads/data')
  assert.notEqual(head, old)
  assert.equal(git(remote, 'rev-list', '--count', 'refs/heads/data'), '1')
  assert.equal(git(remote, 'log', '-1', '--format=%P', 'refs/heads/data'), '')
  assert.deepEqual(git(remote, 'ls-tree', '-r', '--name-only', 'refs/heads/data').split('\n').sort(), ['_headers', 'colorado/158_-425.json', 'manifest.json'])
  assert.equal(git(remote, 'show', 'refs/heads/data:colorado/158_-425.json'), '{"a":1}')
})

test('an unchanged tree pushes nothing, and says so', () => {
  const { d, remote, work } = setup()
  const files = { 'manifest.json': manifest(), 'colorado/1_1.json': 'x\n' }
  const old = seedData(d, remote, files)
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  const prep = sh(work, 'publish.sh', ['prepare', site(d, files)])
  assert.equal(prep.status, 0, prep.stderr)
  assert.equal(prep.outputs.changed, 'false')
  assert.match(prep.stdout, /unchanged/i)
  assert.equal(git(remote, 'rev-parse', 'refs/heads/data'), old)
})

test('a push whose lease is stale is rejected, and data stays as it was', () => {
  const { d, remote, work } = setup()
  seedData(d, remote, { 'index.html': 'placeholder' })
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  assert.equal(sh(work, 'publish.sh', ['prepare', site(d, { 'manifest.json': manifest('2026-11-02') })]).status, 0)
  // Someone else moves data after this run read it.
  mkdirSync(join(d, 'other'))
  const theirs = seedData(join(d, 'other'), remote, { 'manifest.json': manifest('2026-11-01') })
  const push = sh(work, 'publish.sh', ['push'], pushEnv)
  assert.notEqual(push.status, 0)
  assert.equal(git(remote, 'rev-parse', 'refs/heads/data'), theirs)
})

test('push refuses to run without a token, and stores none in the git config', () => {
  const { d, remote, work } = setup()
  seedData(d, remote, { 'index.html': 'placeholder' })
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  assert.equal(sh(work, 'publish.sh', ['prepare', site(d, { 'manifest.json': manifest('2026-11-02') })]).status, 0)
  const noToken = sh(work, 'publish.sh', ['push'], { GITHUB_TOKEN: '' })
  assert.notEqual(noToken.status, 0)
  assert.equal(sh(work, 'publish.sh', ['push'], pushEnv).status, 0)
  assert.ok(!readFileSync(join(work, '.git', 'config'), 'utf8').includes('dummy-token'))
  assert.ok(!existsSync(join(work, '.git', 'credentials')))
})

// Requirement: "Publishing replaces the site with one orphan commit" (no empty push).
test('a manifest listing no region pushes nothing, even when the tree changed', () => {
  const { d, remote, work } = setup()
  const old = seedData(d, remote, { 'index.html': 'placeholder' })
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  const prep = sh(work, 'publish.sh', ['prepare', site(d, { 'manifest.json': EMPTY, '_headers': 'h\n' })])
  assert.equal(prep.status, 0, prep.stderr)
  assert.equal(prep.outputs.changed, 'false')
  assert.match(prep.stdout, /lists no region/)
  assert.equal(git(remote, 'rev-parse', 'refs/heads/data'), old)
})

test('a manifest listing no region logs that reason, even when the tree is unchanged', () => {
  const { d, remote, work } = setup()
  const files = { 'manifest.json': EMPTY, '_headers': 'h\n' }
  seedData(d, remote, files)
  assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
  const prep = sh(work, 'publish.sh', ['prepare', site(d, files)])
  assert.equal(prep.status, 0, prep.stderr)
  assert.equal(prep.outputs.changed, 'false')
  assert.match(prep.stdout, /lists no region/)
  assert.doesNotMatch(prep.stdout, /unchanged/)
})

test('a site without a manifest of the manifest\'s form fails, unpushed', () => {
  for (const [what, files] of [
    ['missing', { '_headers': 'h\n' }],
    ['not JSON', { 'manifest.json': 'new\n' }],
    ['{}', { 'manifest.json': '{}\n' }],
  ]) {
    const { d, remote, work } = setup()
    const old = seedData(d, remote, { 'index.html': 'placeholder' })
    assert.equal(sh(work, 'fetch-previous.sh', [join(d, 'prev')]).status, 0)
    const prep = sh(work, 'publish.sh', ['prepare', site(d, files)])
    assert.notEqual(prep.status, 0, what)
    assert.notEqual(prep.outputs.changed, 'true', what)
    assert.equal(git(remote, 'rev-parse', 'refs/heads/data'), old, what)
  }
})
