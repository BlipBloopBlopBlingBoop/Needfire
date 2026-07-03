#!/usr/bin/env python3
"""Build a Needfire appliance disk image via Docker — works on Windows/Mac/Linux.

The real image builders (os/image/raspberry-pi/build-image.sh and
os/image/x86/build-iso.sh) are Linux-only: they need root, loop devices, parted,
qemu/binfmt and friends. This wrapper runs them *inside* a privileged Docker
container so people on Windows or macOS (via Docker Desktop) can bake the same
flashable images without a Linux box.

Pure stdlib so it runs on a stock Python (including Windows Python).

    python scripts/build-image.py <pi|x86> [--out DIR] [--rebuild]

Steps: check Docker is installed -> build the builder image -> (pi) register
arm64 emulation on the host -> probe that loop devices work under --privileged
-> run the builder with the repo bind-mounted at /work. The image lands in dist/.
"""
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCKER_DIR = REPO / "os" / "image" / "docker"
IMAGE_TAG = "needfire-imgbuild"


def eprint(*a):
    print(*a, file=sys.stderr)


def docker_install_help():
    """Per-OS guidance for installing Docker, printed when it is missing."""
    eprint("error: Docker is required but was not found on your PATH.\n")
    if sys.platform.startswith("win"):
        eprint("  Windows: install Docker Desktop and enable the WSL2 backend:")
        eprint("    https://www.docker.com/products/docker-desktop/")
    elif sys.platform == "darwin":
        eprint("  macOS: install Docker Desktop:")
        eprint("    https://www.docker.com/products/docker-desktop/")
    else:
        eprint("  Linux: install Docker Engine, e.g.")
        eprint("    sudo apt-get install docker.io      # Debian/Ubuntu")
        eprint("    curl -fsSL https://get.docker.com | sh   # any distro")
    eprint("\nInstall Docker, start it, then re-run this command.")


def run(cmd, *, check=True, quiet=False):
    """Run a subprocess inheriting stdio. Returns the CompletedProcess.

    Never lets a raw traceback escape for an ordinary command failure — callers
    decide what to do with a nonzero return code.
    """
    if not quiet:
        eprint("+ " + " ".join(cmd))
    try:
        return subprocess.run(cmd, check=check)
    except FileNotFoundError:
        eprint(f"error: command not found: {cmd[0]}")
        raise SystemExit(2)


def ensure_docker():
    if shutil.which("docker") is None:
        docker_install_help()
        raise SystemExit(2)


def image_exists():
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", IMAGE_TAG],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return r.returncode == 0
    except FileNotFoundError:
        return False


def build_builder_image(rebuild):
    if image_exists() and not rebuild:
        eprint(f"==> Builder image '{IMAGE_TAG}' already present (use --rebuild to force).")
        return
    eprint(f"==> Building builder image '{IMAGE_TAG}' from {DOCKER_DIR}")
    # Build context is the docker/ dir; the Dockerfile COPYs entrypoint.sh by name.
    r = run(["docker", "build", "-t", IMAGE_TAG, str(DOCKER_DIR)], check=False)
    if r.returncode != 0:
        eprint("error: failed to build the Docker builder image (see output above).")
        raise SystemExit(1)


def register_binfmt():
    """Best-effort: register arm64 emulation on the host for cross-arch Pi builds."""
    eprint("==> Registering arm64 emulation on the host (best-effort)")
    r = run(
        ["docker", "run", "--privileged", "--rm", "tonistiigi/binfmt", "--install", "arm64"],
        check=False,
    )
    if r.returncode != 0:
        eprint("  [warn] could not register arm64 binfmt; if the Pi build fails to")
        eprint("         emulate aarch64, register it manually with the command above.")


def probe_loop_devices():
    """Confirm --privileged actually yields usable loop devices before the long build."""
    eprint("==> Checking loop-device access under --privileged")
    r = subprocess.run(
        ["docker", "run", "--privileged", "--rm",
         "--entrypoint", "losetup", IMAGE_TAG, "-f"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if r.returncode != 0:
        eprint("error: loop devices are not available in privileged containers here.")
        eprint("  Image building needs --privileged plus working /dev/loop* devices.")
        eprint("  Common causes: rootless Docker, or a locked-down host/CI runner.")
        eprint("  Docker Desktop (WSL2 on Windows, the Linux VM on macOS) provides them")
        eprint("  out of the box — use it, or run on a normal Linux host with root Docker.")
        raise SystemExit(1)


def real_build(target, out_dir):
    # The repo is bind-mounted at /work. On Windows, pass the absolute path as-is:
    # Docker Desktop accepts native Windows paths (e.g. C:\Users\me\repo) for -v.
    repo_arg = str(REPO)
    cmd = ["docker", "run", "--privileged", "--rm",
           "-v", f"{repo_arg}:/work", IMAGE_TAG, target]
    eprint(f"==> Building the {target} image (this can take a while)")
    r = run(cmd, check=False)
    if r.returncode != 0:
        eprint("error: the image build failed (see output above).")
        raise SystemExit(1)

    dist = REPO / "dist"
    produced = "bothy-pi.img" if target == "pi" else "bothy-x86.raw"
    img = dist / produced

    # Optional: copy the result to a user-chosen directory.
    final = img
    if out_dir is not None:
        out_path = Path(out_dir)
        out_path.mkdir(parents=True, exist_ok=True)
        if img.is_file():
            final = out_path / img.name
            shutil.copy2(img, final)

    eprint("")
    eprint("==> Done.")
    if final.is_file():
        eprint(f"    Image: {final}")
    else:
        eprint(f"    Image expected in: {dist}")
    eprint("")
    if target == "pi":
        eprint("    Flash it with Raspberry Pi Imager (choose 'Use custom' -> this .img),")
        eprint("    balenaEtcher, or:  sudo dd if=<image> of=/dev/sdX bs=4M status=progress")
    else:
        eprint("    Flash it with balenaEtcher, or:")
        eprint("    sudo dd if=<image> of=/dev/sdX bs=4M status=progress")


def parse_args(argv):
    p = argparse.ArgumentParser(
        prog="build-image.py",
        description="Build a Needfire appliance disk image via Docker "
                    "(cross-platform: Windows/Mac/Linux).",
    )
    p.add_argument("target", choices=["pi", "x86"],
                   help="which appliance image to build")
    p.add_argument("--out", metavar="DIR", default=None,
                   help="also copy the finished image into this directory")
    p.add_argument("--rebuild", action="store_true",
                   help="force a rebuild of the Docker builder image")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    # --help is handled by argparse above and never reaches here, so Docker is
    # only required for an actual build.
    ensure_docker()
    build_builder_image(args.rebuild)
    if args.target == "pi":
        register_binfmt()
    probe_loop_devices()
    real_build(args.target, args.out)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        eprint("\ninterrupted.")
        raise SystemExit(130)
