#!/bin/bash
echo "=== HTML PAGES ==="
for page in index.html protocol.html guide.html examples.html agents.html contribute.html; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: ts.knitoem.com' http://127.0.0.1/$page)
  echo "$page -> HTTP $code"
done
echo "=== AGENT JSON ==="
for f in index protocol contracts capabilities examples evolution; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: ts.knitoem.com' http://127.0.0.1/agent/$f.json)
  echo "$f.json -> HTTP $code"
done
echo "=== EXTERNAL DOMAIN ==="
curl -s -o /dev/null -w 'ts.knitoem.com -> HTTP %{http_code}\n' http://ts.knitoem.com/ 2>&1 || echo "DNS not resolved"
echo "=== DONE ==="
