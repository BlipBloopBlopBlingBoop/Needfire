---
title: Celestial Navigation — Position from Sun and Stars
domain: navigation
tier: C2
tags: celestial navigation, latitude, longitude, polaris altitude, noon sun, sextant, watch compass, solar declination, position without gps, angle measurement
license: CC0-1.0
---

# Celestial Navigation — Position from Sun and Stars

With no GPS, the sky still tells you **where you are**, not just which way is
north. Latitude comes from how high Polaris or the noon sun stands; longitude
comes from *when* your local noon happens against a watch. Rough tools give rough
answers — but even ±50 km places you on a map. The toolkit's **Latitude finder**
and **Sun & Moon** tools do the arithmetic; this page is the method.

## Measuring angles with what you have
- **Hand at arm's length:** a fist ≈ **10°**, thumb-to-little-finger span ≈ **20°**,
  a finger width ≈ **2°** (calibrate: horizon to zenith must total 90°).
- **Improvised quadrant:** hang a weighted string from the flat edge of a
  protractor (or a card marked in degrees). Sight along the flat edge at the star;
  the string marks the angle from vertical — altitude = 90° minus that reading.
- **Stick and shadow** for the sun: never look at the sun — measure its altitude
  from a vertical stick: altitude = angle whose tangent is stick height ÷ shadow
  length (the toolkit computes this).

## Latitude from Polaris (Northern Hemisphere)
**Your latitude ≈ the altitude of Polaris** above the horizon. Find Polaris with
the Big Dipper's pointer stars (see *Finding Direction by Sun and Stars*), measure
its altitude, and read latitude directly. Polaris sits ~0.7° from the true pole,
so uncorrected readings are within about a degree (~110 km) — good enough to set
a map, better with a steady quadrant.

## Latitude from the noon sun (works everywhere)
At **local solar noon** (shortest shadow of the day):
1. Measure the sun's altitude (by shadow-stick, never by eye).
2. Look up or compute the **solar declination** for the date — the latitude where
   the sun is overhead: **+23.4° at the June solstice, 0° at the equinoxes,
   −23.4° in December** (the toolkit computes the exact value).
3. If the sun was **toward the equator** from you (south of you in the Northern
   Hemisphere): **latitude = 90° − altitude + declination.**
   If the sun was on your poleward side: **latitude = declination − (90° − altitude).**

## Longitude from time
The Earth turns **15° per hour**, so longitude is a clock problem: compare *when*
your local solar noon happens against a watch still set to a **known reference
time** (UTC, or home time whose offset you know).
1. Find the moment of **local solar noon** — track the shortest shadow, or halve
   the time between sunrise and sunset.
2. Every hour your noon differs from 12:00 reference = **15° of longitude**
   (earlier = east of the reference meridian, later = west). Each 4 minutes = 1°.
3. Correct for the **equation of time**: true noon drifts up to ±16 minutes from
   clock noon through the year (the toolkit applies it). Without a reliable watch,
   longitude is the hard one — protect a timepiece.

## Direction from a watch (when the sun is out)
- **Northern Hemisphere (analog watch, standard time):** point the **hour hand at
  the sun**; **south** lies halfway between the hour hand and 12.
- **Southern Hemisphere:** point **12 at the sun**; **north** lies halfway between
  12 and the hour hand.
- Digital watch: sketch a clock face with the current time and do the same. On
  daylight-saving time use 1 o'clock instead of 12. Rough (±10–20°), worst in the
  tropics and mid-day.

## Making it useful
A position from these methods is a **circle, not a pin** — cross-check latitude
(sky) with longitude (time), with dead reckoning (see *Route Planning and Dead
Reckoning*), and with the terrain around you. Practice each measurement at home
against a known position before your life depends on it.

> General reference only. These are approximation methods — treat every fix as
> having generous error, and confirm against the map and terrain.
