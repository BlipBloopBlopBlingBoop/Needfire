# Bootable appliance images

These scripts bake a **flashable image** with Needfire pre-installed and set to start
on first boot — a true "burn-and-boot" survival appliance.

> **Status: verified-by-inspection.** Image baking needs root, loop devices, ~10+ GB
> of scratch space, and qemu/binfmt for cross-architecture builds. It cannot be
> exercised inside the restricted build environment this repo was generated in, so
> these scripts are provided as a reviewed starting point. Run them on a real Linux
> host. They are deliberately simple and lean on standard, well-documented tools
> (`pi-gen`-style customization for the Pi; `mkosi`/`debootstrap` for x86).

## Raspberry Pi 5 / ARM — `raspberry-pi/build-image.sh`
Starts from Raspberry Pi OS Lite (64-bit) and injects Needfire + a first-boot unit
that runs `os/install.sh`. Output: a `.img` you flash with Raspberry Pi Imager or
`dd`. Designed for the lowest-power DIY appliance.

```
sudo bash os/image/raspberry-pi/build-image.sh
```

## x86 mini-PC — `x86/build-iso.sh`
Uses `mkosi` (or `debootstrap` + `grub`) to build a bootable Debian image/ISO with
Needfire preinstalled. Output: an `.img`/`.iso` for a USB stick or internal disk.

```
sudo bash os/image/x86/build-iso.sh
```

## Building on Windows or Mac (Docker)
The two scripts above are Linux-only (they need root, loop devices, `parted`,
`qemu`/`binfmt`). If you are on **Windows or macOS**, build the same images
inside a container instead:

1. Install **Docker Desktop** — <https://www.docker.com/products/docker-desktop/> —
   and start it. On Windows, enable the WSL2 backend.
2. From the repo root, run one of:

   ```
   python scripts/build-image.py pi      # Raspberry Pi image
   python scripts/build-image.py x86     # x86 image
   ```

   or, equivalently, via make:

   ```
   make image-docker TARGET=pi
   make image-docker TARGET=x86
   ```

The helper builds a small Debian toolbox image (`os/image/docker/`) that carries
the full imaging toolchain, then runs the existing builder inside it. Image
baking needs `--privileged` containers with working loop devices; Docker
Desktop's WSL2 (Windows) / Linux-VM (macOS) backend provides these out of the
box. For Pi builds it also registers arm64 emulation on the host automatically.

The finished image appears in **`dist/`** (`bothy-pi.img` or `bothy-x86.raw`).
Flash a Pi image with **Raspberry Pi Imager** (or `dd`), and an x86 image with
**balenaEtcher** or `dd`.

## What the images contain
- A minimal Debian/Raspberry Pi OS base.
- Python 3 (the only hard runtime dependency).
- Needfire app at `/opt/needfire`, the seed corpus, the catalog, and the systemd service.
- Airplane-mode firewall enabled; Wi-Fi AP config staged (you set SSID/passphrase).
- **No bulk corpus** — that is downloaded after first boot (it is large and
  user-selected). The seed library makes the box useful immediately.

## After flashing
1. Boot the device; it auto-starts Needfire on `http://<device-ip>:8848/`.
2. Connect to its Wi-Fi AP (after you set a passphrase) or your LAN.
3. Open the Corpus tab and download the knowledge you want.
4. Print the paper quick-start (see `../../06-BUILD-RUNBOOK.md` §10).
