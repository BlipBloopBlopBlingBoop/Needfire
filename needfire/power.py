"""System & power status from /proc and /sys — stdlib only, no psutil.

Works on Linux appliances (Pi / x86). On non-Linux dev machines it degrades to
whatever is readable and marks the rest unknown, so the Status view never breaks.
"""
import os
import shutil
import threading
import time
from pathlib import Path

_POWER_SUPPLY = Path("/sys/class/power_supply")
_THERMAL = Path("/sys/class/thermal")

# Guarded by _cpu_lock: the server handles requests on multiple threads.
_prev_cpu = None
_cpu_lock = threading.Lock()


def _read(path, cast=str, default=None):
    try:
        return cast(Path(path).read_text().strip())
    except Exception:
        return default


def battery():
    """Return battery info if a battery is present, else None."""
    if not _POWER_SUPPLY.exists():
        return None
    for entry in sorted(_POWER_SUPPLY.iterdir()):
        if (entry / "capacity").exists() and _read(entry / "type") == "Battery":
            return {
                "present": True,
                "percent": _read(entry / "capacity", int),
                "status": _read(entry / "status"),
                "power_now_w": _watts(entry),
            }
    return None


def _watts(entry):
    # power_now is in microwatts; or compute from current*voltage (micro units).
    pw = _read(entry / "power_now", int)
    if pw is not None:
        return round(pw / 1_000_000, 2)
    cur = _read(entry / "current_now", int)
    volt = _read(entry / "voltage_now", int)
    if cur is not None and volt is not None:
        return round((cur / 1_000_000) * (volt / 1_000_000), 2)
    return None


def cpu_percent(interval=None):
    """Approximate CPU utilisation from /proc/stat deltas."""
    global _prev_cpu
    line = _read("/proc/stat")
    if not line:
        return None
    parts = line.split("\n")[0].split()[1:]
    vals = [int(x) for x in parts]
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    total = sum(vals)
    with _cpu_lock:
        first = _prev_cpu is None
        if first:
            _prev_cpu = (idle, total)
        else:
            pidle, ptotal = _prev_cpu
            _prev_cpu = (idle, total)
    if first:
        if interval:
            time.sleep(interval)
            return cpu_percent()
        return None
    dt = total - ptotal
    di = idle - pidle
    if dt <= 0:
        return None
    return round(100.0 * (1 - di / dt), 1)


def memory():
    info = {}
    text = _read("/proc/meminfo")
    if not text:
        return None
    for line in text.splitlines():
        k, _, v = line.partition(":")
        info[k.strip()] = int(v.strip().split()[0]) if v.strip() else 0
    total = info.get("MemTotal", 0)
    avail = info.get("MemAvailable", info.get("MemFree", 0))
    if not total:
        return None
    return {
        "total_mb": round(total / 1024),
        "used_mb": round((total - avail) / 1024),
        "percent": round(100 * (total - avail) / total, 1),
    }


def disk(path=None):
    from . import config
    target = str(path or config.NEEDFIRE_HOME)
    if not os.path.exists(target):
        target = "/"
    try:
        total, used, free = shutil.disk_usage(target)
    except Exception:
        return None
    return {
        "total_gb": round(total / 1e9, 1),
        "used_gb": round(used / 1e9, 1),
        "free_gb": round(free / 1e9, 1),
        "percent": round(100 * used / total, 1),
    }


def temperature():
    if not _THERMAL.exists():
        return None
    temps = []
    for zone in sorted(_THERMAL.glob("thermal_zone*")):
        t = _read(zone / "temp", int)
        if t is not None:
            temps.append(t / 1000.0)
    return round(max(temps), 1) if temps else None


def snapshot():
    return {
        "battery": battery(),
        "cpu_percent": cpu_percent(),
        "memory": memory(),
        "disk": disk(),
        "temp_c": temperature(),
        "uptime_s": int(float((_read("/proc/uptime") or "0").split()[0])),
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
