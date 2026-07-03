# 05 — Power Budget & Hardening

Two jobs: keep it **fed** (power) and keep it **alive** (hardening against EMP, water, dust, shock,
theft, and operator error). Honest framing throughout — this reduces risk; it does not make the box
invincible.

---

## 1. Power budget

### Estimated draw (order-of-magnitude — measure your own build with a watt-meter)

| State | Personal (SBC/mini-PC) | Homestead (mini-PC, no GPU) | Homestead (+GPU) | Community (cluster) |
|-------|------------------------|------------------------------|------------------|---------------------|
| Idle / serving search | 4–10 W | 12–25 W | 25–45 W | 60–120 W |
| Tiny-model inference | 8–15 W | 25–45 W | — | — |
| Big-model inference (CPU) | 15–35 W | 45–90 W | — | 150–300 W (peaks) |
| Big-model inference (GPU) | — | — | 120–250 W (peaks) | 200–400 W (peaks) |
| Cold drive spin-up | +5–10 W (brief) | +8–15 W | +8–15 W | +20–40 W |

### Daily energy & sizing math

Daily energy ≈ `avg_watts × hours_on`. Worked example (Homestead, no GPU, mixed use):

```
avg draw  ≈ 18 W idle (20 h) + 60 W inference (4 h)
          = (18 × 20) + (60 × 4) = 360 + 240 = 600 Wh/day
```

**Battery sizing** (cover ~2 cloudy days of autonomy, LiFePO₄ usable ~80–90% depth of discharge):

```
battery_Wh ≈ daily_Wh × autonomy_days / depth_of_discharge
           ≈ 600 × 2 / 0.85 ≈ 1,410 Wh  → a ~1.5 kWh LiFePO₄ bank
```

**Solar sizing** (replace daily use, derate for losses & bad days — assume ~3–4 "peak sun hours" and
~70% system efficiency):

```
solar_W ≈ daily_Wh / (peak_sun_hours × system_eff)
        ≈ 600 / (3.5 × 0.70) ≈ 245 W  → fit 400 W+ for margin and cloudy days
```

| Tier | Typical daily Wh | Battery (autonomy) | Solar (with margin) |
|------|------------------|--------------------|---------------------|
| Personal | 100–250 Wh | 90 Wh power bank + optional 0.5 kWh | 100 W foldable |
| Homestead | 400–900 Wh | 1–2 kWh | 400–800 W |
| Homestead +GPU | 800–1,800 Wh | 2–3 kWh | 800–1,200 W |
| Community | 2,000–5,000 Wh | 5 kWh+ | 1–2 kW |

### Power discipline (stretches every watt)
- **Low-power mode:** tiny model only, display off, cold drives spun down, Wi-Fi AP on a duty cycle.
- **DC-native:** run compute from a 12 V bus / USB-C PD; avoid inverter conversion losses (~10–20%).
- **MPPT, not PWM:** ~15–30% more harvest from the same panels.
- **Spin down cold storage** when idle; batch big-model work into solar-peak hours.
- **Measure:** a $15 inline watt-meter pays for itself; size from *your* numbers, not these estimates.

---

## 2. Threat model matrix

| Threat | Effect | Mitigation | Honest limit |
|--------|--------|------------|--------------|
| EMP / Carrington / solar storm | fries unshielded electronics | Faraday-stored **disconnected spare** node + corpus clone; surge protection; ground | shielding is probabilistic; a powered, cabled system is exposed |
| Water / humidity | corrosion, shorts | IP67 case, sealed glands, desiccant, conformal coat | seals degrade; inspect |
| Dust / sand | clogs, abrasion, heat | sealed enclosure, passive cooling, filters | filters need cleaning |
| Shock / vibration | drive failure, loose connectors | SSDs, foam mounts, locking connectors | HDDs remain fragile |
| Temperature extremes | throttling, battery damage | passive heatsinks, shade, LiFePO₄ (better cold/heat tolerance), insulate battery | don't charge LiFePO₄ below freezing |
| Power loss / brownout | corruption, downtime | battery buffer, clean shutdown (UPS logic), journaling FS | — |
| Theft / seizure | loss of asset & data | encryption, concealment, decoy, off-site clone | encryption ≠ invincible; rubber-hose risk |
| Operator error / single point of failure | data loss, can't boot | clones, printed runbook, simple recovery, automation | complexity is the enemy — keep it simple |
| Bit-rot / silent corruption | corpus degrades unnoticed | SHA-256 manifest + scheduled `verify-integrity.sh` | only catches what you check — check on a schedule |

