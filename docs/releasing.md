# Releasing

Two channels exist: GitHub Releases, which is set up and used today, and npm, which is planned
but **not set up yet**.

## GitHub Release (in use)

A release is a git tag of the form `vX.Y.Z`. Pushing the tag triggers
`.github/workflows/release.yml`, which builds the application, packs the npm tarball and
publishes a GitHub Release with the matching changelog section as its notes.

1. **Write the changelog.** In `CHANGELOG.md`, move the entries under `## [Unreleased]` into a
   new heading `## [X.Y.Z] - YYYY-MM-DD`, and add the comparison link at the bottom of the file.
2. **Set the version.** In `package.json` change `"version"` to `X.Y.Z` and run `npm install`
   so `package-lock.json` follows.
3. **Commit and push** to `main`. Wait for the CI workflow to go green.
4. **Tag and push the tag:**

   ```bash
   git tag -a vX.Y.Z -m "Release X.Y.Z"
   git push origin vX.Y.Z
   ```

5. **Verify.** The Release workflow appears under Actions within a minute. It fails deliberately
   if the tag does not match the `package.json` version. When it succeeds the release is at
   `https://github.com/byreshb/testing-toolkit-dashboard/releases/tag/vX.Y.Z` with the
   tarball `testing-toolkit-dashboard-X.Y.Z.tgz` attached.
6. **Start the next cycle.** Set `package.json` to `X.Y.(Z+1)-dev`, run `npm install`, and add
   a fresh `## [Unreleased]` heading to the changelog.

The TypeScript packages of the toolkit are versioned in lockstep with the Java modules and use
the same `v*` tag scheme.

### Fixing a bad release

Delete the release on GitHub, delete the tag (`git push origin :refs/tags/vX.Y.Z` and
`git tag -d vX.Y.Z`), fix the problem, and tag again. Never reuse a version number that anyone
may already have downloaded; prefer releasing a patch version instead.

## npm (planned, not set up yet)

> **Status: not done.** Nothing below is configured in this repository. The steps are recorded so
> the work can be picked up later. Publishing to npm is free for public packages.

Once done, users will run the dashboard without cloning:

```bash
npx testing-toolkit-dashboard --data ./.flake
```

### One-time setup

1. **npm account.** Sign in at https://www.npmjs.com with the GitHub account and enable
   two-factor authentication.
2. **Package name.** `testing-toolkit-dashboard` is unscoped; check it is free with
   `npm view testing-toolkit-dashboard` (an error means it is available).
3. **Trusted publishing.** In the package settings on npmjs.com, add this repository and the
   `release.yml` workflow as a trusted publisher so the workflow can publish with an OIDC token
   and no long-lived secret.
4. **Workflow step.** Add to `release.yml`, after the pack step:

   ```yaml
   - name: Publish to npm
     run: npm publish --provenance --access public
     env:
       NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

   and `id-token: write` under `permissions`. With trusted publishing the token secret is not
   needed; keep it until that is verified.

5. **Package contents.** `files` in `package.json` must include the built `.next/` output,
   `public/` and the `bin/` launcher so the package runs without a build step.

### Per-release steps (once set up)

Follow the GitHub Release steps above; the workflow publishes to npm from the same tag.

### Where this stands

The GitHub Release channel is complete. npm publishing was deliberately deferred on
2026-09-13 and is tracked as a to-do to revisit around November 2026.
