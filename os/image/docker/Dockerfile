# =============================================================================
# Needfire — appliance-image builder toolbox.
# This image bundles the full Linux imaging toolchain the two existing builders
# (os/image/raspberry-pi/build-image.sh and os/image/x86/build-iso.sh) need, so
# they run *unmodified* inside the container. Non-Linux users (Windows/Mac) can
# thus bake the flashable disk images from Docker Desktop.
#
# IMPORTANT: this container manipulates loop devices and partitions, so it MUST
# be run with `--privileged` (and the repo bind-mounted at /work). Docker
# Desktop's WSL2 / Linux VM backend provides the loop devices this needs.
#   docker run --privileged --rm -v <repo>:/work needfire-imgbuild <pi|x86>
#
# Build context is this directory (os/image/docker/), so entrypoint.sh is copied
# by its bare name.
# =============================================================================
FROM debian:bookworm-slim

# Full toolchain cross-checked against the two builder scripts:
#   Pi  build-image.sh: xz(xz-utils) losetup(util-linux) mount(mount) parted
#                       e2fsck/resize2fs(e2fsprogs) qemu-aarch64-static
#                       (qemu-user-static) curl truncate(coreutils) cp/mktemp
#                       binfmt registration (binfmt-support / update-binfmts)
#   x86 build-iso.sh:   mkosi debootstrap grub(grub-pc-bin) rsync ca-certificates
#                       python3 dd(coreutils) systemd-boot (pulled by mkosi)
# dosfstools + kpartx + gdisk/fdisk are included for FAT boot partitions and
# partition mapping that the Pi/mkosi flows can rely on.
RUN apt-get update && apt-get install -y --no-install-recommends \
        parted \
        e2fsprogs \
        dosfstools \
        xz-utils \
        curl \
        ca-certificates \
        qemu-user-static \
        binfmt-support \
        kpartx \
        mount \
        util-linux \
        coreutils \
        rsync \
        debootstrap \
        mkosi \
        grub-pc-bin \
        grub-efi-amd64-bin \
        systemd-boot \
        fdisk \
        gdisk \
        python3 \
        bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
