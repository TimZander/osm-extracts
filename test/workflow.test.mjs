// Reads .github/workflows/extract.yml. Requirements: "The extract is rebuilt weekly and on demand",
// "Nothing a pull request or a fork can cause runs the workflow", "The regions list", "A region job
// hands its tree to the deploy job and writes nothing", "A failed region keeps its previous files",
// "Publishing replaces the site with one orphan commit", "Only the deploy job can write the
// repository", "The workflow uses no secret and only pinned actions".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const text = readFileSync(new URL('../.github/workflows/extract.yml', import.meta.url), 'utf8')
const wf = parse(text)
const jobs = wf.jobs
const steps = (job) => jobs[job].steps

// The pins, resolved with `git ls-remote` on 2026-11-07 (design decision 7).
const PINS = {
  'actions/checkout': '3d3c42e5aac5ba805825da76410c181273ba90b1', // v7.0.1
  'actions/upload-artifact': 'cf430e030ddbb5b0abf93d22962f4752f3646cd9', // v7.0.2
  'actions/download-artifact': '9000827ccba6bdab643e8b6fd33ac0654aef8333', // v8.0.2
}

test('triggers: a weekly schedule and a hand start with no inputs, nothing else', () => {
  assert.deepEqual(Object.keys(wf.on).sort(), ['schedule', 'workflow_dispatch'])
  assert.equal(wf.on.schedule.length, 1)
  assert.match(wf.on.schedule[0].cron, /^\d+ \d+ \* \* [0-6]$/)
  assert.ok(wf.on.workflow_dispatch === null || Object.keys(wf.on.workflow_dispatch).length === 0)
})

test('jobs: plan, one region job per listed region, deploy', () => {
  assert.deepEqual(Object.keys(jobs), ['plan', 'region', 'deploy'])
  assert.match(jobs.plan.steps.at(-1).run, /node src\/plan\.mjs >> "\$GITHUB_OUTPUT"/)
  assert.equal(jobs.plan.outputs.regions, `\${{ steps.${jobs.plan.steps.at(-1).id}.outputs.regions }}`)
  assert.equal(jobs.region.needs, 'plan')
  assert.equal(jobs.region.strategy['fail-fast'], false)
  assert.equal(jobs.region.strategy.matrix.region, '${{ fromJSON(needs.plan.outputs.regions) }}')
  assert.deepEqual(jobs.deploy.needs, ['plan', 'region'])
  assert.equal(jobs.deploy.if, "${{ !cancelled() && needs.plan.result == 'success' }}")
})

test('a region uploads its artifact as its last step, kept one day', () => {
  const up = steps('region').at(-1)
  assert.ok(up.uses.startsWith('actions/upload-artifact@'))
  assert.equal(up.with.name, 'region-${{ matrix.region }}')
  assert.equal(up.with['retention-days'], 1)
  assert.equal(up.with['if-no-files-found'], 'error')
  const build = steps('region').find((s) => s.run && s.run.includes('build-region.mjs'))
  assert.equal(build.env.REGION, '${{ matrix.region }}')
  assert.match(build.run, /--out "\$RUNNER_TEMP\/out\/region-\$REGION"/)
  assert.equal(up.with.path, '${{ runner.temp }}/out/')
})

test('the deploy job downloads every region artifact without a token, and pushes only on a change', () => {
  const dl = steps('deploy').find((s) => s.uses?.startsWith('actions/download-artifact@'))
  assert.equal(dl.with.pattern, 'region-*')
  assert.ok(!('github-token' in dl.with))
  assert.ok(!('merge-multiple' in dl.with))
  const prepare = steps('deploy').find((s) => s.run?.includes('publish.sh prepare'))
  const push = steps('deploy').at(-1)
  assert.match(push.run, /publish\.sh push/)
  assert.equal(push.if, `steps.${prepare.id}.outputs.changed == 'true'`)
})

test('permissions: read everywhere, contents: write only on the deploy job', () => {
  assert.deepEqual(wf.permissions, { contents: 'read' })
  assert.deepEqual(jobs.plan.permissions, { contents: 'read' })
  assert.deepEqual(jobs.region.permissions, { contents: 'read' })
  assert.deepEqual(jobs.deploy.permissions, { contents: 'write' })
})

test('every checkout keeps no credential', () => {
  for (const job of Object.keys(jobs)) {
    const cos = steps(job).filter((s) => s.uses?.startsWith('actions/checkout@'))
    assert.equal(cos.length, 1, job)
    assert.equal(cos[0].with['persist-credentials'], false, job)
  }
})

test('github.token reaches only the push step', () => {
  const uses = [...text.matchAll(/github\.token/g)]
  assert.equal(uses.length, 1)
  assert.equal(steps('deploy').at(-1).env.GITHUB_TOKEN, '${{ github.token }}')
  for (const job of Object.keys(jobs)) {
    for (const s of steps(job)) {
      if (s === steps('deploy').at(-1)) continue
      assert.ok(!JSON.stringify(s).includes('token'), `${job}: ${s.name ?? s.uses}`)
    }
  }
})

test('only GitHub\'s own actions, pinned by SHA', () => {
  for (const job of Object.keys(jobs)) {
    for (const s of steps(job)) {
      if (!s.uses) continue
      const [name, ref] = s.uses.split('@')
      assert.equal(PINS[name], ref, s.uses)
    }
  }
})

test('no secret, no step debug, no expression inside a run script', () => {
  assert.ok(!/secrets\./.test(text))
  assert.ok(!/ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/.test(text))
  for (const job of Object.keys(jobs)) {
    for (const s of steps(job)) if (s.run) assert.ok(!s.run.includes('${{'), `${job}: ${s.name}`)
  }
})

test('one concurrency group, never cancelling a run in progress', () => {
  assert.equal(typeof wf.concurrency.group, 'string')
  assert.ok(!wf.concurrency.group.includes('${{'))
  assert.equal(wf.concurrency['cancel-in-progress'], false)
})

test('every job runs on a pinned image with its time limit', () => {
  for (const job of Object.keys(jobs)) assert.equal(jobs[job]['runs-on'], 'ubuntu-24.04', job)
  assert.equal(jobs.plan['timeout-minutes'], 5)
  assert.equal(jobs.region['timeout-minutes'], 120)
  assert.equal(jobs.deploy['timeout-minutes'], 30)
})
