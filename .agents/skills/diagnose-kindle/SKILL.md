---
name: diagnose-kindle
description: Procedures for debugging Kindle SSH communication, daemon autostart, network discovery, and FBInk rendering.
---

# Diagnose Kindle Skill

Use this skill when diagnosing device connectivity, script installation, or display issues on a Kindle Paperwhite/Touch.

## 1. Network Connectivity & Discovery
- The Kindle display loop (`kindle/dash-loop.sh`) attempts to find the host computer using:
  1. mDNS (`paperdeck.local`, `localhost`).
  2. Local subnet sweep on port `8787` (`/api/ping`).
- Ensure port `8787` is open on the host firewall.
- Test reachability from host:
  ```bash
  curl -I http://localhost:8787/api/ping
  ```

## 2. SSH Connection Verification
- The Electron app uses `ssh2` to connect as `root` (port 22).
- Check `KINDLE_INSTALLATION.md` for prerequisites:
  - SSH enabled via USBNetwork or KUAL.
  - Device and computer connected to the same Wi-Fi subnet.
  - Password or authorized keys configured on Kindle.

## 3. Remote Filesystem Checks
The Kindle requires:
- `/mnt/us/dash-loop.sh`
- `/mnt/us/dash-autostart.sh`
- `/mnt/us/dash-autostart.env`
- `/etc/upstart/kindle-dashboard.conf` (Upstart job)
- `fbink` executable in `/usr/bin/fbink`, `/mnt/us/bin/fbink`, or in `$PATH`.

## 4. Test Manual Display
On the Kindle via SSH:
```bash
# Draw PNG directly to e-ink screen
fbink -c -g file=/mnt/us/dash.png
```
- Flag `-c`: clears the screen before drawing.
- Flag `-g`: draws a grayscale image.
