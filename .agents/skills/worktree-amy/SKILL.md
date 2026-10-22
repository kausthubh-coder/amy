---
name: worktree-amy
description: Make a fresh checkout of Amy work in isolation. Use at the start of the first task in a new worktree, when install or the Expo web port look wrong, and before giving a helper agent its own checkout.
---

# Worktree Amy

Amy has no backend, no env file, and no secrets: a checkout needs dependencies and a port, nothing else.

## Setup

```sh
npm ci
npm test
```

Done when `npm test` ends with the typecheck clean and all unit tests passing. Rerunning `npm ci` on a healthy checkout takes about a minute; skip it when `node_modules/.package-lock.json` is newer than `package-lock.json`.

## Port

The verify skill starts Expo web on port 19077. Two worktrees on one machine collide there, so a second checkout picks its own:

```sh
AMY_WEB_PORT=19081 sh .agents/skills/verify-amy/scripts/web.sh start
```

Choose a port nothing answers on (`curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>/` prints `000`) and keep using the same value for `doctor`, `stop`, and `AMY_WEB_PORT` when running `journey.mjs`. The pid file is per checkout, under `.artifacts/verify/.run/`.

## Helpers

One worktree and one Expo server per agent; never two agents in one checkout. Make a helper's worktree from `origin/main` next to the T3 worktrees, then run the setup above in it:

```sh
git fetch origin
git worktree add C:/Users/kaust/.t3/worktrees/amy/<name> -b <branch> origin/main
```

## Never edit the main checkout

`C:\Users\kaust\OneDrive\Documents\dev\amy` is the maintainer's; only `ship-amy` touches it, with a fast-forward pull.

## Cleanup

Stop only the server you started, with `web.sh stop` (it kills the recorded pid tree, never a port). Remove a worktree only when its work is merged or the maintainer says so, and never one another live thread is using (`t3_thread_list`). On Windows, `git worktree remove` can leave the folder behind; delete it afterwards with `Remove-Item -Recurse` only if `git worktree list` no longer shows it.
