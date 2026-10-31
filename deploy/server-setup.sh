#!/usr/bin/env bash
#
# One-time setup on the UKNode VPS (Ubuntu). Safe to run again.
#
#   curl -fsSL https://raw.githubusercontent.com/Atovski/PhillyPhilly/main/deploy/server-setup.sh | sudo bash
#
# - clones the `deploy` branch (built by GitHub Actions) into /var/www/phillyphilly
# - pulls it every 2 minutes from cron, so each push to main goes live by itself
# - installs the nginx site and gets a Let's Encrypt certificate
#
# Other sites on this server are left alone. An nginx config is only switched
# off if it serves nothing but phillyphilly.co.uk; it is backed up first.

set -euo pipefail

DOMAIN=phillyphilly.co.uk
REPO=https://github.com/Atovski/PhillyPhilly.git
RAW=https://raw.githubusercontent.com/Atovski/PhillyPhilly/main/deploy
WEBROOT=/var/www/phillyphilly
EMAIL=phillyphillysteak@gmail.com   # Let's Encrypt expiry notices
STAMP=$(date +%Y%m%d-%H%M%S)

[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)."; exit 1; }

echo "==> Packages"
apt-get update -qq
apt-get install -y -qq --no-upgrade git nginx certbot python3-certbot-nginx >/dev/null

echo "==> Site files"
if [ -d "$WEBROOT/.git" ]; then
  git -C "$WEBROOT" fetch -q --depth 1 origin deploy
  git -C "$WEBROOT" reset -q --hard origin/deploy
else
  if [ -e "$WEBROOT" ]; then
    mv "$WEBROOT" "$WEBROOT.bak-$STAMP"
    echo "    existing $WEBROOT moved to $WEBROOT.bak-$STAMP"
  fi
  git clone -q --depth 1 --branch deploy "$REPO" "$WEBROOT"
fi

cat > /etc/cron.d/phillyphilly <<EOF
*/2 * * * * root git -C $WEBROOT fetch -q --depth 1 origin deploy && git -C $WEBROOT reset -q --hard origin/deploy
EOF

echo "==> nginx"
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = phillyphilly ] && continue
  grep -qE "server_name[^;]*phillyphilly\.co\.uk" "$f" || continue
  others=$(grep -hoE "server_name[^;]*" "$f" | sed 's/server_name//' | tr ' \t' '\n\n' \
           | grep -vE '^$|^_$|^(www\.)?phillyphilly\.co\.uk$' || true)
  if [ -n "$others" ]; then
    echo "!! $f also serves: $others"
    echo "!! Remove the phillyphilly.co.uk server block from it by hand, then run this again."
    exit 1
  fi
  mkdir -p "/root/nginx-backup-$STAMP"
  cp -L "$f" "/root/nginx-backup-$STAMP/"
  rm "$f"
  echo "    disabled $f (copy in /root/nginx-backup-$STAMP/)"
done

curl -fsSL "$RAW/nginx.conf" -o /etc/nginx/sites-available/phillyphilly
ln -sf /etc/nginx/sites-available/phillyphilly /etc/nginx/sites-enabled/phillyphilly
if ! nginx -t; then
  rm /etc/nginx/sites-enabled/phillyphilly
  echo "!! nginx rejected the config; site left disabled, nothing reloaded."
  exit 1
fi
systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null
  echo "    firewall: opened 80/443"
fi

echo "==> HTTPS"
domains=(-d "$DOMAIN")
apex_ip=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')
www_ip=$(getent ahostsv4 "www.$DOMAIN" | awk 'NR==1{print $1}')
if [ -n "$www_ip" ] && [ "$www_ip" = "$apex_ip" ]; then
  domains+=(-d "www.$DOMAIN")
else
  echo "    www.$DOMAIN does not point here yet; certificate covers $DOMAIN only."
  echo "    Run this script again once it does."
fi
certbot --nginx --non-interactive --agree-tos -m "$EMAIL" --redirect --expand "${domains[@]}"

echo
echo "Done. https://$DOMAIN is live; pushes to main appear within ~3 minutes."
