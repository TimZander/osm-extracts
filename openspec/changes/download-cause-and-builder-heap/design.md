# Design: download-cause-and-builder-heap

## Context

See proposal.md. Node 22's `fetch` (undici) rejects with `TypeError: fetch failed` for any failure
before a response, and sets `cause` to the underlying error: a `SystemError` with `code` such as
`ECONNRESET`, `ENOTFOUND` or `ETIMEDOUT`, or an undici error with a code such as
`UND_ERR_CONNECT_TIMEOUT`. `download()` reported `e.message` alone.

The runner (`ubuntu-24.04`, standard GitHub-hosted, public repository) has 4 vCPUs and 16 GB of RAM.
Node's default old-space limit on it is far below that, about 2–4 GB depending on version and memory.

## Decisions

1. **Every failed download names its URL** (before a response, on an HTTP status, or cut off while the
   body streams), and **a failure before a response carries `cause`'s code and message**, as
   `download of <url> failed: fetch failed (cause: <code>: <message>)`; with no `cause`, the old text;
   with a `cause` that has no `code`, its message alone. A nested cause (an `AggregateError` from
   happy-eyeballs) is reported through its own message only: one level is enough to tell a reset from a
   DNS failure, and keeps the line short. (ADR 0031.)
2. **The heap is a flag on the build step's command line**, not `NODE_OPTIONS`: it applies to the
   builder alone, not to osmium or other Node processes, and the workflow test can pin the exact
   command. The value is 12,288 MiB, the owner's choice of the BC lane's option (a) (ADR 0030). It
   applies to every region; the small ones don't use it, since V8 grows the heap only as needed.
3. **No retry on a failed download.** Out of scope: the owner asked only for the cause, and a retry
   would change what a run does on a Geofabrik outage. A later change can decide it once causes are
   seen.

## Risks / Trade-offs

- **[Risk] A region needing more than 12 GiB** → the job fails out of memory as before, alone; the
  others publish. The BC lane's measurement leaves about 9 GB of headroom on its largest output.
- **[Trade-off] The runner's other processes** (osmium runs before the builder writes, not alongside
  it) get less room if the builder's heap grows to its limit; 12 GiB of 16 GB leaves about 4 GB.
- **[Risk] Text in the error from the network** → the cause's message comes from Node's own errors,
  not from the server; it is written to the job log only, which is already public.

## Spec review

One round: no blocker. Fixed: the URL rule names "a failed download", so the MD5 mismatch is unchanged
(D1); a body cut off mid-stream names its URL too, with a scenario and a test (F1); a cause with no
code gives its message alone, in the spec (D2).

## Conformance review

Verdict: conforms with gaps. C1 (the mid-stream test checked only the message): the test now runs
`buildRegion` with a polygon body that fails and checks nothing is written. S1 (a body failure dropped
`cause`): routed through the spec, which now asks for the cause on a body failure too, since Node's
fetch reports a mid-stream reset as `terminated` with the socket error in `cause`.

## Security review and attack test

`/security-review`: no finding at confidence 8 or above. The workflow runs only on `schedule` and
`workflow_dispatch`, with no inputs; the flag is a fixed literal; `$REGION` stays in `env`, quoted, and
`validateRegions` refuses `$(id)`, `a;rm -rf /`, `"; curl evil #`, a newline and
`--max-old-space-size=1` as ids. The region job holds no secret, so the cause text can't leak one.

The attack test found two weaknesses in the new error text, both fixed with a test: a cause holding a
newline could put `::add-mask::` or `::warning::` at the start of a new log line, where the runner
reads it as a workflow command (the region job is read-only, so the harm was spoofed annotations);
and a cause whose `message` getter throws replaced the whole error, URL included. The cause is now
kept on one line (control characters become a space), and an unreadable cause is reported as
`(cause: unreadable)`.

## Open Questions

None. Both fixes are the owner's (2026-11-13); the heap value is the BC lane's measured option (a).
