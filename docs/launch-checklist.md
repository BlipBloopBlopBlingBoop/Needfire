# Launch checklist — repo settings & release steps

The items below can't be committed; they live in GitHub's settings UI or happen
after merge. Work through them once at launch.

## Repo settings (Settings → General)

- [ ] **Description:**
      `The offline survival knowledge computer — citable library, 12 guided emergency protocols, optional local AI. Pure-stdlib Python, zero dependencies.`
- [ ] **Website:** leave blank or point at the repo's README.
- [ ] **Topics** (Settings → General → Topics, or the ⚙ next to About):
      `offline-first`, `survival`, `preparedness`, `emergency`, `first-aid`,
      `rag`, `local-llm`, `ollama`, `self-hosted`, `pwa`, `python`,
      `zero-dependencies`, `raspberry-pi`, `air-gapped`, `knowledge-base`
- [ ] **Social preview:** upload [`docs/assets/social-preview.png`](assets/social-preview.png)
      (Settings → General → Social preview). This is the card every share renders.

## After merging the launch PR

- [ ] Tag and push the release:
      `git tag v2.2.0 && git push origin v2.2.0`
- [ ] Create a GitHub Release for `v2.2.0`: title `Needfire 2.2.0`, body = the
      2.2.0 section of [`CHANGELOG.md`](../CHANGELOG.md).
- [ ] Attach the shareable package: run `make dist` and upload
      `dist/needfire-2.2.0.zip` (+ its `.sha256`) to the release.
- [ ] Confirm the CI badge on the README is green.

## Optional, high-leverage

- [ ] Enable **Discussions** and seed a "Welcome / roadmap" thread.
- [ ] Pin an issue titled "Good first contributions" pointing at
      [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- [ ] Enable **private vulnerability reporting**
      (Settings → Code security → Private vulnerability reporting) so the
      SECURITY.md advisory link works.
- [ ] Submit to a few awesome-lists (offline-first, self-hosted, preparedness)
      and share with the story: *"a survival library that still answers
      questions when everything else is down."*
