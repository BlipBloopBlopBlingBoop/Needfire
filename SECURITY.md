# Security

## Threat model in one paragraph

Needfire is a **single-owner offline appliance**. The default posture is
airplane mode: the app needs no internet to function, the appliance firewall
(`os/firewall/needfire-airplane.nft`) drops all outbound traffic, and the only
people who can reach the box are the ones on its Wi-Fi or LAN. Within that
boundary, the design splits the surface in two: the knowledge surfaces
(Library, Emergency, Toolkit, read-only status) are **open to everyone on the
network** — in an emergency, nobody should be locked out of first-aid
instructions — while the powerful surfaces (Studio, the terminal, file editing,
model pulls, content downloads, reindexing) are gated behind a single **owner
password**.

## Studio is intentional, authenticated code execution

Anyone with the owner password can run arbitrary commands and Python on the
machine, as the service user. That is the feature, not a bug — it makes the
box a standalone computer. The controls around it:

- Password minimum of **8 characters** (longer is better), hashed with
  **PBKDF2-HMAC-SHA256, 200,000 iterations** and a random 16-byte salt,
  compared in constant time.
- **Per-IP login backoff**: 5 failures start an exponential lockout, capped at
  5 minutes.
- Sessions ride an **`HttpOnly; SameSite=Strict`** cookie; the secret store
  (`security.json`) is written mode `0600`.
- Gated endpoints: `/api/fs`, `/api/run`, `/api/models/pull`,
  `/api/models/delete`, `/api/models/roles`, `/api/content`, `/api/reindex`
  (the read-only `/api/reindex/status` poll stays open).

## Plaintext HTTP on the LAN — know the boundary

Needfire serves **plain HTTP**. There is no TLS by design: the box is offline,
so no certificate authority is reachable, and self-signed certificates train
users to click through warnings. The consequence: **the owner password and
session cookie cross the network unencrypted**, so the trust boundary is your
Wi-Fi passphrase (use WPA2/WPA3 with a strong passphrase — see
`os/network/hostapd-needfire.conf.example`) or your wired LAN.

**Never port-forward Needfire to the internet.** If you must reach it across
an untrusted network:

1. Bind it to localhost: `NEEDFIRE_HOST=127.0.0.1`.
2. Front it with a TLS reverse proxy (Caddy, nginx) or reach it through a
   VPN/SSH tunnel.

## Corpus integrity

- The bundled **seed library** is pinned: every document's SHA-256 is recorded
  in `seed-corpus/seed-manifest.json` and checkable with
  `python3 -m needfire verify --seed`.
- **Catalog downloads** can pin the publisher's hash: set `sha256` on a
  catalog source (Kiwix publishes a `.sha256` file next to each ZIM) and the
  download is verified before it lands — a mismatch is discarded. Unpinned
  downloads are trust-on-first-use: hashed on arrival into
  `NEEDFIRE_HOME/manifest.json` and re-checkable any time with
  `python3 -m needfire verify`.
- **URL policy**: public download sources must be `https://`; plain `http://`
  is accepted only for LAN mirrors (loopback/private addresses, `.local`
  names) or when a hash is pinned.
- The Raspberry Pi image builder checksum-verifies the **base OS image**
  before baking (`--sha256` to pin out-of-band).

## Container and appliance hardening

- The Docker image runs as a dedicated **non-root user** (uid 10001) with a
  pinned base image; the systemd unit runs a dedicated `needfire` user with
  `NoNewPrivileges`, `ProtectSystem=strict`, and friends.
- The appliance firewall admits only the Needfire port and SSH from the LAN
  and drops everything outbound. Lift it deliberately for a corpus download,
  then re-apply.

## Reporting a vulnerability

Please report suspected vulnerabilities **privately** via GitHub Security
Advisories on this repository ("Report a vulnerability" under the Security
tab) rather than opening a public issue. Include reproduction steps and the
commit or version you tested. You should hear back within a week.
