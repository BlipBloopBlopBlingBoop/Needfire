## What & why



## How tested

- [ ] `python3 -m unittest discover -s tests` passes

## Checklist

- [ ] Stdlib-only preserved — no pip packages, no Node, no build step
- [ ] Works offline; optional pieces (Ollama, models) still degrade gracefully
- [ ] If seed docs changed: ran `make seed-manifest`
- [ ] If web shell files changed: bumped `CACHE` in `web/sw.js`
- [ ] If behavior changed: updated `CHANGELOG.md`
