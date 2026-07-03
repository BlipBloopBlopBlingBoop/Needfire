# 02 — The Bothy: Hardware Inventory & Selection

Component-by-component rationale. Specific parts are **representative examples** — the goal is to teach
you the selection criteria so you can substitute whatever is available, repairable, and cheap when you
buy. Itemized lists with quantities and costs are in [`bom/`](bom/).

> ⚠️ Batteries, solar, and DC wiring carry real shock and fire risk — read the safety blocks in
> [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md) and [`06-BUILD-RUNBOOK.md`](06-BUILD-RUNBOOK.md)
> before buying or building. Reference design, no warranty: [DISCLAIMER.md](DISCLAIMER.md).

> **Selection criteria, in priority order:**
> 1. **Availability** — buyable today, ideally on the used market too.
> 2. **Repairability** — standard sockets, replaceable parts, no glued-shut units where avoidable.
> 3. **Power efficiency** — performance per watt beats raw performance; this runs on solar.
> 4. **Standard interfaces** — USB-C PD, 12 V, NVMe, SATA, RJ45 — no proprietary connectors.
> 5. **Thermal simplicity** — passive or low-RPM cooling; fewer moving parts to fail.

---

## 1. Compute

The workload is **memory-bandwidth-bound LLM inference + lots of small reads from storage.** RAM
capacity and memory bandwidth matter more than raw core count.

| Tier | Representative compute | RAM | Rationale |
|------|------------------------|-----|-----------|
| Personal | x86 mini-PC (recent low-power mobile CPU) **or** ARM SBC (Raspberry Pi 5 / Orange Pi 5-class with NPU) | 16–32 GB | Mini-PC runs bigger models; SBC is lighter, lower-power, and sips battery. Pick by weight budget. |
| Homestead | x86 mini-PC / SFF (8+ cores, good memory bandwidth) | 64 GB | Runs the 8–14B reasoning model in RAM with corpus caching headroom. |
| Homestead GPU (optional) | Used 16 GB-class GPU in an eGPU enclosure or SFF slot | — | 5–10× faster reasoning-model tokens/s; optional because it raises idle power. |
| Community | 2–3 mini-PC nodes + 1 GPU node (24 GB-class GPU) | 64 GB/node | Split roles: always-on node, retrieval node, GPU reasoning node. |

**Why mini-PCs over a tower:** lower idle watts, smaller Faraday enclosure, no fragile expansion, and
they run from a 12 V / USB-C feed close to battery voltage (less conversion loss).

**Why keep an ARM SBC option:** an SBC idles at 3–8 W. For a tiny always-on model and keyword search,
that's the difference between "runs all night on a power bank" and "doesn't."

---

## 2. Storage (two-tier: hot + cold)

| Role | Media | Personal | Homestead | Community | Why |
|------|-------|----------|-----------|-----------|-----|
| **Hot** (index, models, hot ZIMs) | NVMe SSD | 2–4 TB | 2 TB | 2 TB/node | Fast random reads for RAG + model loading. |
| **Cold** (full archive, backups) | SATA SSD or 3.5" HDD | (uses hot) | 8–16 TB | 24 TB+ (redundant) | Cheap bulk capacity; spun down when idle to save power. |
| **Cold spare** | identical drive, Faraday-stored, disconnected | 1× clone | 1× clone | 1× clone | Survives EMP/drive failure; the corpus is the irreplaceable asset. |

- **SSD vs HDD trade:** SSDs have no moving parts (shock/vibration tolerant, silent, low-power) but
  cost more per TB and can lose data if left **unpowered for years** — re-power and re-verify cold SSDs
  periodically (see `scripts/verify-integrity.sh`). HDDs are cheaper per TB and hold data unpowered
  longer, but are shock-sensitive. **Recommendation:** hot tier = SSD; cold bulk = HDD; cold spare =
  whichever you can store and re-verify on a schedule.
- **Always keep ≥2 physical copies** of the corpus, one of them disconnected (3-2-1 rule).

---

## 3. Power

Sized so the box runs on what the panels make on a mediocre day, with battery to cover nights and
clouds. Full sizing math is in [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md).

