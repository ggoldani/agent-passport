# AgentPassport deploy artifacts

This directory contains the production nginx config and systemd unit files.

## Install as root

```bash
sudo cp /srv/agent-passport/deploy/nginx/agent-passport.conf /etc/nginx/sites-available/agent-passport
sudo ln -sf /etc/nginx/sites-available/agent-passport /etc/nginx/sites-enabled/agent-passport

sudo cp /srv/agent-passport/deploy/systemd/agent-passport-api.service /etc/systemd/system/
sudo cp /srv/agent-passport/deploy/systemd/agent-passport-web.service /etc/systemd/system/
sudo cp /srv/agent-passport/deploy/systemd/agent-passport-indexer.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now agent-passport-api agent-passport-web agent-passport-indexer
sudo nginx -t
sudo systemctl reload nginx
```

## Notes

- Services run as `www-data`.
- `.env` is loaded by systemd via `EnvironmentFile=/srv/agent-passport/.env`.
- The web service expects the app to be built already (`npm run build` in `web/`).
