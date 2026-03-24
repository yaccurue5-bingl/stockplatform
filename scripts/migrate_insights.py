#!/usr/bin/env python3
"""
Migrate disclosure_insights (22,180 rows) from ap-south-1 to us-east-1.
Uses smaller batch size due to large text fields.
"""
import json
import urllib.request
import urllib.parse
import subprocess
import tempfile
import os

SRC_URL = "https://rxcwqsolfrjhomeusyza.supabase.co"
SRC_KEY = "***REMOVED***"

DST_PROJECT_ID = "ojzxvaojuglgqmvxhlzh"
ACCESS_TOKEN = "***REMOVED***"
DST_MGMT_URL = f"https://api.supabase.com/v1/projects/{DST_PROJECT_ID}/database/query"

FETCH_BATCH = 500   # rows per REST API fetch
INSERT_BATCH = 100  # rows per INSERT (small due to large text fields)


def fetch_batch(offset, limit=FETCH_BATCH):
    headers = {
        "Authorization": f"Bearer {SRC_KEY}",
        "apikey": SRC_KEY,
    }
    params = {"limit": limit, "offset": offset, "order": "created_at"}
    url = f"{SRC_URL}/rest/v1/disclosure_insights?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def exec_sql(sql):
    payload = json.dumps({"query": sql})
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        f.write(payload)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ["curl", "-s", "-X", "POST", DST_MGMT_URL,
             "-H", f"Authorization: Bearer {ACCESS_TOKEN}",
             "-H", "Content-Type: application/json",
             "-d", f"@{tmp_path}",
             "--max-time", "120"],
            capture_output=True, text=True
        )
        response = result.stdout.strip()
        if not response:
            return None
        parsed = json.loads(response)
        if isinstance(parsed, dict) and ('error' in parsed or 'message' in parsed):
            msg = parsed.get('message', parsed.get('error', ''))
            print(f"\n  SQL error: {msg[:300]}")
            return None
        return parsed
    except Exception as e:
        print(f"\n  exec_sql exception: {e}")
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass


def get_dst_count():
    result = exec_sql("SELECT count(*)::int FROM public.disclosure_insights")
    if isinstance(result, list) and result:
        return result[0].get('count', 0)
    return 0


def insert_rows(rows):
    """Insert a batch of rows using dollar-quoting."""
    json_data = json.dumps(rows, ensure_ascii=False)
    tag = "migdata"
    sql = (
        f"INSERT INTO public.disclosure_insights "
        f"SELECT * FROM json_populate_recordset(null::public.disclosure_insights, ${tag}${json_data}${tag}$::json) "
        f"ON CONFLICT DO NOTHING;"
    )
    result = exec_sql(sql)
    return result is not None


def main():
    print("=== Migrating disclosure_insights ===\n")

    # Get source total
    headers = {"Authorization": f"Bearer {SRC_KEY}", "apikey": SRC_KEY}
    url = f"{SRC_URL}/rest/v1/disclosure_insights?select=id&limit=1"
    req = urllib.request.Request(url, headers={**headers, "Prefer": "count=exact"})
    with urllib.request.urlopen(req, timeout=30) as r:
        content_range = r.headers.get('Content-Range', '')
        total = int(content_range.split('/')[-1]) if '/' in content_range else 22180
    print(f"Source total: {total:,} rows")

    dst_count = get_dst_count()
    print(f"Destination current: {dst_count:,} rows")

    if dst_count >= total:
        print("Already up to date!")
        return

    offset = dst_count  # Resume from where we left off
    inserted = dst_count
    failed_batches = 0

    while offset < total:
        # Fetch from source
        rows = fetch_batch(offset, FETCH_BATCH)
        if not rows:
            break

        # Insert in smaller sub-batches
        for i in range(0, len(rows), INSERT_BATCH):
            chunk = rows[i:i+INSERT_BATCH]
            ok = insert_rows(chunk)
            if ok:
                inserted += len(chunk)
            else:
                failed_batches += 1
                # Try even smaller batches on failure
                for row in chunk:
                    ok2 = insert_rows([row])
                    if ok2:
                        inserted += 1

        offset += len(rows)
        pct = inserted / total * 100
        print(f"  Progress: {inserted:,}/{total:,} ({pct:.1f}%) | offset={offset:,} | failed_batches={failed_batches}", end='\r')

    print(f"\n\nFinal count in dst: {get_dst_count():,}")
    if failed_batches:
        print(f"Failed batches: {failed_batches}")


if __name__ == '__main__':
    main()
