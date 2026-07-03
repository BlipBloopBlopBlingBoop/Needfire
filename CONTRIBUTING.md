# Contributing to Needfire

Thanks for helping build the survival knowledge computer. Needfire is small on
purpose — please read the hard constraints before writing code.

## Run it

```bash
python3 -m needfire serve     # or: make serve
# open http://localhost:8848
```

No virtualenv, no pip install — a fresh checkout runs as-is on Python 3.8+.

## Test it

```bash
python3 -m unittest discover -s tests -v     # or: make test
```

The suite is stdlib-only and needs **no network** (download tests spin up a
throwaway local HTTP server). Please add a regression test with any bug fix
and keep the suite green.

## Hard constraints (the point of the project)

- **Python standard library only.** No `requirements.txt`, no pip packages.
  Optional accelerators (Ollama, faiss, libzim) must be runtime-detected and
  the app must stay fully functional without them. The floor is **Python 3.8**.
- **No build step for the web UI.** `web/` is vanilla JS/CSS served as-is —
  no Node, no bundler, no framework. The UI must work offline (it is a PWA
  with a service worker).
- **Offline first.** Network use is confined to `needfire/corpus.py` (catalog
  downloads) and `needfire/models.py` (talking to a local Ollama). Everything
  else must work with the cable unplugged.

## Conventions

- The numbered docs `01`–`08` are the **design package** (architecture,
  hardware, data, models, power, runbook, corpus, alternatives); `README.md`,
  `PROJECT.md`, `QUICKSTART.md`, and `START-HERE.txt` are the **user package**.
  If you add a top-level file, add a row to the README package map.
- After editing anything in `seed-corpus/documents/`, regenerate the manifest:
  `make seed-manifest` (the test suite fails otherwise).
- Version bumps: `needfire/__init__.py` `__version__` is the release number —
  keep the `docker-compose.yml` image tag in step with it and add a
  `CHANGELOG.md` entry (the scheme is documented there).
- Match the style around you: small modules, docstrings that explain *why*,
  no dependencies smuggled in through tests or scripts.

## Licensing of contributions

Code contributions are accepted under the **MIT** license; contributions to
`seed-corpus/` are accepted under **CC0-1.0** (public domain dedication) —
see [LICENSE](LICENSE). By submitting a pull request you agree to license your
work accordingly. Seed-corpus documents must be original or verifiably
CC0/public-domain material.

## Security issues

Do not open public issues for exploitable bugs — see [SECURITY.md](SECURITY.md).
