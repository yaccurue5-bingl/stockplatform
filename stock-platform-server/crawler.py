import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def run():
    end = datetime.datetime.now().strftime('%Y%m%d')
    start = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    print(f"Start: {start}~{end}")
    data = dart.list(corp='005930', start=start, end=end)
    if not data or len(data) == 0:
        print("No data")
        return
    for i, r in data.head(1).iterrows():
        nm = r.get('report_nm', '')
        corp = r.get('corp_name', '')
        rcept = r.get('rcept_no', '')
        if not rcept:
            continue
        print(f"Process: {nm}")
        try:
            c = dart.document(rcept)
            if not c:
                continue
            p = f"Summarize: {nm}\n{c[:1000]}"
            res = None
            for m in ["gemini-1.5-flash-latest", "gemini-1.5-flash"]:
                try:
                    res = client.models.generate_content(model=m, contents=p)
                    if res and res.text:
                        break
                except:
                    pass
            if res and res.text:
                supabase.table("disclosure_insights").upsert({
                    "corp_name": corp,
                    "report_nm": nm,
                    "ai_summary": res.text,
                    "rcept_no": rcept
                }).execute()
                print("Saved")
        except Exception as e:
            print(f"Error: {e}")
    print("Done")

if __name__ == "__main__":
    run()
