---
title: Off-Grid Solar Power Basics
domain: energy
tier: C3
license: CC0-1.0
---

# Off-Grid Solar Power Basics

A small solar system can keep lights, communications, and a low-power computer
running indefinitely. The core components are panel, charge controller, battery,
and loads.

## The components
- **Solar panel (PV)** — converts sunlight to DC electricity, rated in watts.
- **Charge controller** — regulates panel output to charge the battery safely.
  **MPPT** controllers harvest ~15–30% more than cheaper **PWM** controllers.
- **Battery** — stores energy for night and cloudy periods. **LiFePO4** chemistry
  is preferred for long cycle life, safety, and tolerance of heat and cold.
- **Loads** — your devices. Running them on DC avoids inverter losses; an inverter
  is only needed for AC-only equipment.

## Simple sizing
1. Estimate daily energy use: sum each device's watts × hours per day = watt-hours
   (Wh) per day.
2. Battery: size for the days of autonomy you want.
   `battery_Wh ≈ daily_Wh × autonomy_days ÷ usable_depth` (LiFePO4 usable ~0.85).
3. Solar: replace daily use accounting for losses and limited sun.
   `solar_W ≈ daily_Wh ÷ (peak_sun_hours × 0.7)`. Add margin for bad days.

Example: 600 Wh/day, 2 days autonomy → ~1,400 Wh battery; at 3.5 sun hours →
~245 W of panel, so fit 400 W for headroom.

## Practical tips
- Keep panels clean and angled toward the sun; even partial shade cuts output
  sharply.
- Do not charge LiFePO4 below 0 °C — it damages the cells. Insulate the battery.
- Fuse every source line. Measure real consumption with an inline watt-meter and
  size from your own numbers, not estimates.
