---
title: Using a Multimeter
domain: electronics
tier: C3
tags: multimeter, voltage test, continuity, resistance, measure amps, dmm, troubleshooting, test battery, ohms, electrical testing
license: CC0-1.0
---

# Using a Multimeter

A multimeter is the single most useful tool for diagnosing electrical problems —
it measures **voltage, current, resistance, and continuity** so you can find dead
batteries, broken wires, blown fuses, and bad connections instead of guessing.
Pair this with *Basic Electronics and Ohm's Law* and *Electrical Safety*.

## The jacks and dial
- Black lead → **COM**; red lead → the **VΩ** jack for volts/ohms/continuity, or
  the dedicated **A/mA** jack for current.
- The dial selects the function and (on manual meters) the range — pick a range
  **above** the value you expect, or use auto-ranging.

## Voltage (the everyday test) — leads in parallel
Set to **DC volts (V⎓)** for batteries and DC systems, **AC volts (V~)** for mains.
Touch the probes **across** the two points (in parallel), e.g. across a battery's
terminals.
- A 12 V battery reading ~12.6 V is well charged; ~12.0 V is about half; below
  ~11.8 V (resting) is flat. A "1.5 V" cell below ~1.2 V is spent.
- Reading 0 V where you expect voltage → a break, blown fuse, or dead source
  upstream.

## Continuity and resistance — power OFF
**Only test resistance/continuity on an unpowered, disconnected circuit** — voltage
present will give false readings or damage the meter.
- **Continuity** (the beeper): touch both ends of a wire, fuse, or switch. A beep /
  near-0 Ω = an unbroken path. Silence / "OL" = open (broken wire, blown fuse, open
  switch). This is how you find breaks and check fuses fast.
- **Resistance (Ω):** measures a component's value; "OL"/infinite means open.

## Current (amps) — leads in series
Measuring current means **breaking the circuit and putting the meter in line** so
all the current flows *through* it. Move the red lead to the **A/mA jack**, and do
not exceed the meter's fuse rating — a meter left in "amps" and touched across a
voltage will short and blow its fuse (or worse). Return the lead to the V jack
when done.

## Finding faults
- **No power to a device:** check for voltage at the source, then step downstream
  — battery → fuse → switch → connector → load — until the voltage disappears; the
  fault is at that step.
- **Intermittent faults:** wiggle wires and connectors while watching the reading;
  a jumping value reveals a loose or corroded connection.
- **Check fuses** with continuity, not by eye — a fuse can look fine and be open.

## Safety
Treat mains and any source above ~50 V as dangerous — see *Electrical Safety*.
Use meter leads rated for the voltage, keep fingers behind the probe guards, work
one-handed on live circuits where possible, and de-energise before working
whenever you can.
