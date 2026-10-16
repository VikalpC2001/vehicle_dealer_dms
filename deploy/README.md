# Production deployment — Docker on Oracle Cloud, behind Cloudflare, deployed by GitHub Actions

This folder runs the whole product on **one Oracle Cloud (OCI) Ubuntu VM** with Docker Compose:

- the **web app**, built from `RTO-Super-Admin/`
- the **API**, built from `EDEALER_RECORD/`
- **PostgreSQL**
- an **nginx** edge proxy

**Cloudflare** sits in front for DNS and TLS. **GitHub Actions** builds the images, pushes them to the **OCI Container Registry (OCIR)** and deploys them over SSH. Nothing (Node.js, PostgreSQL, PM2) is installed on the VM except Docker.

Every command below is labelled with **where it runs**:

| Label | Meaning |
|-------|---------|
| **[local]** | Your own computer, in a clone of this repository |
| **[OCI Console]** | cloud.oracle.com in a browser |
| **[Cloudflare]** / **[Hostinger]** / **[GitHub]** | Those websites, in a browser |
| **[VM · ubuntu]** | SSH session on the VM as the admin user `ubuntu` (has `sudo`) |
| **[VM · deploy]** | On the VM as the deploy user: from an `ubuntu` session run `sudo -iu deploy` |
| **[GitHub Actions]** | Runs automatically on GitHub's runners |

