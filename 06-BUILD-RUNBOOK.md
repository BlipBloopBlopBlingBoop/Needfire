# 06 — Bothy Build & Setup Runbook

Step-by-step, in order, from a pile of parts to a serving, validated Bothy running Needfire. Times are rough. Do this
**while you still have internet** — the corpus download is the long pole and needs a connection.

> Conventions: commands are for a Debian/Ubuntu host; adapt package names to your distro. On the
> appliance, the app lives in `/opt/needfire`, runtime data in **`/var/lib/needfire`** (`NEEDFIRE_HOME`), and
> configuration in `/etc/needfire/needfire.env`. The shell scripts referenced live in [`scripts/`](scripts/)
> and are thin wrappers over `python3 -m needfire`.

---

## 0. Pre-flight (before you buy/build)

- [ ] Pick a tier ([`01-ARCHITECTURE.md`](01-ARCHITECTURE.md) §3) and open its BOM in [`bom/`](bom/).
- [ ] Confirm you have **enough internet bandwidth/time** for the corpus (could be days at C3/C4 scale).
- [ ] Confirm storage capacity vs the sizing budget ([`03-DATA-ARCHITECTURE.md`](03-DATA-ARCHITECTURE.md) §7).
- [ ] Have a **watt-meter** to measure real power draw.

---

## 1. Assemble the hardware (½–2 h)

1. Install RAM and NVMe; connect cold storage (SATA/USB).
2. Seat the GPU if fitted (Homestead+/Community).
3. Fit the compute into the rugged case with foam; route cables through glands.
4. Wire power: solar → MPPT → LiFePO₄ → DC bus / USB-C PD → compute. **Fuse every source line.**
5. Measure idle draw with the watt-meter; sanity-check against [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md) §1.

---

## 2. Install & harden the OS (½–1 h)

1. Flash Debian stable / Ubuntu LTS (or Armbian/Debian on an SBC) to the boot SSD.
2. During install, enable **LUKS full-disk encryption** on the OS volume (see hardening §5 for the
   corpus-volume trade-off — the bulk corpus may live on a separate, no-passphrase volume).
3. First boot; set the local clock/timezone (no NTP offline — set it manually and note clock drift).
4. Mount the cold-storage drive(s) and decide where `/var/lib/needfire` (or its big subdirectories,
   `zim/`, `docs/`, `maps/`) will physically live. Bind-mount or symlink bulk storage before
   installing so the installer's `chown` covers it.

---

## 3. Install Needfire (10 min)

1. Get the repo onto the machine — `git clone`, or copy it over USB (this is an offline-capable
   install; nothing is fetched from the internet except optional apt packages):
   ```
   git clone <this-repo> && cd Needfire
   ```
