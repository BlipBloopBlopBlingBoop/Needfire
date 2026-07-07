---
title: Batteries and Charging
domain: energy
tier: C1
tags: battery, charging, lithium, lifepo4, lead acid, amp hours, depth of discharge, series parallel, battery bank, storage, runtime
license: CC0-1.0
---

# Batteries and Charging

Batteries store the energy that runs your lights, radio, and tools when the sun is
down or the grid is off. Treating them right makes them last years; abusing them
kills them in weeks — and some fail dangerously.

## Reading capacity
- Capacity is given in **amp-hours (Ah)** at a voltage, or directly in
  **watt-hours (Wh)**: **Wh = Ah × volts.** A 100 Ah 12 V battery holds ~1,200 Wh.
- **Runtime ≈ usable Wh ÷ load in watts.** A 1,200 Wh battery running a 40 W load
  lasts ~30 hours — minus real-world losses.
- **Depth of discharge (DoD):** you rarely use all of it. Lead-acid lasts far
  longer if you use only the **top ~50%**; **LiFePO₄ (lithium iron phosphate)**
  tolerates ~**80–90%**. So a 100 Ah lead-acid gives ~600 usable Wh; a 100 Ah
  LiFePO₄ ~1,000+ Wh. (The toolkit battery calculator uses these.)

## Chemistries at a glance
- **Lead-acid (flooded / AGM):** cheap, robust, heavy; hates deep discharge and
  being left flat (sulfation). Flooded types vent hydrogen — ventilate and keep
  from flame.
- **LiFePO₄:** the best off-grid choice now — long life (thousands of cycles),
  deep discharge, light, safe-ish chemistry; needs a **BMS** and correct charging.
- **Lithium-ion (phones/tools):** dense but less tolerant of abuse; damaged or
  overheated cells can catch fire.
- **NiMH / alkaline (AA/AAA):** for small devices; NiMH rechargeables save waste.

## Series vs. parallel
- **Series** (positive to negative) **adds voltage**, Ah unchanged: two 12 V 100 Ah
  → 24 V 100 Ah.
- **Parallel** (positive to positive) **adds capacity (Ah)**, voltage unchanged:
  two 12 V 100 Ah → 12 V 200 Ah.
- Only combine batteries of the **same type, voltage, age, and charge state**;
  mismatched cells fight each other and fail.

## Charging and care
- Use the **right charger/profile for the chemistry** and voltage — wrong charging
  is the top killer of batteries (and a fire risk for lithium).
- **Do not over-discharge.** A protected LiFePO₄ BMS or a low-voltage cutoff saves
  the pack.
- Keep batteries **cool** (heat shortens life) but **do not charge lithium below
  freezing** — it damages the cells.
- Store lead-acid **charged** (topped up); store lithium around **50%** in a cool
  place, and check periodically.
- **Fuse every battery's positive** close to the terminal — a shorted battery
  delivers hundreds of amps and starts fires (see *Electrical Safety*).

## Safety
Batteries store dangerous energy: shorts cause burns, fires, and explosions.
Ventilate charging areas (hydrogen from lead-acid), keep terminals covered,
never puncture or burn cells, and isolate any battery that is swollen, hot, or
leaking.
