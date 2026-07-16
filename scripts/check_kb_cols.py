"""Check Knowledgebase columns."""
import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()
c = psycopg2.connect(os.environ['DATABASE_URL'])
cur = c.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='Knowledgebase' ORDER BY ordinal_position")
cols = [r[0] for r in cur.fetchall()]
print("Knowledgebase columns:", cols)
cur.close()
c.close()
