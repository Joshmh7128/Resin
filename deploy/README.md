# Deploying to an Oracle Cloud Always Free VM

This walks through provisioning the VM (you do this — it needs your account and card
verification) and configuring it (I can do this with you once you have SSH access).

## 1. Provision the VM (you)

In the Oracle Cloud console:

1. Create a Compute instance using the **VM.Standard.A1.Flex** shape (the Always Free
   ARM shape) — 2 OCPU / 12GB RAM is comfortably enough for this app.
2. Choose an Ubuntu image (22.04 or 24.04 LTS).
3. Add your SSH public key during creation (or upload one after).
4. **Open ports 80 and 443.** This trips people up because it needs changes in *two*
   places:
   - The instance's **Security List / Network Security Group** in the OCI console
     (Ingress Rules → add TCP 80 and 443 from 0.0.0.0/0).
   - The VM's own firewall — Ubuntu images on OCI ship with `iptables` rules that
     block everything but SSH by default. You'll open these in step 2 below.
5. Note the VM's public IP, and point a domain (or subdomain) at it with an A record
   if you have one — Caddy needs a real domain to issue HTTPS certificates.

## 2. Give me access

Once the VM exists, add this machine's SSH key to it (or share the connection details)
so I can run the rest of this directly instead of you copy-pasting every command.

## 3. Initial server setup

```bash
# Open the firewall for HTTP/HTTPS (Ubuntu's default iptables blocks them on OCI)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save   # if installed; otherwise persist however your image expects

# Node.js (LTS)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3 git

# Caddy (reverse proxy + automatic HTTPS)
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

# A dedicated, unprivileged user to run the app
sudo useradd --system --create-home --shell /usr/sbin/nologin resin
```

## 4. Get the app onto the box

```bash
sudo mkdir -p /opt/resin
sudo chown resin:resin /opt/resin
sudo -u resin git clone <your-repo-url> /opt/resin
cd /opt/resin
sudo -u resin npm ci --legacy-peer-deps
```

Create `/opt/resin/.env` (not committed to git):

```bash
DATABASE_URL="file:./prisma/dev.db"
SESSION_SECRET="$(openssl rand -base64 32)"
NEXT_PUBLIC_BASE_URL="https://your-domain.com"
```

Run the actual `openssl rand -base64 32` command and paste its output in —
don't reuse the placeholder from local dev.

## 5. First deploy

```bash
cd /opt/resin
sudo -u resin npx prisma migrate deploy
sudo -u resin npm run seed      # creates /store/demo
sudo -u resin npm run build
```

## 6. Install the systemd units

```bash
sudo cp deploy/resin.service deploy/resin-backup.service deploy/resin-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now resin
sudo systemctl enable --now resin-backup.timer
```

Allow the `resin` user to restart its own service without a password (needed for
`deploy/deploy.sh`):

```bash
echo "resin ALL=(root) NOPASSWD: /usr/bin/systemctl restart resin" | sudo tee /etc/sudoers.d/resin-restart
```

## 7. Point Caddy at your domain

Edit `deploy/Caddyfile`, replacing `your-domain.com` with your real domain, then:

```bash
sudo cp /opt/resin/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy fetches and renews the TLS certificate automatically.

## 8. Verify

- `https://your-domain.com` loads the landing page
- `https://your-domain.com/store/demo` loads the seeded demo store
- `sudo journalctl -u resin -f` shows the app's logs
- `sudo systemctl status resin-backup.timer` shows the next scheduled backup

## Ongoing deploys

From then on, shipping a change is:

```bash
sudo -u resin -i
cd /opt/resin
./deploy/deploy.sh
```

## Restoring from a backup

Backups land in `/home/resin/backups/dev-<timestamp>.db` (the `resin` user's own home
directory, so the backup service doesn't need special permissions on `/opt`). To
restore:

```bash
sudo systemctl stop resin
sudo -u resin cp /home/resin/backups/dev-<timestamp>.db /opt/resin/prisma/dev.db
sudo systemctl start resin
```