Domains used below: `dcarjt.com`, `www.dcarjt.com` (web app) and `api.dcarjt.com` (API). They are settings, not hard-coded: see [11. Production environment variables](#11-production-environment-variables).

## Contents

1. [Architecture overview](#1-architecture-overview)
2. [Repository structure](#2-repository-structure)
3. [Prerequisites](#3-prerequisites)
4. [OCI VM creation](#4-oci-vm-creation)
5. [OCI networking and firewall rules](#5-oci-networking-and-firewall-rules)
6. [OCIR setup](#6-ocir-setup)
7. [GitHub secrets and variables](#7-github-secrets-and-variables)
8. [Cloudflare DNS configuration](#8-cloudflare-dns-configuration)
9. [TLS certificate setup](#9-tls-certificate-setup)
10. [First-time server provisioning](#10-first-time-server-provisioning)
11. [Production environment variables](#11-production-environment-variables)
12. [First deployment](#12-first-deployment)
13. [Subsequent automatic deployments](#13-subsequent-automatic-deployments)
14. [Database migrations](#14-database-migrations)
15. [Database backup and restore](#15-database-backup-and-restore)
16. [Rollback procedures](#16-rollback-procedures)
17. [Monitoring and logs](#17-monitoring-and-logs)
18. [Troubleshooting](#18-troubleshooting)
19. [Security checklist](#19-security-checklist)
20. [Cost and resource considerations](#20-cost-and-resource-considerations)

---

## 1. Architecture overview

```text
 Browser ──HTTPS──► Cloudflare (DNS + proxy, SSL mode "Full (strict)")
                        │  HTTPS, Cloudflare Origin CA certificate
                        ▼
 ┌──────────────────── OCI Ubuntu VM (only 80/443 open to the web, 22 to you) ───────────────────┐
 │  nginx  (nginx-unprivileged, host ports 80/443 → container 8080/8443)                         │
 │    dcarjt.com, www.dcarjt.com ──► frontend :8080  (nginx serving the Vite build)               │
 │    api.dcarjt.com            ──► api      :4002  (Node.js 22, Express, Prisma)                 │
 │                                    │   uploads volume  dcarjt_uploads  → /app/uploads          │
 │                                    ▼                                                          │
 │                                 postgres :5432 (PostgreSQL 18, internal network only)         │
 │                                    data volume  dcarjt_postgres_data                          │
 │  systemd timers: daily backup (03:00 IST) · health check every 15 min                          │
 └───────────────────────────────────────────────────────────────────────────────────────────────┘

 git push main ─► GitHub Actions: CI ─► (production environment) build 3 images ─► push to OCIR
                                         (tag = commit SHA) ─► SSH as "deploy" ─► run-deploy.sh <sha>
                                         on the VM (deploy.sh runs detached from the SSH session)
```

How the parts fit together:

- **Networks.** `edge` joins nginx, the frontend and the API. `backend` joins only the API and PostgreSQL; it is `internal`, so it has no route to the internet. Only nginx publishes ports. PostgreSQL and the API are never reachable from outside.
- **Data.** Two Docker volumes, both declared `external`, so no `docker compose down` (even with `-v`) can delete them:
  - `dcarjt_postgres_data` holds the database.
  - `dcarjt_uploads` holds uploaded documents and photos.

  A volume is **not** a backup; see [section 15](#15-database-backup-and-restore).
- **Images.** The CI builds three images per commit and tags each with the full commit SHA:
  - `api` is the compiled backend, without dev dependencies.
  - `api-migrate` holds Prisma CLI and tsx. It is used only for migrations and the one-off bootstrap.
  - `frontend` is static files plus nginx.

  Third-party images (`postgres:18.6-alpine`, `nginx-unprivileged:1.30.5-alpine`, `node:22.23.3-bookworm-slim`) are pinned by digest.
- **Process supervision.** Docker restart policies (`unless-stopped`) and `init: true`. There is **no PM2**: one Node.js process per container. To scale, you would add containers, not workers.
- **Server layout** (`/opt/dcarjt`):

  ```text
  releases/<sha>/      copy of this deploy/ folder for each release (compose.yaml, nginx, scripts)
  current -> releases/<sha>
  bootstrap/           copy used once for the first configuration
  shared/              everything that outlives releases
    .env               stack settings (domains, registry, ports, limits)  — not secret
    api.env            API secrets (database URL, JWT secret, Gemini, SMTP)  — chmod 600
    postgres.env       database user/password                               — chmod 600
    certs/             origin certificate + private key                     — key chmod 640
    nginx/live|previous|staging   rendered edge configuration
    backups/postgres|uploads      database dumps and upload archives        — chmod 700
    restore/           put backup files here when restoring from elsewhere
    state/             current_release, previous_release, releases.log, last_backup.json,
                       deploys/*.log (each deploy's output), migrate-*.log, deploy-*-failure.log
  ```

- **One deploy** (`scripts/deploy.sh`; the workflow starts it through `run-deploy.sh`, so a dropped SSH connection or a cancelled run cannot stop it halfway):
  1. Check the configuration.
  2. Pull the images.
  3. Refuse a PostgreSQL major-version change (that needs a dump and restore).
  4. Back up the database (database only).
  5. Start PostgreSQL.
  6. Run `prisma migrate deploy`; the full output stays on the server.
  7. Render the nginx configuration and test it.
  8. Replace the API and frontend containers.
  9. Bring nginx up to date: recreate it when its image or settings changed, otherwise a tested graceful reload.
  10. Run the health checks.
  11. Record the release.

  If any step from 8 on fails, the **previous release is put back automatically**. The database is never rolled back automatically. Container logs of a failed deploy are written to `shared/state/deploy-<tag>-failure.log` (never into the public CI log).
- **Downtime.** This is a single-instance deployment. While the API container is replaced (a few seconds), nginx answers API calls with a JSON `503`; the web app keeps loading. Zero-downtime would need at least two API containers behind nginx with a rolling or blue-green switch. That means roughly double the API memory (about +1 GB) plus extra deploy logic, so it is not implemented.

## 2. Repository structure

```text
.
├── EDEALER_RECORD/                      backend (Express + TypeScript + Prisma)
│   ├── Dockerfile                       stages: deps → build → prod-deps → runtime (api) / migrate (api-migrate)
│   ├── .dockerignore                    keeps .env, uploads, logs, docs, node_modules out of the image
│   ├── prisma/migrations/               20261014000000_baseline (+ future migrations)
│   ├── prisma/migrations-legacy/        old history, kept for reference, never applied
│   └── prisma/bootstrap-production.ts   creates the first super-admin + default document categories
├── RTO-Super-Admin/                     frontend (React 19 + Vite)
│   ├── Dockerfile                       build on the native platform → nginx-unprivileged runtime
│   ├── .dockerignore
│   └── nginx.conf                       SPA fallback, immutable /assets, no-cache index.html, /healthz
├── deploy/                              ← this folder (copied to the VM as /opt/dcarjt/releases/<sha>)
│   ├── compose.yaml                     postgres, api, migrate (tools profile), frontend, nginx
│   ├── .env.example                     → shared/.env (stack settings)
│   ├── api.env.example                  → shared/api.env (API secrets)
│   ├── postgres.env.example             → shared/postgres.env
│   ├── nginx/nginx.conf                 edge main configuration
│   ├── nginx/templates/default.conf.template   server blocks (domains, TLS, proxying, limits)
│   ├── nginx/snippets/                  ssl.conf, proxy-common.conf, security-headers.conf, cors-error.conf,
│   │                                    cloudflare-realip.conf
│   ├── scripts/                         setup-ubuntu, configure-server, run-deploy (detached), deploy, rollback,
│   │                                    backup-postgres, restore-postgres, health-check, bootstrap, dc (compose
│   │                                    wrapper), update-cloudflare-ips, cloudflare-nsg-rules, lib (shared helpers)
│   └── systemd/                         dcarjt-backup.{service,timer}, dcarjt-health.{service,timer}
├── .github/workflows/ci.yml             lint, build, migration drift, linters, secret scan, image build + full-stack smoke test
├── .github/workflows/deploy-production.yml   CI → (production environment) build/push to OCIR → SSH deploy;
│                                             main only, gated by DEPLOY_ENABLED
├── .github/scripts/smoke-test.sh        runs the real deploy scripts on the CI runner
├── .gitleaks.toml  .hadolint.yaml  .shellcheckrc   linter configuration
```

There is no root `.dockerignore` because each image is built from its own app folder. There is no Terraform: the one-time OCI setup is a handful of Console steps (sections 4–6), and untested infrastructure code that can create or destroy resources would be riskier than useful here.

## 3. Prerequisites

- **Oracle Cloud** account (Always Free works for a start, see [section 20](#20-cost-and-resource-considerations)), with permission to create compute instances, networking and OCIR repositories.
- **Cloudflare** account (free plan is enough) and the domain `dcarjt.com` registered at **Hostinger**.
- **GitHub** repository admin rights (secrets, variables, environments).
- **[local]** `git`, `ssh`, `ssh-keygen`, `ssh-keyscan`, `scp`, `openssl`. Optional: the GitHub CLI `gh` and the OCI CLI `oci`.
- Accounts the app itself needs: a **Google Gemini API key** (document OCR) and an **SMTP** mailbox (OTP and notification e-mails).

## 4. OCI VM creation

**[OCI Console]** → ☰ → **Compute → Instances → Create instance**:

| Setting | Value |
|---------|-------|
| Name | `dcarjt-prod` |
| Image | **Canonical Ubuntu 24.04** (22.04 also works) — the platform image, not "Minimal" |
| Shape | **VM.Standard.A1.Flex** (Ampere, arm64): **2 OCPU / 12 GB** is comfortable (Always Free allows up to 4 OCPU / 24 GB in total). Or an AMD/Intel shape such as **VM.Standard.E5.Flex** with 1–2 OCPU / 8 GB. **Minimum 4 GB RAM**: the containers' memory limits add up to about 2.4 GB. |
| Networking | A VCN with a **public subnet**; *Assign a public IPv4 address*: yes |
| SSH keys | **Your own** admin public key (`~/.ssh/id_ed25519.pub`). This logs in as `ubuntu`. Not the CI key. |
| Boot volume | 50–100 GB (database, uploads, local backups and images live here) |

After it starts:

1. **[OCI Console]** Instance → *Attached VNICs* → VNIC → *IPv4 addresses* → change the public IP to a **reserved public IP**, so it survives instance re-creation. The DNS records point at it.
2. **[local]** `ssh ubuntu@<VM_IP>` works.

An A1 shape in a busy region can report "Out of capacity"; try another availability domain or retry later. The images are built for both `linux/amd64` and `linux/arm64` by default, so either CPU type works (see `IMAGE_PLATFORMS` in [section 7](#7-github-secrets-and-variables)).

## 5. OCI networking and firewall rules

There are two layers: the **OCI security list / network security group (NSG)** in front of the VM, and **iptables on the VM** itself (Oracle's Ubuntu images block everything except SSH).

**[OCI Console]** → Networking → Virtual Cloud Networks → your VCN → *Security Lists* (or an NSG attached to the instance's VNIC). Ingress rules:

| Source | Protocol / port | Why |
|--------|-----------------|-----|
| `<your public IP>/32` | TCP 22 | Your admin SSH. |
| `0.0.0.0/0` | TCP 22 | The deploy workflow's SSH connection. GitHub-hosted runners have no fixed IP addresses, so SSH must accept any source. It stays key-only: password logins are off on OCI images, and `deploy` has only the CI key. To keep 22 closed to the internet instead, run the deploy job on a self-hosted runner or through OCI Bastion. |
| `0.0.0.0/0` | TCP 80, TCP 443 | Web traffic. Restrict to Cloudflare once everything works (below). |

Remove other ingress rules you do not need (for example the default ICMP rules are harmless; never add 4002, 5432, 8080 or 8443). Egress: keep "all destinations". The VM must reach OCIR, Docker Hub (pinned base images), Google's Gemini API and your SMTP server.

**VM firewall**: `scripts/setup-ubuntu.sh` opens TCP 80/443 in iptables, now and after reboots, by editing `/etc/iptables/rules.v4`. It does not use `ufw`: Docker-published ports bypass ufw rules, so ufw would only give false confidence.

### Restricting the origin to Cloudflare

Once the site works through Cloudflare, allow 80/443 **only from Cloudflare's ranges**, so nobody can reach the origin directly.

1. **[local]** Generate the NSG rules from the same list nginx trusts:

   ```bash
   bash deploy/scripts/update-cloudflare-ips.sh      # optional: refresh the list first (then commit + deploy)
   bash deploy/scripts/cloudflare-nsg-rules.sh 443 >cf-443.json
   bash deploy/scripts/cloudflare-nsg-rules.sh 80  >cf-80.json
   ```

2. **[OCI Console]** Networking → your VCN → *Network Security Groups* → create `dcarjt-web`, then attach it to the instance's VNIC (Instance → Attached VNICs → Edit → NSGs).

3. **[local]** Add the rules with the OCI CLI. Or add them by hand in the Console from the JSON files: one rule per Cloudflare range and port.

   ```bash
   oci network nsg rules add --nsg-id <nsg-ocid> --security-rules file://cf-443.json
   oci network nsg rules add --nsg-id <nsg-ocid> --security-rules file://cf-80.json
   ```

4. **[OCI Console]** Check the site still works, then delete the `0.0.0.0/0` rules for 80/443 from the security list.
5. **Recovery path:** Console access never depends on these rules. If you lock yourself out, edit the security list or NSG in the Console to re-add your current IP for port 22. If SSH itself is broken, use Instance → *Console connection*.

Further hardening (optional): Cloudflare **Authenticated Origin Pulls** (mutual TLS: nginx accepts only Cloudflare's client certificate) would need `ssl_client_certificate` + `ssl_verify_client on` in the nginx template; not enabled by default.

## 6. OCIR setup

1. **[OCI Console]** ☰ → *Governance & Administration → Tenancy details*: note the **Object Storage namespace** (for example `axabcdefghij`). This is the *tenancy namespace* used by OCIR.
2. Note your **region key**: Mumbai `bom`, Hyderabad `hyd`, Frankfurt `fra`, Ashburn `iad`, … The registry host is `<region-key>.ocir.io` (for example `bom.ocir.io`). Use the region where the VM runs.
3. **[OCI Console]** ☰ → *Developer Services → Containers & Artifacts → Container Registry* → *Create repository* three times, **Private**, in your compartment:
   - `dcarjt/api`
   - `dcarjt/api-migrate`
   - `dcarjt/frontend`
4. **Credentials for CI.** Recommended: a dedicated user `dcarjt-ci` in a group `dcarjt-ci` with a policy like the following (use `in tenancy` if the repositories are in the root compartment):

   ```text
   Allow group dcarjt-ci to manage repos in compartment <your-compartment>
   ```

   *Identity → Users → dcarjt-ci → Auth tokens → Generate token.* Copy it **now**; it is shown once. This is the `OCIR_AUTH_TOKEN`.
5. The OCIR **username** is `<tenancy-namespace>/<username>`. For users in an identity domain other than Default it is `<tenancy-namespace>/<domain-name>/<username>`; for older federated users it is `<tenancy-namespace>/oracleidentitycloudservice/<email>`. This is the `OCIR_USERNAME`.
6. **[local]** Optional check with Docker installed:

   ```bash
   docker login bom.ocir.io -u '<tenancy-namespace>/<username>'
   ```

   Paste the token as the password.

Old images: every deploy pushes three new tags. Add a retention policy in OCIR (repository → *Edit* → image retention), or delete old tags now and then. OCIR storage counts as Object Storage.

## 7. GitHub secrets and variables

### Create the deploy SSH key (CI → VM)

**[local]** Create a key used **only** by GitHub Actions:

```bash
ssh-keygen -t ed25519 -N '' -C 'github-actions-deploy@dcarjt' -f ~/.ssh/dcarjt_deploy
# ~/.ssh/dcarjt_deploy      → GitHub secret DEPLOY_SSH_KEY
# ~/.ssh/dcarjt_deploy.pub  → copied to the VM in section 10
```

### Pin the VM's SSH host key

**[local]** Read the host key, then compare its fingerprint with the VM's own:

```bash
ssh-keyscan -t ed25519 <VM_IP> 2>/dev/null | tee dcarjt_known_hosts
ssh-keygen -lf dcarjt_known_hosts
```

**[VM · ubuntu]** Show the VM's fingerprint. It must be identical to the one above:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

The content of `dcarjt_known_hosts` (one line, `<VM_IP> ssh-ed25519 AAAA…`) becomes `DEPLOY_KNOWN_HOSTS`. For a non-standard SSH port the line must start with `[<VM_IP>]:<port>`.

### The `production` environment and its secrets

Every workflow in the repository can read **repository** secrets, including a workflow someone adds on a branch. Secrets of an **environment** whose deployments are limited to `main` can be read only by a `main` job that uses that environment, and the deploy job is the only such job. So keep all five secrets there.

1. **[GitHub]** *Settings → Environments → New environment* → `production`.
2. *Deployment branches and tags* → **Selected branches and tags** → add `main`. This is required.
3. Optional: **Required reviewers**, so every deploy waits for a click.
4. *Environment secrets* → add:

| Secret | Value |
|--------|-------|
| `OCIR_USERNAME` | `<tenancy-namespace>/<username>` (section 6) |
| `OCIR_AUTH_TOKEN` | the OCIR auth token |
| `DEPLOY_SSH_KEY` | the whole private key file `~/.ssh/dcarjt_deploy` |
| `DEPLOY_KNOWN_HOSTS` | the line from `dcarjt_known_hosts` |
| `DEPLOY_HOST` | the VM's reserved public IP (SSH does not go through Cloudflare) |

Environments with these protections are free for public repositories, such as this one. A *private* repository needs GitHub Pro, Team or Enterprise for them. On a free private repository, store the secrets as repository secrets instead; the workflow still deploys only from `main`.

Because the repository is public, its Actions logs are public too. The deploy never prints secrets or container logs there.

### Repository variables

**[GitHub]** → *Settings → Secrets and variables → Actions → Variables*:

| Variable | Example | Required |
|----------|---------|----------|
| `DEPLOY_ENABLED` | `true` | yes. Until it is `true`, pushes to `main` only run CI. Set it to `false` to pause deploys. |
| `OCIR_REGISTRY` | `bom.ocir.io` | yes. Must equal `REGISTRY` in the server's `.env`. |
| `OCIR_IMAGE_NAMESPACE` | `axabcdefghij/dcarjt` | yes. Must equal `IMAGE_NAMESPACE` in the server's `.env`. |
| `DOMAIN` | `dcarjt.com` | no (default `dcarjt.com`) |
| `API_DOMAIN` | `api.dcarjt.com` | no (default). Baked into the web app at build time. |
| `IMAGE_PLATFORMS` | `linux/arm64` | no (default `linux/amd64,linux/arm64`). Set it to just your VM's platform to halve build time. |
| `DEPLOY_USER` / `DEPLOY_PORT` / `DEPLOY_ROOT` | `deploy` / `22` / `/opt/dcarjt` | no (these defaults) |

Or with the GitHub CLI, **[local]** in the repository:

```bash
# after creating the environment and its main-only branch rule in the web UI (steps 1–3 above):
gh secret set OCIR_USERNAME --env production --body '<tenancy-namespace>/<username>'
gh secret set OCIR_AUTH_TOKEN --env production          # paste the token when asked
gh secret set DEPLOY_SSH_KEY --env production < ~/.ssh/dcarjt_deploy
gh secret set DEPLOY_KNOWN_HOSTS --env production < dcarjt_known_hosts
gh secret set DEPLOY_HOST --env production --body '<VM_IP>'
gh variable set OCIR_REGISTRY --body 'bom.ocir.io'
gh variable set OCIR_IMAGE_NAMESPACE --body '<tenancy-namespace>/dcarjt'
gh variable set DEPLOY_ENABLED --body 'true'            # only once sections 8–10 are done
```

The workflow deploys only from `main`, in any case. A run started on another branch skips the release job.

## 8. Cloudflare DNS configuration

1. **[Cloudflare]** *Add a site* → `dcarjt.com` → Free plan. Cloudflare shows two nameservers.
2. **[Hostinger]** *Domains → dcarjt.com → DNS / Nameservers → Change nameservers* → enter Cloudflare's two nameservers. Propagation can take up to 24 h; Cloudflare e-mails when the site is active.
3. **[Cloudflare]** *DNS → Records*. All three are **Proxied** (orange cloud):

   | Type | Name | Content | Proxy |
   |------|------|---------|-------|
   | A | `dcarjt.com` (`@`) | `<VM reserved public IP>` | Proxied |
   | A | `www` | `<VM reserved public IP>` | Proxied |
   | A | `api` | `<VM reserved public IP>` | Proxied |

   Keep any existing MX/TXT records for e-mail.
4. **[Cloudflare]** *SSL/TLS*:
   - Encryption mode **Full (strict)**: Cloudflare connects to the origin over HTTPS and checks its certificate.
   - *Edge Certificates*:
     - **Always Use HTTPS: On**.
     - **Minimum TLS Version: 1.2**.
     - Leave HSTS off here: nginx already sends `Strict-Transport-Security`. Do not enable HSTS *preload* unless you are sure every subdomain will always be HTTPS.
5. Good to know:
   - Cloudflare gives up on a proxied request after **100 seconds** (error 524). OCR and Excel/PDF exports must finish within that.
   - Uploads are limited to 100 MB on the Free plan (the app's own limit is 10 MB).
   - `index.html` is sent with `no-cache` and the hashed `/assets/*` files as `immutable`, so nothing needs purging after a deploy.
   - API responses are JSON, which Cloudflare does not cache by default.
   - The deploy workflow's final "public check" may be blocked by Bot Fight Mode. That step is informational and never fails a deploy.

## 9. TLS certificate setup

### Option A (primary): Cloudflare Origin CA certificate

Cloudflare (in Full (strict) mode) trusts this certificate; **browsers do not**. Anyone who bypasses Cloudflare and opens the VM's IP directly gets a certificate warning. That is intended, and the origin can be closed to everything but Cloudflare (section 5).

1. **[Cloudflare]** *SSL/TLS → Origin Server → Create Certificate*:
   - **Generate private key and CSR with Cloudflare**, key type RSA (2048);
   - hostnames `dcarjt.com, *.dcarjt.com`;
   - validity 15 years.

   Keep the page open: the private key is shown **only once**.
2. **[VM · deploy]** after [section 10](#10-first-time-server-provisioning) step 3, paste both into the server. They never go into Git, an image or a CI log.

   ```bash
   cat > /opt/dcarjt/shared/certs/origin.crt                # paste "Origin Certificate", then Enter and Ctrl-D
   (umask 077; cat > /opt/dcarjt/shared/certs/origin.key)   # paste "Private Key", then Enter and Ctrl-D
   bash /opt/dcarjt/bootstrap/scripts/configure-server.sh   # sets the permissions and checks the pair
   ```

   `configure-server.sh` makes the key `chmod 640` with the deploy user's group, which nginx joins (`DEPLOY_GID`). It also checks that the key matches the certificate and that the certificate covers all three names.

**Replacing it** (before it expires, or when the key may have leaked): create a new certificate in Cloudflare, then **[VM · deploy]** overwrite the two files as above, re-run `configure-server.sh`, and reload nginx:

```bash
/opt/dcarjt/current/scripts/dc.sh exec nginx nginx -t -c /etc/nginx/live/nginx.conf
/opt/dcarjt/current/scripts/dc.sh exec nginx nginx -c /etc/nginx/live/nginx.conf -s reload
```

Then **[Cloudflare]** revoke the old certificate.

### Option B (alternative): Let's Encrypt

Use this when the origin must also be trusted by browsers directly, or when not using the Cloudflare proxy. A DNS-01 challenge through Cloudflare's API works behind the proxy and needs no open port 80.

1. **[Cloudflare]** *My Profile → API Tokens → Create Token* → template "Edit zone DNS", zone `dcarjt.com`.
2. **[VM · deploy]**, choosing a current `certbot/dns-cloudflare` version tag:

   ```bash
   install -d -m 700 /opt/dcarjt/shared/letsencrypt
   (umask 077; printf 'dns_cloudflare_api_token = %s\n' '<token>' > /opt/dcarjt/shared/cloudflare.ini)
   certbot() {
     docker run --rm --user "$(id -u):$(id -g)" \
       -v /opt/dcarjt/shared/letsencrypt:/le \
       -v /opt/dcarjt/shared/cloudflare.ini:/cloudflare.ini:ro \
       certbot/dns-cloudflare:<version> "$@" \
       --config-dir /le/config --work-dir /le/work --logs-dir /le/logs
   }
   certbot certonly --non-interactive --agree-tos -m <you@example.com> \
     --dns-cloudflare --dns-cloudflare-credentials /cloudflare.ini -d dcarjt.com -d '*.dcarjt.com'
   cp -L /opt/dcarjt/shared/letsencrypt/config/live/dcarjt.com/fullchain.pem /opt/dcarjt/shared/certs/origin.crt
   (umask 077; cp -L /opt/dcarjt/shared/letsencrypt/config/live/dcarjt.com/privkey.pem /opt/dcarjt/shared/certs/origin.key)
   bash /opt/dcarjt/bootstrap/scripts/configure-server.sh      # permissions + certificate checks
   ```

3. **Renewal.** Let's Encrypt certificates last 90 days or less. Run `certbot renew` (same wrapper) daily from a timer or cron job as `deploy`, copy the two files again, and reload nginx with the two commands above.

## 10. First-time server provisioning

1. **[local]** Copy this folder and the CI public key to the VM:

   ```bash
   scp -r deploy ubuntu@<VM_IP>:/tmp/dcarjt-deploy
   scp ~/.ssh/dcarjt_deploy.pub ubuntu@<VM_IP>:/tmp/dcarjt_deploy.pub
   ```

2. **[VM · ubuntu]** Install and prepare everything. This is safe to run again.

   ```bash
   sudo bash /tmp/dcarjt-deploy/scripts/setup-ubuntu.sh --ci-public-key /tmp/dcarjt_deploy.pub --swap 2G
   ```

   It does the following:
   - updates Ubuntu;
   - installs **Docker Engine + Compose plugin from Docker's official apt repository**;
   - configures container log rotation and `live-restore`;
   - creates the `deploy` user (docker group, SSH key login only, the CI key in `authorized_keys`);
   - creates `/opt/dcarjt/…` with tight permissions;
   - opens 80/443 in iptables;
   - creates optional swap;
   - enables unattended security updates;
   - installs the backup and health timers, which stay idle until the first deploy.

   It does not touch SSH settings.

3. **[VM · ubuntu]** Generate the production configuration as the deploy user:

   ```bash
   sudo -iu deploy
   bash /opt/dcarjt/bootstrap/scripts/configure-server.sh \
     --registry bom.ocir.io --image-namespace '<tenancy-namespace>/dcarjt' \
     --domain dcarjt.com            # optional: --www-domain …, --api-domain …
   ```

   This writes:
   - `shared/.env`;
   - `shared/postgres.env`, with a **generated** 48-hex-character database password;
   - `shared/api.env`, with a **generated** JWT secret, the matching `DATABASE_URL` and the domain-based URLs.

   It never overwrites an existing file. The first run ends with a list of what is still missing; that is expected.
4. **[VM · deploy]** Fill in the remaining values:

   ```bash
   nano /opt/dcarjt/shared/api.env
   ```

   Set `GEMINI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `EMAIL_FROM`. Write values without quotes, except a value containing `$`, which needs single quotes: `SMTP_PASS='a$b'`.
5. **[VM · deploy]** Install the certificate ([section 9](#9-tls-certificate-setup)), then check everything:

   ```bash
   bash /opt/dcarjt/bootstrap/scripts/configure-server.sh
   # … "configuration complete; the server is ready for the first deploy"
   ```

Registry login on the server is handled by the deploy workflow: it logs in with the token over SSH stdin, deploys, and logs out again. For a deploy by hand, see [section 13](#13-subsequent-automatic-deployments).

## 11. Production environment variables

All production configuration lives in `/opt/dcarjt/shared/` on the VM, never in Git.

| File | Read by | Contents |
|------|---------|----------|
| `.env` | Docker Compose (variable substitution) and the scripts | Not secret: project name, volume names, **domains**, business time zone (`APP_TIMEZONE`), registry, TLS file paths, ports, upload size limit, proxy timeout, rate limits (`AUTH_RATE_*`, `PUBLIC_WRITE_RATE_*`), HSTS, PostgreSQL tuning, memory limits, log rotation, rollback/backup settings (`UPLOADS_BACKUPS_TO_KEEP` …), alert webhook. Template: [`.env.example`](.env.example). |
| `api.env` | The `api` and `migrate` containers | **Secret**: `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, SMTP credentials, plus CORS/passkey/upload-URL settings derived from the domains, `TRUST_PROXY=1`, log level. Template: [`api.env.example`](api.env.example). |
| `postgres.env` | The `postgres` container (only when the database is first created) | **Secret**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`. Template: [`postgres.env.example`](postgres.env.example). |

Rules: `KEY=value`, one per line, no spaces around `=`. In `.env` and `postgres.env`, no quotes at all. `CHANGE_ME` left anywhere stops every deploy (`validate_config`).

**Using other domains:**
1. Set `DOMAIN`/`WWW_DOMAIN`/`API_DOMAIN` in `.env` (or pass `--domain` on the first `configure-server.sh` run).
2. Set `ALLOWED_ORIGINS`, `FRONTEND_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_ORIGIN` and `BASE_URL` in `api.env`.
3. Set the GitHub variables `DOMAIN`/`API_DOMAIN` (the web app is built with `https://$API_DOMAIN/api/v1`).
4. Use a certificate that covers the names.

**Frontend build-time variables (public).** `VITE_*` values are compiled into the JavaScript that every visitor downloads, so they must never contain a secret:

| Variable | Set by | Value |
|----------|--------|-------|
| `VITE_API_BASE_URL` | deploy workflow, from `vars.API_DOMAIN` | `https://api.dcarjt.com/api/v1` |
| `VITE_APP_NAME` | Dockerfile default | `RTO Super Admin` |
| `VITE_TOKEN_KEY`, `VITE_REFRESH_TOKEN_KEY` | defaults in `src/lib/constants.js` | browser storage key names |

**Applying a change on the server.** **[VM · deploy]**, with `S=/opt/dcarjt/current/scripts`:

- **`api.env`** — recreate the API container: `$S/dc.sh up -d --wait api`.
- **`.env`** (domains, limits, ports, time zone) — re-deploy the live release with the images already on the server. nginx is recreated when its own settings changed:

  ```bash
  $S/run-deploy.sh "$(cat /opt/dcarjt/shared/state/current_release)" --no-pull --skip-migrations --no-backup
  ```

- **`postgres.env`** — has **no effect** on an existing database. To change the password:

  ```bash
  $S/dc.sh exec postgres psql -U dcarjt -d dcarjt -c "ALTER USER dcarjt PASSWORD '<new hex password>'"
  ```

  Then update both `postgres.env` and the password inside `DATABASE_URL` in `api.env`, and recreate the API.

## 12. First deployment

1. **[GitHub]** Sections 6–7 done, and the variable `DEPLOY_ENABLED=true`.
2. **[local]** Push to `main` (or **[GitHub]** *Actions → Deploy production → Run workflow* with an empty tag):

   ```bash
   git push origin main
   ```

3. **[GitHub Actions]** The workflow runs:
   - **CI**;
   - **Build, push and deploy** (in the `production` environment, after any required approval): three images to OCIR (tag = commit SHA), then uploads `deploy/` to `/opt/dcarjt/releases/<sha>/`, logs the VM in to OCIR, runs `run-deploy.sh <sha>` and logs out.

   The first deploy creates the data volumes, starts PostgreSQL, applies the baseline migration, starts everything, passes the health checks and takes a baseline backup.
4. **[VM · ubuntu]** Create the super-admin and the reference data (states/cities, default document categories). You are asked for e-mail, name, mobile and a 12+ character password. Do this right after the first deploy: the site is public from then on.

   ```bash
   sudo -iu deploy /opt/dcarjt/current/scripts/bootstrap.sh
   ```

   This is safe to run again; it never changes an existing admin's password.
   - Replace a forgotten admin password: `sudo -iu deploy env BOOTSTRAP_ADMIN_RESET_PASSWORD=true /opt/dcarjt/current/scripts/bootstrap.sh`.
   - If the e-mail already belongs to an ordinary account, the script stops: anyone can register an account on the public site. Use another e-mail. If that account is really yours, run it again with `BOOTSTRAP_ADMIN_PROMOTE_EXISTING=true`; its password is then replaced.
5. **Verify:**
   - **[browser]** `https://dcarjt.com` loads, and you can sign in as the super-admin.
   - **[VM · deploy]**

     ```bash
     /opt/dcarjt/current/scripts/health-check.sh       # all checks should print "ok"
     systemctl list-timers 'dcarjt-*'                  # backup + health timers scheduled
     ```

   - **[local]**

     ```bash
     curl -sS https://api.dcarjt.com/api/v1/health/ready
     ```

## 13. Subsequent automatic deployments

Every push or merge to `main`:

1. **CI** (`ci.yml`):
   - backend: `npm ci`, `prisma validate`, lint, build;
   - all migrations applied to an empty PostgreSQL 18, then a schema-drift check;
   - frontend: lint (advisory until its existing errors are fixed), build;
   - shellcheck, hadolint, actionlint;
   - gitleaks over the full history;
   - the three images built, plus a **full-stack smoke test** that runs the real deploy scripts on the runner (deploy → bootstrap → upgrade → settings re-deploy → PostgreSQL-version guard → rollback → broken deploy with automatic rollback → backup → restore check → live restores → API/nginx failures → release pruning → rate limits).
2. **Build and push**: images tagged with the full commit SHA (immutable; nothing uses `latest`).
3. **Deploy**: `run-deploy.sh <sha>` on the VM. It starts `deploy.sh` detached and streams its log, so a cancelled workflow or a dropped connection only stops the streaming; the deploy finishes (or rolls itself back) on the server. Each deploy's output stays in `shared/state/deploys/`.

Only one production deploy runs at a time; a newer push waits. A run never puts back an *older* commit than the live one: re-running an old workflow run is refused. Pull requests and other branches run CI only.

**Redeploy a specific commit** (also the way to go back on purpose): **[GitHub]** *Actions → Deploy production → Run workflow* on `main` → `image_tag` = full 40-character SHA of a commit whose images were built before. Its own `deploy/` files are used.

**Deploy by hand** (registry login needed):

1. **[local]** Copy the release's `deploy/` folder. Only the CI key can log in as `deploy`, so go through `ubuntu`:

   ```bash
   rsync -az --rsync-path='sudo -u deploy rsync' deploy/ ubuntu@<VM_IP>:/opt/dcarjt/releases/<sha>/
   ```

2. **[VM · deploy]** Log in, deploy, log out:

   ```bash
   docker login bom.ocir.io -u '<tenancy-namespace>/<username>'
   /opt/dcarjt/releases/<sha>/scripts/run-deploy.sh <sha>
   docker logout bom.ocir.io
   ```

`run-deploy.sh` / `deploy.sh` options:

- `--skip-migrations`;
- `--no-backup` (skips the pre-deploy backup);
- `--no-pull` (uses images already on the server).

## 14. Database migrations

The backend uses **Prisma migrations**. Production applies them with `prisma migrate deploy`, as a separate, controlled step of each deploy. It runs in the one-off `migrate` container, after a backup and **before** the new API starts. It is never part of the API's start command.

- **[local]** Making a schema change:

  ```bash
  cd EDEALER_RECORD
  # edit prisma/schema.prisma, then:
  npx prisma migrate dev --name add_widget_table     # creates prisma/migrations/<timestamp>_add_widget_table
  git add prisma && git commit
  ```

  CI fails if `schema.prisma` and the migrations disagree. Never use `prisma db push` for a real change: it creates no migration, so production would never get it.
- **Baseline.** `prisma/migrations/20261014000000_baseline` is the complete schema when this deployment was introduced. **[local]** An existing development database that was built with `db push` must be marked once:

  ```bash
  npx prisma migrate resolve --applied 20261014000000_baseline
  ```

- **Backward compatible.** A rollback runs the older code on the newer schema. Add first; backfill; remove old columns in a later release.
- **Status in production**, **[VM · deploy]**:

  ```bash
  /opt/dcarjt/current/scripts/dc.sh --profile tools run --rm migrate node_modules/.bin/prisma migrate status
  ```

- **When a migration fails**, the deploy stops **before** touching the running containers. The CI log shows only the Prisma error code and the migration name; the full output (which can quote data) is in `/opt/dcarjt/shared/state/migrate-<sha>.log`. Prisma records the failed migration and **refuses every later migration** until it is resolved (error P3009). So, **[VM · deploy]** with `S=/opt/dcarjt/current/scripts`:
  1. See what happened: `$S/dc.sh --profile tools run --rm migrate node_modules/.bin/prisma migrate status`. PostgreSQL normally rolled the failed migration back completely.
  2. Mark it rolled back: `$S/dc.sh --profile tools run --rm migrate node_modules/.bin/prisma migrate resolve --rolled-back <failed_migration_folder_name>`. Use `--applied` instead if you completed it by hand.
  3. **[local]** Fix the migration (or replace it with a new one), push, and let it deploy.

  If the migration left partial changes that cannot be rolled back cleanly, restore the automatic `pre-deploy-…` backup instead (section 15). Data written since that backup is lost.
- **PostgreSQL major versions** (18 → 19) are never switched in place. A deploy that changes the major version in `compose.yaml` is refused before anything changes, because the new version would start an empty cluster next to the data. To upgrade:
  1. Take a backup.
  2. Deploy the new image with an empty new data volume (`POSTGRES_VOLUME`).
  3. Restore the backup with `restore-postgres.sh --live`.
  4. Keep the old volume until you are sure.

## 15. Database backup and restore

**What is backed up:**
- the database (`pg_dump` custom format, checked with `pg_restore --list`);
- the uploaded files (tar.gz of the uploads volume).

Each file has a `.sha256`. Backups go to `/opt/dcarjt/shared/backups/{postgres,uploads}`, outside every container, with `chmod 700`.

**When:**
- daily at **03:00 India time** (`dcarjt-backup.timer`; missed runs happen at the next boot);
- before every deploy (`…-pre-deploy-<sha>`; **database only**, since migrations never touch the files);
- after the first deploy (`…-first-deploy`);
- before a live restore (`…-pre-restore`).

**Retention:**
- Database dumps are kept for `BACKUP_RETENTION_DAYS` (default 14).
- Upload archives are full copies of every file, so only the newest `UPLOADS_BACKUPS_TO_KEEP` (default 3) stay on the server; the off-site copy keeps the history.
- A failed run never leaves half-written files behind.
- A file the app moves or deletes while it is being archived is a warning, not a failure.

Size the disk for: 14 days of database dumps, 3 copies of the uploaded files, Docker images and the uploads volume itself.

**Encryption** (recommended once backups leave the server), **[VM · deploy]**:

```bash
(umask 077; openssl rand -base64 48 > /opt/dcarjt/shared/backup.pass)
nano /opt/dcarjt/shared/.env        # BACKUP_PASSPHRASE_FILE=/opt/dcarjt/shared/backup.pass
```

New backups are then encrypted with gpg AES-256 (`.gpg`). **Store a copy of the passphrase outside the server** (password manager): without it the backups cannot be restored.

**Off-site copy** (strongly recommended: local backups die with the VM). Example with OCI Object Storage through its S3-compatible API:

1. **[OCI Console]** create a private bucket `dcarjt-backups`.
2. **[OCI Console]** *User settings → Customer secret keys → Generate*.
3. **[VM · ubuntu]** `sudo apt-get install -y rclone`
4. **[VM · deploy]** write the rclone config:

   ```bash
   mkdir -p ~/.config/rclone && (umask 077; cat > ~/.config/rclone/rclone.conf <<'EOF'
   [oci]
   type = s3
   provider = Other
   access_key_id = <customer secret key: access key>
   secret_access_key = <customer secret key: secret>
   endpoint = https://<tenancy-namespace>.compat.objectstorage.<region-identifier>.oraclecloud.com
   region = <region-identifier>
   EOF
   )
   rclone lsd oci:                     # must list the bucket
   nano /opt/dcarjt/shared/.env        # BACKUP_OFFSITE_COMMAND=rclone copy {dir} oci:dcarjt-backups --max-age 25h
   ```

   `<region-identifier>` is, for example, `ap-mumbai-1`. A failed off-site copy is reported to `ALERT_WEBHOOK_URL`.

Commands, all **[VM · deploy]** with `S=/opt/dcarjt/current/scripts`:

| Task | Command |
|------|---------|
| Back up now | `$S/backup-postgres.sh --label manual` |
| List backups | `ls -lh /opt/dcarjt/shared/backups/postgres /opt/dcarjt/shared/backups/uploads` |
| **Prove a backup restores** (temporary database, nothing else touched; do this monthly) | `$S/restore-postgres.sh /opt/dcarjt/shared/backups/postgres/<file>.dump --check` |
| **Restore the live database** | `$S/restore-postgres.sh /opt/dcarjt/shared/backups/postgres/<file>.dump --live` |
| …and the uploaded files too | add `--uploads /opt/dcarjt/shared/backups/uploads/<file>.tar.gz` |
| …exactly as in the backup (no migrations; see section 16) | add `--skip-migrations` |

A live restore:
1. checks every input first: the `.sha256` is required, encrypted files are decrypted, and the uploads archive must be complete;
2. asks you to type the database name;
3. takes a safety backup;
4. restores into a **new** database (a failure here changes nothing);
5. stops the API;
6. swaps the database names in one transaction (the old data is **kept** as `<db>_before_restore_<time>`);
7. applies the live release's migrations, unless `--skip-migrations`;
8. restores uploads if requested: unpacks beside the current files, and replaces them only once that worked;
9. starts the API.

Drop the kept database once you are satisfied (the script prints the command).

**Restore on a new server** (or from off-site copies):
1. Provision it (section 10) and deploy once.
2. **[local]** Copy the backup files **and their `.sha256` files** into `/opt/dcarjt/shared/restore/`. Use this folder, not `shared/backups`, whose retention could delete old files during the restore.

   ```bash
   rsync -a --rsync-path='sudo -u deploy rsync' ./restore/ ubuntu@<VM_IP>:/opt/dcarjt/shared/restore/
   ```

3. **[VM · deploy]** Run the live restore with the copied files:

   ```bash
   $S/restore-postgres.sh /opt/dcarjt/shared/restore/<db>-<time>.dump --live --uploads /opt/dcarjt/shared/restore/uploads-<time>.tar.gz
   ```

## 16. Rollback procedures

**Automatic.** When a deploy fails after the containers were replaced (unhealthy container, nginx rejects the configuration, failed health check), `deploy.sh` puts the previous release's containers and nginx configuration back by itself (`AUTO_ROLLBACK=true` in `.env`). The workflow run is marked failed, and `ALERT_WEBHOOK_URL` gets a message.

**Manual**, **[VM · deploy]**, without touching the database:

```bash
/opt/dcarjt/current/scripts/rollback.sh                 # back to the previous release
/opt/dcarjt/current/scripts/rollback.sh <sha>           # back to a specific kept release
cat /opt/dcarjt/shared/state/releases.log               # what was deployed when
```

You confirm by typing the tag. The last `RELEASES_TO_KEEP` (default 5) release folders and their images stay on the server; the live and the previous release are always kept. Alternatively, **[GitHub]** run *Deploy production* with that commit's SHA: its `prisma migrate deploy` finds nothing to apply and leaves the newer schema in place.

**The database schema is never downgraded automatically.** A code rollback is safe when the newer migrations were additive (the older code ignores new columns and tables). If a migration was destructive or the old code cannot work with the new schema, you need manual intervention:

- **fix forward** with a new migration and deploy (preferred); or
- go back to the release before the bad one (call it `<old>`, and the bad one `<bad>`) **and** to the backup taken just before `<bad>` was deployed. Data written since is lost. **[VM · deploy]**, in this order:

  ```bash
  # 1. Restore the database exactly as it was, and start <old>'s API on it (no migrations run):
  IMAGE_TAG=<old> /opt/dcarjt/releases/<old>/scripts/restore-postgres.sh \
    /opt/dcarjt/shared/backups/postgres/<db>-<time>-pre-deploy-<first 12 characters of bad>.dump --live --skip-migrations
  # 2. Switch the frontend, nginx and the release records to <old>:
  /opt/dcarjt/current/scripts/rollback.sh <old>
  ```

  The reverse order would fail. Restoring under `<bad>` would re-apply its destructive migration, and rolling back first would run `<old>` on `<bad>`'s schema. Then fix the migration before deploying again.

## 17. Monitoring and logs

All **[VM · deploy]** with `S=/opt/dcarjt/current/scripts` (`dc.sh` is `docker compose` with the production settings):

```bash
$S/dc.sh ps                                  # status and health of every container
$S/dc.sh logs --tail=100 api                 # also: nginx, frontend, postgres; add -f to follow
$S/dc.sh logs --since=1h nginx | grep ' 5[0-9][0-9] '   # recent server errors at the edge
$S/dc.sh config --quiet && echo valid        # validate (plain `config` PRINTS SECRETS from api.env)
$S/health-check.sh                           # the full check the timer runs
docker stats --no-stream                     # CPU / memory per container
docker system df                             # disk used by images, volumes, build cache
df -h / /var/lib/docker; free -m; uptime     # host disk, memory, load
systemctl list-timers 'dcarjt-*'
journalctl -u dcarjt-health -n 50 --no-pager # health check history (failures are also alerted)
journalctl -u dcarjt-backup -n 50 --no-pager
cat /opt/dcarjt/shared/state/last_backup.json
ls -t /opt/dcarjt/shared/state/deploys/ | head  # each deploy's full output (+ .status exit code)
$S/dc.sh exec postgres psql -U dcarjt -d dcarjt -c 'SELECT now(), pg_size_pretty(pg_database_size(current_database()))'
```

- **Logs.** Containers log to stdout. Docker's json-file driver rotates them (10 MB × 5 per container).
  - The API logs JSON lines; its own per-request log is at the `http` level, which `LOG_LEVEL=info` hides.
  - The edge nginx access log is the single request log. It includes `cf_ray` to match Cloudflare's request IDs and replaces agent-invitation tokens in URLs with `[redacted]`. nginx never logs request bodies or headers such as `Authorization`.
  - nginx's *error* log (format not configurable) still prints the full URL when the API is unreachable.
- **Health checks:**
  - every container has a Docker health check;
  - `health-check.sh` runs every 15 minutes and checks:
    - containers;
    - `pg_isready`;
    - `/api/v1/health/ready` (API + database);
    - the web app and the API through nginx with the real host names;
    - redirects;
    - disk (`DISK_WARN_PERCENT`, default 85 %);
    - memory;
    - that the last backup is under 26 h old.

  Failures post to `ALERT_WEBHOOK_URL` (a Slack-compatible webhook) and show in `journalctl`; so does an unexpected error inside the check script itself.
- **From outside:** point any uptime monitor at `https://api.dcarjt.com/api/v1/health/ready` and `https://dcarjt.com/`. **[OCI Console]** *Observability → Monitoring → Alarms* can e-mail you on high CPU or memory (metrics come from the Oracle Cloud Agent on platform images). Cloudflare's *Analytics* shows traffic and edge errors (52x).

## 18. Troubleshooting

| Symptom | Where to look / fix |
|---------|---------------------|
| Workflow: "missing … (production environment)" | Section 7: all five secrets in the `production` environment (or as repository secrets on a free private repository). |
| Workflow: "the live release … already contains this commit" | An older run was re-run after a newer commit went live. Nothing changed. To go back on purpose, run the workflow with `image_tag`. |
| Workflow: the Deploy step failed or was cancelled | The deploy itself ran detached on the server: **[VM · deploy]** read `ls -t /opt/dcarjt/shared/state/deploys/` (newest log and its `.status`). A failed deploy has already put the previous release back. |
| Workflow: SSH "Host key verification failed" | `DEPLOY_KNOWN_HOSTS` does not match the VM (re-created instance, new IP). Redo section 7's host-key step. |
| Workflow: SSH timeout | OCI ingress for 22 (section 5), `DEPLOY_HOST`, `DEPLOY_PORT`. |
| `could not pull images` | **[VM · deploy]** `docker login bom.ocir.io` works? `REGISTRY`/`IMAGE_NAMESPACE` in `.env` equal the GitHub variables? The tag exists in OCIR? |
| `no matching manifest for linux/arm64` (or amd64) | `IMAGE_PLATFORMS` does not include the VM's CPU type. |
| `configuration is incomplete` | Read the lines above it. Usually `CHANGE_ME` left, a quoted value, a missing certificate, or the key not readable by group `DEPLOY_GID`: `bash /opt/dcarjt/bootstrap/scripts/configure-server.sh` fixes permissions. |
| `migrations failed` | Full output in `/opt/dcarjt/shared/state/migrate-<sha>.log`; the running release was not changed. Section 14 ("When a migration fails"). |
| `moves PostgreSQL from 18 to …` / `another PostgreSQL major version` | A major-version change was refused before anything changed. Section 14 ("PostgreSQL major versions"). |
| Deploy failed, previous release restored | Container logs of that attempt: `/opt/dcarjt/shared/state/deploy-<sha>-failure.log`. |
| `nginx configuration test failed` | The output shows the line. Common: certificate path or name mismatch in `.env`. The live configuration was not changed. |
| Cloudflare **521** (web server down) | `$S/dc.sh ps` (is nginx running?); OCI ingress 80/443 from Cloudflare; on the VM `sudo iptables -L INPUT -n --line-numbers` shows 80/443 ACCEPT before the REJECT. |
| Cloudflare **522/524** (timeout) | 522: firewall / VM down. 524: a request took > 100 s at the origin (`$S/dc.sh logs api`). |
| Cloudflare **525/526** (SSL) | Mode must be Full (strict) with a valid origin certificate covering the name (section 9); `openssl x509 -in /opt/dcarjt/shared/certs/origin.crt -noout -subject -dates -ext subjectAltName`. |
| API calls return JSON `503` | The API container is down or restarting: `$S/dc.sh ps`, `$S/dc.sh logs --tail=200 api`. |
| `429 Too many attempts` | nginx's per-visitor limits (`AUTH_RATE_*` for sign-in, OTP, registration and invitations; `PUBLIC_WRITE_RATE_*` for uploads and OCR) in `.env`. A visitor is one IPv4 address or IPv6 /64, taken from Cloudflare. Many staff behind one office connection share a budget: raise the limits if real users hit them, then re-deploy (section 11). |
| Browser: CORS error | `ALLOWED_ORIGINS` in `api.env` must be exactly `https://dcarjt.com` (scheme + host, no slash); recreate the API. |
| Passkeys fail | `WEBAUTHN_RP_ID=dcarjt.com`, `WEBAUTHN_RP_ORIGIN=https://dcarjt.com`. |
| Uploaded images or PDFs do not show | `BASE_URL=https://api.dcarjt.com`, `UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY=true`, `UPLOAD_CROSS_ORIGIN_RESOURCE_POLICY=same-site`, and `ALLOWED_ORIGINS` must list the web app's origin (it also decides who may embed PDFs). |
| API logs `P1000` / authentication failed | `DATABASE_URL` password ≠ the database user's real password. `postgres.env` only applies when the volume is first created (section 11). |
| API cannot reach Gemini / SMTP | VCN egress rules; `$S/dc.sh exec api node -e "fetch('https://generativelanguage.googleapis.com').then(r=>console.log(r.status))"`. |
| Container keeps restarting | `$S/dc.sh ps` then `docker inspect --format '{{json .State}}' <container>`; out of memory shows `OOMKilled: true`: raise `*_MEMORY_LIMIT` in `.env` or the VM size. |
| Disk full | `docker system df`; old releases are pruned automatically, but `docker image prune -a` would also delete rollback images, so prefer removing specific old tags. Check `du -sh /opt/dcarjt/shared/backups/*`, `BACKUP_RETENTION_DAYS` and `UPLOADS_BACKUPS_TO_KEEP`, and drop databases kept by earlier restores (`… _before_restore_…`). |

## 19. Security checklist

- [ ] No secrets in Git: `api.env`, `postgres.env`, certificates, keys and backups live only in `/opt/dcarjt/shared` (CI scans the history with gitleaks).
- [ ] No secrets in images: `.dockerignore` excludes `.env*`; the web app gets only public `VITE_*` values.
- [ ] `api.env` and `postgres.env` are `chmod 600`; the TLS key is `640` (deploy group only); backups are `700`.
- [ ] PostgreSQL and the API publish no ports; the database network is `internal`; only nginx listens on 80/443.
- [ ] Containers run as non-root (API `node`, web servers uid 101), with read-only root filesystems, `cap_drop: ALL` and `no-new-privileges`. PostgreSQL's entrypoint keeps the few capabilities it needs to drop to the `postgres` user.
- [ ] Cloudflare **Full (strict)**, Always Use HTTPS, TLS ≥ 1.2; HSTS from nginx.
- [ ] Origin ingress 80/443 limited to Cloudflare once stable (section 5); SSH 22 limited to your IP where possible; unknown host names get no certificate and no content.
- [ ] Express `trust proxy` is exactly **1 hop** (the edge nginx). nginx takes the visitor IP from `CF-Connecting-IP` **only** when the connection comes from Cloudflare's ranges, and overwrites `X-Forwarded-For` (clients cannot spoof it).
- [ ] Rate limits at nginx, per visitor (an IPv4 address, or an IPv6 /64):
  - one budget for requests that try credentials or send e-mail: sign-in, sign-up, OTP, password reset, passkey sign-in, self-registration, invitations. Paths match in any letter case, like the API's routing.
  - one for the unauthenticated upload and OCR endpoints.

  The session heartbeat, token refresh and CORS preflights are not counted.
- [ ] **Open app-level items** (not deployment settings; they need code changes in `EDEALER_RECORD`):
  - `POST /api/v1/upload/generate`, `PUT /api/v1/upload/file/:key` and `POST /api/v1/ai/*` accept requests without signing in. The web app calls them without a token on purpose. nginx only slows abuse down: a stranger can still store files (up to the disk) and spend Gemini credits. Recommended: short-lived signed upload URLs, and a token on the built-in OCR calls.
  - OTP checks have no per-code attempt limit. nginx's per-visitor limit makes guessing slow, but a cap of about 5 wrong codes per OTP is the robust fix.
- [ ] Super-admin endpoints are protected by the app's authentication and authorization. The bootstrap admin uses a 12+ character password; keep it in a password manager. Bootstrap never promotes an existing ordinary account unless told to.
- [ ] SSH: key-only. The `deploy` user has no password and no sudo, but **docker group membership is root-equivalent**, so guard the CI key (GitHub secret) and rotate it if exposed (replace the line in `/home/deploy/.ssh/authorized_keys`).
- [ ] GitHub Actions and the privileged build helpers (QEMU binfmt, BuildKit) are pinned to commit SHAs and digests, with `permissions: contents: read`.
  - Secrets are passed through stdin or env and never echoed.
  - All deploy secrets are environment secrets of `production` (deployment branches: `main` only); required reviewers are optional.
  - The repository is public, so its Actions logs are public: the deploy writes container logs and migration details only to files on the server.
- [ ] Registry: the CI token is used on the VM only during a deploy (login → deploy → logout). Optional hardening: a separate pull-only OCI user for the server.
- [ ] Updates: Ubuntu security updates are automatic. Update Docker with `apt`. Update the pinned images (Dockerfiles, `compose.yaml`) and npm dependencies deliberately, through a pull request so CI tests them.
- [ ] Backups encrypted (`BACKUP_PASSPHRASE_FILE`) and copied off the server; a restore `--check` is run regularly.
- [ ] No Content-Security-Policy header on the web app yet, on purpose: the app loads Google Fonts and uses inline styles, so a CSP needs testing against every page first. Add one in `snippets/security-headers.conf` when ready. (The API's own Helmet CSP stays; for `/uploads` it allows framing by the web app's origins only, so PDF previews work.)
- [ ] Logs carry no secrets:
  - PostgreSQL logs slow statements without their parameter values;
  - nginx redacts invitation tokens in access-log URLs.

## 20. Cost and resource considerations

- **Always Free** (check Oracle's current terms):
  - Ampere A1 up to 4 OCPU / 24 GB RAM in total;
  - 200 GB of block volume in total;
  - 10 TB of outbound data per month;
  - a limited amount of Object Storage, which OCIR images and off-site backups use.

  Oracle documents that **idle** Always Free instances may be reclaimed; an account upgraded to Pay-As-You-Go keeps the Always Free resources without that risk.
- **Memory budget** (limits in `.env`):

  | Container | Limit |
  |-----------|-------|
  | PostgreSQL | 1 GB |
  | API | 1 GB |
  | nginx | 256 MB |
  | frontend | 128 MB |

  Plus the OS and Docker: **4 GB RAM is the practical minimum, 8–12 GB comfortable**. PostgreSQL defaults suit 2–4 GB for the database:
  - `shared_buffers=256MB`
  - `effective_cache_size=768MB`
  - `max_connections=40`
  - API pool `connection_limit=10`

  With 12 GB you can raise `PG_MEMORY_LIMIT=3g`, `PG_SHARED_BUFFERS=768MB` and `PG_EFFECTIVE_CACHE_SIZE=2GB`, then re-deploy.
- **Builds happen on GitHub**, never on the VM. Multi-platform (arm64 under emulation) is the slow part; set `IMAGE_PLATFORMS` to only your platform.
- **Measure before resizing:**
  - `docker stats` and `free -m` for memory;
  - `uptime` for load;
  - `df -h` and `docker system df` for disk;
  - the nginx `rt=`/`urt=` fields for request times;
  - the OCI Monitoring metrics.

  These numbers are not promises of performance; measure under your own load.
- **Grow when:**
  - the CPU is busy most of the day;
  - containers get `OOMKilled` or the host swaps steadily;
  - the disk passes about 70 %;
  - API times climb.

  Next steps, in order:
  1. A bigger VM shape (A1 is resized in place with the instance stopped).
  2. A separate block volume for Docker data.
  3. **OCI Database with PostgreSQL** (managed: backups, high availability, patching, at extra cost) once the database needs more than one VM can give, or you need high availability. Point `DATABASE_URL` at it and drop the `postgres` service.
