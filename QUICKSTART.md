# Needfire Quickstart — from any computer to a dedicated appliance

Needfire is an offline survival knowledge computer: a searchable, citable
library with guided emergency protocols, field tools, and (optionally) local
AI — all served from your own machine, no internet required.

**What you need:** any computer made in the last ~15 years, about 200 MB of
free disk space, and 10 minutes. Everything below is free.

> **Use at your own risk.** Needfire is reference material, not professional
> advice — and not a substitute for calling your local emergency number when
> one works. The plain-language details: [DISCLAIMER.md](DISCLAIMER.md).

---

## 1. Windows (10 or 11)

1. **Double-click `Start-Needfire-Windows.bat`.**
2. **If Python is already installed**, that's it — a black window opens,
   and after a minute your browser opens Needfire at
   `http://localhost:8848`.
3. **If Python is missing**, the window says so and opens
   [python.org/downloads](https://www.python.org/downloads/) for you:
   - Click the big yellow **"Download Python 3.x"** button.
   - Run the installer and click **"Install Now"**. You do **not** need to
     tick any checkboxes — the standard install includes the `py` launcher
     the .bat file uses.
   - When it finishes, double-click `Start-Needfire-Windows.bat` again.
4. The first time it runs, **Windows Firewall** may ask about Python.
   Click **"Allow access"** — this only lets phones on YOUR network reach
   Needfire; nothing goes to the internet.
5. **Keep the black window open** while you use Needfire. Closing it stops
   the app. (Nothing is lost — start it again any time.)

> **Note:** if you ever type `python` in a command prompt and the
> *Microsoft Store* opens, that is a placeholder, not real Python. Ignore
> it — the launcher detects and bypasses it. Install from python.org.

## 2. Mac

1. The **first time** after downloading, macOS will refuse a plain
   double-click. **Right-click (or Control-click) `Start-Needfire-Mac.command`,
   choose "Open"**, then click **"Open"** in the dialog. From then on a
   normal double-click works.
2. If a dialog says the computer needs the **"command line developer
   tools"**, click **Install** and wait (a few minutes, one time only).
   That gives macOS its copy of Python. Then open the file again.
3. A Terminal window opens; after a minute your browser opens Needfire at
   `http://localhost:8848`. **Keep the Terminal window open** while you
   use it.

## 3. Linux

```bash
bash Start-Needfire-Linux.sh
```

That's the whole thing (or double-click the file → "Run in Terminal").
If Python 3 is somehow missing: `sudo apt install python3` (Debian/Ubuntu),
`sudo dnf install python3` (Fedora), `sudo pacman -S python` (Arch).

## 4. Use it from your phone

Needfire serves your **whole household**, not just one screen:

1. Make sure the phone is on the **same Wi-Fi network** as the computer
   running Needfire.
2. When Needfire starts, its window prints two addresses — use the second
   one on your phone, e.g.:

   ```
   On this computer:            http://localhost:8848
   From phones on this network: http://192.168.1.42:8848
   ```

3. On the phone, open that address in the browser, then use
   **"Add to Home Screen"** (Share menu on iPhone, ⋮ menu on Android).
   Needfire installs as an app with its own icon, and the emergency
   protocols keep working even if the connection blips.

Can't find the address? On the computer run `ipconfig` (Windows) or
`ip addr` (Linux), or look in System Settings → Wi-Fi (Mac) — you want the
number that starts with `192.168.` or `10.`.

## 5. Turn an old computer into a Bothy (dedicated appliance)

Any spare laptop or mini-PC can become an always-on Needfire box — "the
Bothy" — that starts at boot and broadcasts its own Wi-Fi:

1. **Install Ubuntu Server** (free) on the spare machine: on your everyday
   computer, download the ISO from ubuntu.com/download/server and write it
   to a USB stick with [balenaEtcher](https://etcher.balena.io) (a simple
   graphical tool — pick ISO, pick stick, click Flash). Boot the spare
   machine from the stick and accept the defaults.
2. **Copy this whole folder** onto it (USB stick is fine).
3. In its terminal, from inside the folder:

   ```bash
   sudo bash os/install.sh --ap
   ```

   That installs Needfire as a system service (starts at every boot),
   builds the index, and — with `--ap` — sets up a **Wi-Fi access point**
   so phones can join the network named `BOTHY` and browse to
   `http://bothy.local:8848` with **no other infrastructure at all**.
4. Unplug keyboard and monitor. It's an appliance now.
   `sudo bash os/uninstall.sh` removes it cleanly.

## 6. Raspberry Pi & bare metal

For a from-scratch build — parts list, assembly, power, hardening — follow
**[06-BUILD-RUNBOOK.md](06-BUILD-RUNBOOK.md)** step by step. To bake a
flashable "burn-and-boot" SD/USB image instead, see
**[os/image/README.md](os/image/README.md)** (`make image-pi`,
`make image-x86`). Hardware tiers and costs: **[README.md](README.md)** and
**[bom/](bom/)**.

**Build an appliance image from Windows or Mac (Docker Desktop).** The imaging
tools are Linux-only, but you can run them inside a container. Install
[Docker Desktop](https://www.docker.com/products/docker-desktop/) (free), then:

```bash
python scripts/build-image.py pi      # or x86  (also: make image-docker TARGET=pi)
```

It runs the Linux imaging tools in a privileged container and drops the finished
image in `dist/`. Flash it with **Raspberry Pi Imager** (Pi) or
**balenaEtcher**/`dd` (x86).

## 7. Docker (if you already use it)

```bash
docker compose up        # then open http://localhost:8848
```

## 8. Add AI smarts (install a model)

Needfire works with **no AI model** — it answers straight from the cited
sources. To upgrade to synthesized, cited answers, open **System → AI Models**.
If [Ollama](https://ollama.com) isn't installed yet, the page shows the
download link for your OS (install is now guided in-app). Once it's running,
click **Install** next to a curated small model (llama3.2:1b, qwen3:4b,
gemma3:4b, nomic-embed-text, …) and watch the progress bar. You can delete
models and pick which one fills the tiny / reason / embed role.

## 9. Download more of the library

The bundled 81-document library is a starter set. Open **System → Content** to
grow it: paste the real URL for a shipped catalog source, **add any download
URL** (ZIM/PDF/text), or **import a file already on the machine** (`.md`,
`.txt`, or `.zim`, by full path). Then hit **Reindex** so the new content
becomes searchable.

## 10. Studio — use it as a real computer

**System → Studio** (or the top nav on desktop) turns Needfire into a
standalone workstation with four tools: a web **Playground** (live HTML/CSS/JS
preview), **Files & Editor** (edit files in a workspace folder — or the app's
own UI to customize it), a **Terminal** (runs commands on the machine), and a
**Python** scratchpad.

The **first time** anyone opens Studio (or installs a model / downloads
content), they set an **owner password**. After that these powerful tools ask
for it; Library, Emergency, and Toolkit stay open to everyone on the Wi-Fi.

> **Please read:** anyone who has the password can run any code on the
> computer. That's on purpose — it's a single-owner appliance. Choose a real
> password (at least 8 characters; longer is better), and remember the tools
> are only as private as your Wi-Fi and that password. The full threat model
> is in [SECURITY.md](SECURITY.md).

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| "Python is not installed" | Follow the python.org page the launcher opened, click **Install Now**, run the launcher again. |
| Typing `python` opens the Microsoft Store | That's a Windows placeholder, not Python. Install from python.org; the launcher handles the rest. |
| "Port 8848 is in use" | Something else uses that port. Run the launcher with a different port: `NEEDFIRE_PORT=8899` (see the message the launcher prints). |
| Firewall pop-up on first start | Click **Allow**. Needfire only listens on your own network; nothing is sent to the internet. |
| Browser didn't open by itself | Open any browser and type `http://localhost:8848`. |
| Antivirus flags the .bat file | It's a 60-line text file that starts Python — right-click → Edit to read it yourself. |
| Phone can't reach it | Same Wi-Fi? Use the `192.168.…` address from the Needfire window, not "localhost". Guest Wi-Fi networks often block device-to-device traffic. |
| It's slow on the first start | Normal — it's building the search index once. Later starts are instant. |
| I deleted something / it's broken | Delete the hidden `.needfire-home` folder and start again — it rebuilds itself. Your zip/folder is the only thing you must keep. |
| Studio asks for a password | The first person to open it sets the owner password. Set one — it protects code execution on the machine. Then keep it safe. |
| Password refused as too short | Use at least 8 characters — it guards code execution on the machine, so longer is better. |
| A model won't install | Is Ollama running? **System → AI Models** shows the per-OS download link if it isn't; install it, then try **Install** again. |

---

*Stopping Needfire never loses data. The bundled 81-document library, the
emergency protocols, and the toolkit all work with zero setup beyond the
steps above; downloading the full reference corpus (encyclopedias, manuals)
is optional and covered in [07-CORPUS-ACQUISITION.md](07-CORPUS-ACQUISITION.md).*
