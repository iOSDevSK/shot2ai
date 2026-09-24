# Release versions

- For every delivered extension change, publish a new local version. Never reuse the version of the previous delivered build.
- Keep `manifest.json`, `package.json`, and the root package entries in `package-lock.json` on the same version.
- Build the versioned release ZIP with `python3 scripts/package.py` and keep the unpacked extension available through `~/Downloads/test/shot2ai`.
- State the new version and the checks performed when handing over the change.
