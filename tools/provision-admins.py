"""Owner-only provisioning after applying the admin migration.

Reads the project secret and initial password privately from env/getpass.
Never stores either in the repository or prints API responses containing tokens.
"""
from pathlib import Path
from getpass import getpass
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import argparse
import json
import os
import re

parser=argparse.ArgumentParser(description='Provision the two authorized site administrators using the Supabase Auth Admin API.')
parser.add_argument('--reset-existing-passwords',action='store_true',help='Explicitly reset passwords if these internal accounts already exist.')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
url=re.search(r"SUPABASE_URL = '([^']+)'",(root/'supabase-config.js').read_text())[1]
key=os.environ.get('SUPABASE_SECRET_KEY') or getpass('Supabase project secret key (hidden): ')
password=os.environ.get('SNAPIR_INITIAL_ADMIN_PASSWORD') or getpass('Initial password for both site admins (hidden): ')
if not key or len(password)<8:
    raise SystemExit('A project secret and a password of at least eight characters are required. No changes made.')
headers={'apikey':key,'Content-Type':'application/json'}
if not key.startswith('sb_secret_'):
    headers['Authorization']='Bearer '+key
def api(path,method='GET',data=None,extra=None):
    request=Request(url+path,data=json.dumps(data).encode() if data is not None else None,headers={**headers,**(extra or {})},method=method)
    try:
        with urlopen(request,timeout=30) as response:
            body=response.read()
            return json.loads(body) if body else None
    except HTTPError as error:
        raise SystemExit(f'Supabase rejected {method} {path.split("?")[0]} (HTTP {error.code}). Stopped; no bypass attempted.') from None

# Verify that the migration exists before creating any Auth accounts.
api('/rest/v1/svk_staff?select=user_id&limit=1')
users=[]
page=1
while True:
    batch=api(f'/auth/v1/admin/users?page={page}&per_page=1000').get('users',[])
    users.extend(batch)
    if len(batch)<1000:break
    page+=1
for username in ('sariel','erez'):
    email=username+'@staff.snapirvekaskeset.invalid'
    existing=next((user for user in users if user.get('email','').lower()==email),None)
    if existing:
        user=existing
        if args.reset_existing_passwords:
            user=api('/auth/v1/admin/users/'+existing['id'],'PUT',{'password':password,'email_confirm':True})
    else:
        user=api('/auth/v1/admin/users','POST',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'username':username}})
    api('/rest/v1/svk_staff?on_conflict=user_id','POST',{'user_id':user['id'],'display_name':username,'role':'admin','active':True},{'Prefer':'resolution=merge-duplicates,return=minimal'})
    print(f'Administrator ready: {username}')
print('Done. Sign in at /admin.html. Password changes are available from the top bar.')