| Component | Personal | Homestead | Community | Notes |
|-----------|----------|-----------|-----------|-------|
| Battery | USB-C PD power bank (~25,000 mAh / ~90 Wh) + optional small LiFePO₄ 0.5 kWh | LiFePO₄ 1–2 kWh | LiFePO₄ 5 kWh+ | **LiFePO₄** for cycle life, safety, and cold tolerance vs other lithium chemistries. |
| Solar | 100 W foldable panel | 400–800 W panels | 1–2 kW array | Foldable for portability; rigid for fixed base. |
| Charge controller | (power bank handles it) | MPPT 20–40 A | MPPT 60 A+ | MPPT harvests ~15–30% more than PWM. |
| DC distribution | USB-C PD | 12 V bus + buck converters + USB-C PD | 12 V/24 V bus | Run compute from DC where possible — skip the inverter losses. |
| Inverter (optional) | — | small pure-sine, for AC-only gear | larger pure-sine | Only if a component truly needs AC. |

**Key principle:** every watt you don't spend is solar you don't have to carry. Prefer DC-native gear,
spin down cold drives, and use the low-power mode (tiny model only, display off).

---

## 4. Enclosure, ruggedization & Faraday

| Item | Purpose | Notes |
|------|---------|-------|
| Rugged case (Pelican-style, IP67) | water/dust/shock protection | foam-cut to fit; the operating enclosure |
| Faraday container (steel ammo can, lined; or galvanized bin) | EMP/Carrington risk-reduction for the **cold spare** | spare node + cold drive, **disconnected**, stored inside |
| Desiccant packs | humidity / condensation control | replace/recharge periodically |
| Conformal coating (optional) | marine/humid corrosion resistance on boards | for boats / coastal use |
| Anti-vibration foam / mounts | shock & transport survival | especially for HDDs and connectors |
| Cable gland / sealed pass-throughs | keep IP rating with cables routed | for fixed installs |

**Faraday reality check:** the *operating* computer can't be sealed in a Faraday cage (it needs cables
and antennas). The protection model is: **keep a complete, disconnected spare** (a second mini-PC/SBC +
a clone of the corpus drive) inside a Faraday container. If the running system is fried, you rebuild
from the spare. See [`05-POWER-AND-HARDENING.md`](05-POWER-AND-HARDENING.md) §EMP.

---

## 5. I/O, display & input

| Item | Personal | Homestead | Community | Notes |
|------|----------|-----------|-----------|-------|
| Display | small portable monitor or none (use phone) | portable monitor | shared monitor + client devices | E-ink/low-power option for status. |
| Input | folding BT/USB keyboard | keyboard + mouse | per-station | keep one wired set as BT-failure fallback |
| Headless access | phone/laptop browser over Wi-Fi AP | same | mesh clients | the primary interface for most users |

---

## 6. Networking

Needfire is **offline to the outside world** but serves a **local** network so phones/laptops can query
it through a browser.

| Item | Purpose | Notes |
|------|---------|-------|
| Wi-Fi AP (onboard radio via `hostapd`, or a dedicated travel router) | clients connect locally | WPA3; SSID hidden by default (op-sec) |
| Ethernet switch (gigabit) | wires the Community cluster nodes | low-power unmanaged switch |
| Mesh nodes (Community) | extend coverage across a settlement | off-the-shelf mesh kit, DC-powered |
| Antenna (optional) | LoRa / ham data for inter-node messaging | **separate** from the AI box; airplane mode stays default |

---

## 7. Spares & consumables kit

A survival computer that can't be repaired is a timer. Carry:

- 1× spare boot SSD (with OS image flashed) and 1× spare corpus drive clone.
- Spare USB-C PD cables, a spare buck converter, fuses, and a multimeter.
- Spare Wi-Fi adapter (USB) in case the onboard radio dies.
- Thermal paste, desiccant refills, zip ties, dielectric grease.
- A **printed** copy of the runbook quick-start and corpus index (runbook §10).
- Optional: a hand-crank/USB charger as a last-resort trickle source.

---

## 8. What NOT to buy

- **Cloud-dependent "smart" gear** — anything that phones home or needs an account to function.
- **Proprietary battery/solar ecosystems** that lock you to one vendor's connectors.
- **Bleeding-edge GPUs for the Personal/Homestead tier** — power-hungry and overkill; a used
  16 GB-class card is the sweet spot, and CPU-only is fine for the small model.
- **Spinning drives as your only copy** in a high-vibration platform (vehicle/boat) — mirror to SSD.

Next: [`03-DATA-ARCHITECTURE.md`](03-DATA-ARCHITECTURE.md).
