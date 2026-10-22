---
name: ship-amy
description: Take verified Amy work from a worktree to main, build the signed arm64 APK on EAS, and publish the tagged GitHub release. Use only when the maintainer says ship, release, deploy, or merge and deploy.
---

# Ship Amy

"Ship" is the go for every step below, including cleanup. Run them in order without stopping to ask. Stop only when a step fails for a reason outside this change, or the fix needs a maintainer decision (a signing key, a version policy, a permission).

The only production surface is the GitHub release and its APK. IzzyOnDroid reads that release; nothing deploys on push.

## 1. Ready

- `git fetch origin`; the tree is clean and `git log origin/main..HEAD` lists exactly what goes out. If `origin/main` moved, rebase or merge it in first.
- `npm run audit:release` (typecheck, unit tests, `expo install --check`, `expo-doctor`) and `git diff --check` pass. expo-doctor may warn about the Hermes V1 memory issue fixed in SDK 57; that is known and not a blocker.
- Every screen or storage change was driven with `verify-amy` and its evidence folder exists under `.artifacts/verify/`.
- A change under `plugins/`, `app.json` android or splash settings, or permissions was checked with `npm run prebuild:android` by reading the generated files.
- Bump the version in the same PR. Find the next build number first:

  ```sh
  npx eas-cli@latest build:version:get --platform android
  ```

  EAS remote versioning owns `versionCode`; the next build gets that number plus one. Then change, all to the same values: `version` in `package.json` and twice in `package-lock.json`, `expo.version` and `expo.android.versionCode` in `app.json`, the "Current version" row in `README.md`, the table at the top of `docs/RELEASE_PROCESS.md`, and a new `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt` under 500 characters that says what a person will notice. Done when `git grep -n '<old version>'` finds only history (old changelogs, release notes).
- Rollback plan: Android refuses to install a lower `versionCode`, so a bad release is rolled back by a new release with a higher build, not by re-pointing "latest". Keep the previous APK's URL from the release page in the report in case a tester needs to uninstall and go back.

## 2. Land

Amy is public and CI runs on pull requests, so land through a PR:

```sh
git push -u origin HEAD
gh pr create --base main --title "..." --body-file <notes>
gh pr checks <n> --watch
gh pr merge <n> --merge
```

Use a merge commit; every release so far points at one. Never `--delete-branch` from inside a worktree, and never `--admin` past a red check. Done when `gh pr view <n> --json state,mergeCommit` shows `MERGED` and a merge SHA. That SHA is the release commit.

## 3. Build

Build from the merge commit, not the branch head, so the EAS record and the release notes name the same SHA. A worktree cannot check out `main` while the main checkout holds it, so detach:

```sh
git fetch origin && git checkout --detach origin/main
npx eas-cli@latest whoami            # kausthubh; log in with npm run eas:login if not
npm run build:production:android     # EAS cloud, arm64 APK, signed with the EAS release credentials
```

Run it in the background with a 40 minute budget; a build takes about 15 to 25 minutes and the command waits for the result. Done when it prints the build page URL and a status of `finished`. If it fails, read the EAS log link it prints: a Gradle or plugin failure is this change (fix on a new branch and repeat from step 1); a credentials or quota failure is the maintainer's.

## 4. Verify the APK

```sh
mkdir -p .artifacts/release
URL=$(npx eas-cli@latest build:list --platform android --limit 1 --non-interactive --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].artifacts.applicationArchiveUrl))')
APK=.artifacts/release/amy-<version>-arm64-v8a-release.apk
curl -sSL "$URL" -o "$APK"
BT="$ANDROID_HOME/build-tools/36.0.0"
"$BT/aapt2" dump badging "$APK" | grep -E "^package|sdkVersion|targetSdkVersion|native-code|application-debuggable"
"$BT/apksigner.bat" verify --print-certs "$APK" | grep -i sha-256
sha256sum "$APK"; stat -c %s "$APK"
```

Expected: package `com.kaust.amy`, `versionName` and `versionCode` from step 1, `native-code: 'arm64-v8a'` only, no `application-debuggable`, and the signer certificate SHA-256 `c641dbac8fa970a899bc16171c8d99a9e56ff0b6f2e1329d05c6dc531c16cb92` (the key since 1.0.10; a different value means installed users cannot update, stop and tell the maintainer). `.artifacts/` is ignored by git; never commit an APK.

## 5. Release

```sh
git tag -a v<version> -m "Amy <version>" <merge sha>
git push origin v<version>
gh release create v<version> "$APK" --title "Amy <version>" --notes-file .artifacts/release/notes.md
```

Write the notes with `unslop`, in the shape of the previous releases (`gh release view v1.0.11`): a sentence on what the release is for, a short list of what a person will notice, then the artifact block (filename, package, version and build, ABI, minimum and target API, size in bytes, SHA-256, signing certificate SHA-256 with "same as" the previous release, the EAS build URL and the merge commit), then known issues and what had no device pass. Done when `gh release view v<version> --json assets,isLatest` lists the APK and `isLatest` is true.

## 6. Production check

Read-only:

```sh
curl -sI https://github.com/kausthubh-coder/amy/releases/latest | grep -i '^location'   # ends in v<version>
gh release download v<version> -p '*.apk' -O /tmp/check.apk && sha256sum /tmp/check.apk  # same hash as step 4
```

An install on a device is not possible here; say so in the report.

## 7. Main checkout and cleanup

- Main checkout is `C:\Users\kaust\OneDrive\Documents\dev\amy`. If `git -C <main> status --short` is empty and it is on `main`: `git -C <main> pull --ff-only`, then `npm ci` there if `package-lock.json` changed. Otherwise leave it and say so.
- Delete the merged branch: `git push origin --delete <branch>` and `git branch -D <branch>` (the worktree is detached after step 3, so the local delete works).
- This worktree stays until the maintainer removes it; list its path in the report.

## 8. Report

A few lines: the release URL, the merge SHA and tag, the APK hash and build number, what shipped for the user, the evidence (audit output, verify folders, apksigner line), and anything skipped. IzzyOnDroid is told about new releases on its own; filing or updating there is a separate ask.
