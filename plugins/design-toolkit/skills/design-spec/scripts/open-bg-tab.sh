#!/bin/sh
# Opens a URL in the default browser without bringing the browser to the front.
url="$1"
if [ -z "$url" ]; then
  echo "usage: open-bg-tab.sh <url>" >&2
  exit 2
fi
exec open -g "$url"
