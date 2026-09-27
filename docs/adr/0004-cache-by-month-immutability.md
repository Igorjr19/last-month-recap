---
status: accepted
date: 2026-09-27
decision-makers: Ígor José Rodrigues
---

# Cache recaps by month immutability

## Context and Problem Statement

Building a recap calls the Last.fm API several times: user info, paged recent
tracks and weekly charts. Heavy users need many pages. The Workers Free plan
allows 50 external subrequests per request and 100,000 requests per day, and
Last.fm asks clients to avoid excessive calls. The same recap is often
requested again, for example when a user tries several templates or opens a
shared link. How do we cache recaps so repeat requests are cheap and data
stays correct?

## Decision Drivers

- Workers Free: 50 external subrequests per request, 100,000 requests per day.
- Workers KV Free: 100,000 reads and 1,000 writes per day, 1 write per second
  to the same key, minimum expiration of 60 seconds.
- A month that has ended does not change, apart from late scrobbles.
- The current month changes as the user listens.
- A change to the `RecapData` shape must not serve stale, incompatible data.

## Considered Options

- Cache by month immutability: no expiry for closed months, a short TTL for
  the current month, schema version in the key
- One TTL for every recap
- No cache, call Last.fm on every request
- Cache API only (per data center)

## Decision Outcome

Chosen option: "Cache by month immutability", because a closed month can be
computed once and served forever, which saves both Last.fm calls and KV
writes.

- A **closed** month is cached with no expiration.
- The **current** month, and a recently ended month still inside the grace
  period below, is cached with a 1 hour TTL.
- Cache keys include the `RecapData` schema version. A version bump makes old
  entries unreachable, so they are never served with the wrong shape.

### When a month is closed

Last.fm accepts scrobbles with past timestamps, so the last days of a month
can still change shortly after it ends. A month counts as closed only after
its end, in the requested timezone, plus a grace period of a few days. Until
then it gets the 1 hour TTL. The exact grace period is chosen in #26.

### Cache key

Sketch; the exact format lands in #26:

```
recap:v<schemaVersion>:<user lowercased>:<YYYY-MM>:<timezone>:<sorted features>
```

The timezone is part of the key because it moves the month boundaries. The
feature list is part of the key because the response only contains the
requested features ([ADR-0003](0003-pluggable-card-templates.md)).

### Consequences

- Good, because a closed month costs Last.fm calls once per key, then only
  one KV read.
- Good, because the subrequest budget is spent only on misses.
- Good, because a schema bump needs no migration or purge.
- Bad, because KV Free allows 1,000 writes per day. Every miss and every
  hourly refresh of a current month is a write. Popular current-month recaps
  and many feature combinations can exhaust it. Mitigations to evaluate in
  #26: the Cache API in front of KV, caching Last.fm results per month
  instead of per feature set, and skipping the KV write for current months.
- Bad, because KV is eventually consistent. Two data centers can compute the
  same miss at once. Both compute the same result, so this wastes calls but
  does not serve wrong data.
- Bad, because scrobbles added after the grace period are not reflected.
  This is accepted.
- Neutral, because old schema versions stay in KV until storage becomes a
  concern (1 GB on the Free plan).

### Confirmation

- Unit tests for the TTL rule: a closed month gets no expiration, the current
  month and a month inside the grace period get 1 hour, across timezones
  (#26).
- The cache key function is tested for schema version, timezone and feature
  order (#26).

## Pros and Cons of the Options

### Cache by month immutability

- Good, because it matches how the data behaves.
- Good, because most traffic for past months becomes cache hits.
- Bad, because the closed-month rule and grace period need care around
  timezones.

### One TTL for every recap

- Good, because it is simple.
- Bad, because closed months get recomputed after each expiry for no reason,
  spending Last.fm calls and KV writes.

### No cache

- Good, because data is always fresh.
- Bad, because every request spends up to the full subrequest budget and
  loads Last.fm.
- Bad, because heavy users could fail on the 50 subrequest limit on every
  request instead of once.

### Cache API only

- Good, because it is free and has no daily write limit.
- Bad, because entries live in one data center and can be evicted at any
  time, so hit rates are lower.
- Neutral, because it can sit in front of KV as a first layer.

## More Information

- KV cache implementation: #26. Subrequest budget for heavy users: #15.
- Track B replaces KV with a store available on the cluster through the cache
  interface from [ADR-0001](0001-monorepo-and-portable-hono-api.md).
