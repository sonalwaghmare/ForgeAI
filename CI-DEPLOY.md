# Deploying

One pipeline, two jobs. `build` runs `npm run verify` — lint, i18n keys, colour
literals, mock contract, then the production build — and zips `dist/` into
`dist.zip`. `deploy` copies that single file to the server over SSH and unpacks
it into the web root. Nothing is built on the server.

Definition: `.gitlab-ci.yml`.

## The variables

**These are already set on the project** (`forgeai-frontend`, id 378). This
section is the record of what they are, not a list of work to do.

Every one is prefixed `HZ_DEDI_XYZ_`. The prefix is underscored because GitLab
variable keys accept only letters, digits and underscores — a hyphen is rejected
at creation.

| Key | Masked | Hidden | Value |
|---|---|---|---|
| `HZ_DEDI_XYZ_SSH_KEY_B64` | yes | **yes** | The deploy key, base64 of the PEM |
| `HZ_DEDI_XYZ_DEPLOY_HOST` | yes | no | `dedi-fsn` |
| `HZ_DEDI_XYZ_DEPLOY_USER` | yes | no | the SSH account |
| `HZ_DEDI_XYZ_DEPLOY_PORT` | no | no | `30` |
| `HZ_DEDI_XYZ_DEPLOY_PATH` | no | no | `/var/www/newforge/dist` |
| `HZ_DEDI_XYZ_SSH_KNOWN_HOSTS` | no | no | `ssh-keyscan -p 30 <host>` output |
| `HZ_DEDI_XYZ_VITE_API_URL` | no | no | `https://api-newforge.forgeai.pragmatyc.com/api` |
| `HZ_DEDI_XYZ_SUDO_PW_B64` | yes | **yes** | The sudo password, base64 |
| `HZ_DEDI_XYZ_DEPLOY_SUDO` | no | no | `sudo` |
| `HZ_DEDI_XYZ_VITE_DEMO_MODE` | no | no | `false` |

Ten in total. The login is key-only — the server offers `publickey` and nothing
else — so there is no password variable for SSH itself.

### Demo mode

`HZ_DEDI_XYZ_VITE_DEMO_MODE` is the switch, unwrapped to `VITE_DEMO_MODE` in the
build job. It is currently **`false`**.

It must be **exactly** `true` or `false`. `config.js` reads it as
`env.VITE_DEMO_MODE === 'true'`, a string compare, so `True`, `TRUE`, `yes`, `1`
or a stray trailing space would every one of them quietly mean *off* — a build
where a demo was asked for and silently not delivered. The job rejects anything
that is not one of the two words rather than shipping that.

**It is baked in at build time.** Changing the variable does nothing to the live
site until a **new pipeline** runs: push to `developer`, or press **Run pipeline**
on the branch (CI/CD → Pipelines → Run pipeline).

**Retrying the `build` job of a finished pipeline is not enough**, and it fails
in a way that looks like success. The retried build does pick up the new
variable — the banner appears in its log, and it uploads a fresh artifact — but
GitLab re-runs only the job you clicked. `deploy` keeps the green tick from its
earlier run and never fires again, so the server goes on serving the artifact
from the *previous* build. The pipeline is all green and the site is unchanged.

If you have already retried the build and want that artifact out, retry `deploy`
too; it will pick up the newest build in the pipeline. A fresh pipeline is the
cleaner habit.

With it on, the build log carries an unmissable banner. That banner is the whole
of the protection now: `DEMO-MODE.md` §10 asks for the flag to be absent or false
in production, because every figure behind it is authored rather than measured,
and `SECURITY.md` and `PRODUCT.md` both commit this product to never presenting
invented numbers as measured. Making it a variable means a demo build can be
asked for deliberately; the banner means it can never be on unnoticed.

### Why the key is base64

GitLab can only mask a **single-line** value, and a PEM is seven lines. Raw, the
key could not be masked, and so could not be hidden either — it would sit in the
variable list in clear text. Encoded, it satisfies the mask charset and can be
`masked_and_hidden`. The deploy job decodes it and runs `ssh-keygen -l` over the
result before using it, so a corrupted value fails loudly instead of hanging on
an auth prompt.

A hidden variable is write-only: **GitLab will never show it again**, to anyone.
Replacing the key means deleting the variable and creating it anew.

To encode a replacement:

```
base64 -w0 path/to/key.pem
```

### Why the copy runs under sudo, and where sshpass lives