---

## 3. EMP / Carrington hardening (realistic)

**The model:** you cannot Faraday-shield a *running, cabled* computer. So:

1. **Run** the operating system normally (it's exposed — accept that).
2. **Keep a complete cold spare, disconnected, inside a Faraday container:** a second mini-PC/SBC (with
   the OS pre-flashed) **plus** a clone of the corpus drive. Disconnected is key — a Faraday cage
   protects contents only if nothing penetrates it with a wire.
3. **If an event hits** and the running box dies, you rebuild from the spare.

**Faraday container options (off-the-shelf):** a steel ammo can with conductive gasket/tape on the seam;
a galvanized steel trash can with a tight lid (line the inside with cardboard so contents don't touch
bare metal); a purpose-made Faraday bag (double-bagged). Test it: a phone inside should lose signal /
not receive a call. **Surge & ground** the fixed install (solar/battery wiring is an antenna) — but
understand surge protection helps with induced currents on long lines, not a direct fast EMP pulse.

> **Be honest with yourself:** there is no consumer-certifiable EMP shield. This is risk reduction. The
> single most protective act is **owning a disconnected, verified spare copy of the corpus**, because the
> corpus is the part you can't re-download after the grid is gone.

---

## 4. Environmental ruggedization

- **Enclosure:** IP67 rugged case for the operating unit; foam-cut interior; cable glands keep the seal.
- **Thermal:** prefer **passive cooling** (heatsinks, fanless mini-PCs) — fans are the most common
  failure point and an intake for dust/water. If you must use a fan, filter it and make it replaceable.
- **Humidity/marine:** desiccant packs (recharge them), conformal-coat exposed boards, dielectric grease
  on connectors. Re-inspect after any immersion risk.
- **Cold:** insulate the battery; **do not charge LiFePO₄ below 0 °C** (it damages cells). Let
  electronics warm gradually to avoid condensation.
- **Transport:** lock connectors, strap drives, and re-run `verify-integrity.sh` after rough moves.

---

## 5. Physical & operational security

- **Encryption:** LUKS full-disk. **Trade-off:** an encrypted corpus that needs a passphrase at every
  boot is safer against theft but a liability in an emergency (injured operator, forgotten passphrase,
  handing the box to someone else). Reasonable middle path: **encrypt the OS/secrets; keep the bulk
  read-only corpus on a separate volume that boots without a passphrase** so the knowledge is always
  reachable, while private data stays protected. Decide deliberately and **write the recovery method on
  paper** stored separately.
- **Discretion (op-sec):** Wi-Fi SSID hidden, low transmit power, AP on only when needed. A box that
  isn't advertised isn't a target. Consider a plain/decoy exterior.
- **Tamper-evidence:** seals/labels so you know if the enclosure was opened.
- **Default airplane mode:** no outbound radio unless you deliberately enable it. The optional LoRa/ham
  link lives on **separate** hardware so the knowledge box stays dark by default.
- **Access control:** if multiple users (Community), separate the admin interface from the read-only
  query interface; clients get query access only.
- **Network exposure:** Needfire serves plain HTTP and is designed for a trusted LAN behind the
  airplane-mode firewall — never port-forward it to the internet. If you must reach it across an
  untrusted network, bind it to localhost and front it with a TLS reverse proxy or a VPN/SSH
  tunnel — see [SECURITY.md](SECURITY.md).

---

## 6. Reliability & recovery

- **Redundancy:** mirror the corpus (≥2 copies, 1 offline). Keep a spare boot SSD pre-flashed.
- **MTTR mindset:** every critical part should be swappable in minutes with the spares kit — boot drive,
  corpus drive, Wi-Fi adapter, power converter, cables.
- **Clean shutdown:** battery buffer + shutdown-on-low-battery logic prevents corruption; use a
  journaling filesystem.
- **The paper layer:** print the quick-start, the recovery steps, the disk-decryption recovery method
  (stored separately/securely), and the **corpus index** (which drive + which ZIM holds what). A
  survival computer must be recoverable **without itself.** See runbook §10.
- **Drills:** actually practice a cold-spare rebuild and a backup-drive restore *before* you need them.
  Untested backups and untested recovery plans fail exactly when it matters.

Next: [`06-BUILD-RUNBOOK.md`](06-BUILD-RUNBOOK.md).