2. Run the installer (read it first — it's short and idempotent):
   ```
   sudo bash os/install.sh --ap        # drop --ap if you don't want the Wi-Fi access point
   ```
   This installs the app to `/opt/needfire`, creates the `needfire` service user and `/var/lib/needfire`, writes
   `/etc/needfire/needfire.env`, **builds the seed index**, and enables **`needfire.service`**. With `--ap` it also
   stages **`needfire-ap.service`** (hostapd; dnsmasq provides DHCP/DNS) — edit
   `/etc/hostapd/hostapd.conf` (SSID, passphrase, country) and `/etc/needfire/ap.env` (wireless
   interface), then `systemctl enable --now needfire-ap.service`. By default it also applies the
   **airplane-mode nftables firewall** (skip with `--no-firewall` while you're still downloading).
3. From a browser on the same network (or the AP), open:
   ```
   http://<the-machine's-ip>:8848
   ```
   Needfire answers immediately from the bundled 40-document seed library — before any downloads,
   before any models. Check the **NEEDFIRE LINK** health pill in the UI header and `systemctl status needfire`.

To bake a flashable burn-and-boot image instead, see [`os/image/README.md`](os/image/README.md)
(`make image-pi` / `make image-x86`).

---

## 4. Acquire the corpus (hours → days, online)

Follow [`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md). In short:

1. Edit [`catalog/catalog.json`](catalog/catalog.json) (`/opt/needfire/catalog/catalog.json` on the
   appliance): replace the `<PLACEHOLDER>` URLs with current filenames from the Kiwix library.
   Placeholder entries are skipped with a notice, never guessed.
2. Download — from the **Corpus tab in the UI** (progress bars, per-source), or from the shell
   (idempotent & resumable — safe to stop/restart):
   ```
   bash scripts/download-corpus.sh --home /var/lib/needfire --tier C1
   bash scripts/download-corpus.sh --home /var/lib/needfire --tier C2 --tier C3 --tier C4
   ```
   Start with **C1** so you have survival-critical knowledge usable immediately, then let the rest run.
3. Each artifact's SHA-256, size, license, and tier are recorded in `/var/lib/needfire/manifest.json`
   as it downloads.
4. Re-index so the new content is searchable (ZIM files need the optional `libzim` package;
   plain `.md`/`.txt` under `docs/` always index):
   ```
   sudo systemctl stop needfire
   sudo -u needfire bash -c 'set -a; . /etc/needfire/needfire.env; set +a; python3 -m needfire index'
   sudo systemctl start needfire
   ```

---

## 5. Verify integrity (minutes) — **before you trust it**

```
bash scripts/verify-integrity.sh --home /var/lib/needfire    # downloaded corpus vs manifest.json
python3 -m needfire verify --seed                           # bundled seed docs vs seed-manifest.json
```

- The wrapper first checks the manifest's GPG signature if `manifest.json.sig` exists — a bad
  signature is **fatal** (hash checks against an untrusted manifest prove nothing). Consider signing
  the manifest once your corpus is complete.
- Exit code 0 = all OK; non-zero = `changed`/`missing` artifacts. Re-download anything flagged.
- `verify --seed` re-hashes the 40 bundled documents against `seed-corpus/seed-manifest.json`
  (regenerate with `make seed-manifest` only if you deliberately edited seed docs).

---

## 6. Optional: local AI models (½ h + download)

Needfire works without this step (sources-only mode). With Ollama it synthesizes cited answers and
uses semantic embeddings:

1. Install [Ollama](https://ollama.com) and pull the defaults (or alternatives — see
   [`04-AI-MODEL-STACK.md`](04-AI-MODEL-STACK.md) §1 and §3 for what fits your RAM):
   ```
   ollama pull llama3.2:1b        # NEEDFIRE_TINY_MODEL
   ollama pull llama3.1:8b        # NEEDFIRE_REASON_MODEL
   ollama pull nomic-embed-text   # NEEDFIRE_EMBED_MODEL
   ```
2. Confirm `/etc/needfire/needfire.env` points at it (`NEEDFIRE_OLLAMA_URL=http://127.0.0.1:11434`, the default);
   override the model env vars there if you chose different tags.
3. **Rebuild the index** so it uses semantic embeddings instead of the hash fallback, then restart:
   ```
   sudo systemctl stop needfire
   sudo -u needfire bash -c 'set -a; . /etc/needfire/needfire.env; set +a; python3 -m needfire index'
   sudo systemctl restart needfire
   ```
4. Smoke-test:
   ```
   curl -s http://localhost:11434/api/tags            # Ollama up, models listed
   curl -s http://localhost:8848/api/system | python3 -m json.tool   # models.available: true
   ```
   Note: if the firewall from step 3 is active, model pulls need it relaxed temporarily — pull
   models **before** locking the box down, like the corpus.

---

## 7. Validate end-to-end (½ h) — **don't skip**

Ask real questions (UI, or `python3 -m needfire ask "…"`) and confirm **citations resolve to real source
documents** you can open and read. All of these are answerable from the seed corpus alone:

- [ ] **Medical:** "How do I control severe bleeding?" → cites *Control Bleeding*; the source card
      opens the full document in the reader.
- [ ] **Water:** "How do I purify cloudy water without a filter?" → cites *Water Purification* /
      *Finding Water*.
- [ ] **Medical:** "How do I perform CPR on an adult?" → cites *CPR (Adult & Child)*.
- [ ] **Physics:** "What shielding stops gamma radiation?" → cites *Radiation Shielding*.
- [ ] **Chemistry:** "How is soap made from fat and lye?" → cites *Soap & Saponification*.
- [ ] **Critical banner:** medical/chemistry answers carry the read-the-source warning.
- [ ] **Fail-down:** stop Ollama (`systemctl stop ollama` or unset `NEEDFIRE_OLLAMA_URL`), re-ask —
      confirm the answer degrades to labeled **sources-only** results, still with sources.
- [ ] **"Not in sources":** ask something absent (e.g. "How do I rebuild a jet engine?") — confirm it
      says *Not in the available sources.* instead of inventing an answer.
- [ ] **Status:** `python3 -m needfire status` shows the expected document/chunk counts and embed backend.

If a citation does **not** open the real source, fix retrieval/indexing before you rely on the system.

---

## 8. Power & solar commissioning (½ h + observation)

1. Run a realistic load (a few reasoning-model queries) and log watt-meter readings.
2. Confirm solar harvest under sun and that the battery charges; verify low-battery clean-shutdown.
3. Compare measured daily Wh to [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md) §1 and adjust
   panel/battery if short. Test **low-power mode** (the UI's `power=low` keeps queries on the tiny
   model).

---

## 9. Make the backup clone & the cold spare (1–2 h)

1. Clone the data root to a spare drive, then **verify the clone**:
   ```
   rsync -aH --info=progress2 /var/lib/needfire/ /mnt/backup/needfire/
   bash scripts/verify-integrity.sh --home /mnt/backup/needfire
   ```
2. Prepare the **cold spare**: a second mini-PC/SBC with the OS pre-flashed + the repo installed
   (`os/install.sh` runs offline) + the verified clone drive.
3. **Disconnect** the spare and store it in the Faraday container
   ([`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md) §3).

---

## 10. The paper layer (½ h) — a survival computer must be recoverable without itself

Print and store with the device (and a copy off-site):

- [ ] This runbook's recovery steps (§9 restore, cold-spare bring-up, `os/install.sh` invocation).
- [ ] **Disk-decryption recovery method** — stored **separately/securely**, not next to the device.
- [ ] The **corpus index**: which physical drive + which folder/ZIM holds each domain (so a human can
      find "antibiotics" or "well drilling" with zero electronics).
- [ ] Power wiring diagram + fuse values.
- [ ] A one-page "if everything is dead" checklist.

---

## 11. Maintenance schedule

| Interval | Task |
|----------|------|
| Monthly | Power up cold/spare drives; run `scripts/verify-integrity.sh`; check desiccant; top-up battery. |
| Quarterly | Practice a restore-from-backup and a cold-spare boot (a drill). Clean filters/heatsinks. |
| On corpus update | Re-run `python3 -m needfire index`; re-verify; re-sign the manifest if you sign it; refresh clones. |
| On model swap | `ollama pull` + edit `/etc/needfire/needfire.env` + `systemctl restart needfire`; if the **embedding** model changed, **rebuild the index** first. |
| On app update | Re-run `sudo bash os/install.sh` (idempotent); check `systemctl status needfire`; rebuild the index if the startup log warns of an old schema. |
| After rough transport | Re-seat connectors; run `scripts/verify-integrity.sh`. |

Next: [`07-CORPUS-ACQUISITION.md`](07-CORPUS-ACQUISITION.md).
