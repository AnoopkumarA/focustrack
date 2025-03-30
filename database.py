import os
from supabase import create_client, Client

SUPABASE_URL = "https://aslrmiysodplkbyznmnf.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbHJtaXlzb2RwbGtieXpubW5mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTA0NzI5OSwiZXhwIjoyMDU0NjIzMjk5fQ.9t78H1yBhgb03ScDggzsoR3o4GGbD80QX0zvihwSvRY"


supabase = create_client(
    supabase_url=SUPABASE_URL,
    supabase_key=SUPABASE_SERVICE_KEY
)