`/var/www/newforge/dist` is `root:root`, and the deploy account is in the `sudo`
group but has no passwordless sudo. So `HZ_DEDI_XYZ_DEPLOY_SUDO=sudo`, and the
privileged steps go through a `priv()` function on the remote side that runs
`sshpass -e sudo`.

**sshpass runs on the server, not on the runner**, and that is not a detail —
it is the only place it can work. sshpass answers a password prompt by watching
a pty it created. On the runner it wraps `ssh`, and it stops watching once ssh
itself has authenticated; this login is key-based, so ssh never prompts, sshpass
hands over immediately, and `sudo`'s prompt arrives long after it has stopped
listening. Tried both ways, it hangs on `[sudo] password for …` until the job
times out — including with `-P "[sudo]"`. Wrapping `sudo` directly on the
server, sshpass gives it a pty of its own and types into that.

This means **`sshpass` must be installed on the server** (`apt install sshpass`;
it is, as of 2026-08-19, at 1.09). The remote script checks for it and fails with
that instruction rather than hanging.

The password is decoded from `HZ_DEDI_XYZ_SUDO_PW_B64` into `SSHPASS` in the
remote shell, which is what `sshpass -e` reads. It is never an argument, so it
does not appear in `ps`.

The copy is `cp -R`, not `cp -a`: running as root, `-a` would preserve the
staging directory's ownership and leave the web root owned by the deploy user.
`-R` leaves the files `root:root`, as they are today.

If the directory is ever chowned to the deploy user, empty
`HZ_DEDI_XYZ_DEPLOY_SUDO` — `priv` becomes a passthrough, sshpass is no longer
called at all, and `HZ_DEDI_XYZ_SUDO_PW_B64` can be deleted.

### Why nothing is protected

Only `main` is a protected branch on this project. A protected variable is
withheld from jobs on unprotected branches, so on `developer` every one of these
would arrive empty and the deploy would fail with nothing in the log to explain
it. Flip them to protected once `developer` is itself protected — not before.

### Regenerating the host keys

```
ssh-keyscan -p 30 <host>
```

Paste the whole output into `HZ_DEDI_XYZ_SSH_KNOWN_HOSTS`. Only needed if the
server is rebuilt. Without it the job falls back to trusting the key on first
sight and says so in the log.

## The server, as checked on 2026-08-19

Verified against `dedi-fsn` directly, not assumed:

- The deploy key authenticates as `shailesh` — `uid=1000`, in `sudo`, `docker`,
  `projects-read`, `forgeai`.
- `unzip` is present at `/usr/bin/unzip`; `base64` is present.
- `/var/www/newforge/dist` is `root:root` and **not** writable by the deploy
  user; `sudo -n` fails, so sudo wants a password. Hence the `priv()` path above.
- `sshpass` was **not** installed; it was installed on 2026-08-19 (1.09-1+b1).
  `sshpass -e sudo` then reaches root, twice in a row with `sudo -k` between, so
  it is answering the prompt rather than riding sudo's timestamp cache.
- `/tmp` is writable for staging. Disk is 81% full, 82 GB free.
- Caddy serves the site.

The whole deploy was rehearsed end to end against a scratch `root:root`
directory on the server, twice — once with `sudo -S`, and again after the switch
to `sshpass -e sudo`. Both times: 2.6 MB archive uploaded in ~4s, unpacked to 57
files, a planted stale chunk removed, files landing `root:root`, staging cleaned
up. The live directory was never touched.

## What the deploy actually does

1. `scp` `dist.zip` to `/tmp/forgeai-<sha>.zip`.
2. Unpack it into `/tmp/forgeai-<sha>/` and check `index.html` is there.
3. Delete `assets/` from the web root, then copy the new tree over it.
4. Remove the staging files.

Step 3 is why it is not a bare `unzip -o` into the web root: overwriting would
leave every superseded hashed chunk in `assets/` forever, so the directory would
grow with each release while serving files nothing references. `index.html` and
`favicon.ico` are overwritten in place, so there is no window where the site is
missing.

## When it runs

**Only on `developer`, and automatically.** A `workflow:` rule gates the whole
pipeline, so on any other branch no pipeline is created at all — not a skipped
job, not a manual button, nothing. There is nowhere else for it to deploy to
yet.

The deploy job carries no branch rule of its own. `workflow` has already settled
that question, and repeating it on the job would be a second place to keep in
step with the first. Deploy runs whenever the build it needs has passed.

Adding a second environment later means a second `if` in `workflow:` and a
matching `environment:` on a second deploy job — not a condition scattered
across both.

**A push to `developer` deploys.** There is no button between the two.
