"""
Vytvoří Square Festival event + technika položky + výdaje z Excel souboru.
Spusť: python3 scripts/create_square_festival.py
"""
import requests, json

SUPABASE_URL = "https://iwscqafknuhncmyzbklq.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3c2NxYWZrbnVobmNteXpia2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTI5MzEsImV4cCI6MjA5MzMyODkzMX0.ASxjj2qNzXqGhA5YvamI1SJPGc4Hj81Y2gL8yozZVjo"

# 1. Přihlásit se
auth = requests.post(
    f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
    headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
    json={"email": "admin@trebass.cz", "password": "TrebaSS2026@"}
)
if auth.status_code != 200:
    print("Auth failed:", auth.text); exit(1)

token = auth.json()["access_token"]
H = {"apikey": ANON_KEY, "Authorization": f"Bearer {token}", "Content-Type": "application/json", "Prefer": "return=representation"}

# 2. Vytvořit event
ev = requests.post(f"{SUPABASE_URL}/rest/v1/events", headers=H, json={
    "name": "SQUARE FESTIVAL",
    "status": "pripravuje_se",
    "description": "Techno festival — technika, osvětlení, zvuk, produkce.",
    "stages": ["Main Stage"]
}).json()
if isinstance(ev, list): ev = ev[0]
event_id = ev["id"]
print(f"✓ Event vytvořen: {event_id}")

# 3. Technika položky (z Excel)
equipment = [
    # SVĚTLA
    {"name": "Sunstrip",              "note": "Spot DJ",                      "quantity": 2,  "unit_price": 350, "total_price": 700},
    {"name": "Cameo pixbar 400g2",    "note": "Sloupy stage + nohy",          "quantity": 16, "unit_price": 400, "total_price": 6400},
    {"name": "Arri 650",              "note": "Stage spot",                   "quantity": 2,  "unit_price": 135, "total_price": 270},
    {"name": "Rogue Outcast 1M Beam", "note": "Front truss",                  "quantity": 12, "unit_price": 600, "total_price": 7200},
    {"name": "Robe WTF!",             "note": "Truss za DJ, topplate",        "quantity": 2,  "unit_price": 1600,"total_price": 3200},
    {"name": "EXL Par 25° RGBWA 270W","note": "Dekorace",                     "quantity": 12, "unit_price": 175, "total_price": 2100},
    {"name": "China Flames",          "note": "Oheň efekt",                   "quantity": 2,  "unit_price": 0,   "total_price": 0},
    {"name": "Větrák",                "note": None,                           "quantity": 3,  "unit_price": 0,   "total_price": 0},
    {"name": "Unique Haze",           "note": "Hazer",                        "quantity": 1,  "unit_price": 250, "total_price": 250},
    {"name": "Smoke big JEM ZR44",    "note": "Velký kouřostroj",             "quantity": 1,  "unit_price": 400, "total_price": 100},
    {"name": "LedWasher 60x10W",      "note": "RGB nasvícení budov",          "quantity": 8,  "unit_price": 500, "total_price": 4000},
    # VIDEO
    {"name": "Procesor LED",          "note": None,                           "quantity": 1,  "unit_price": 1000,"total_price": 1000},
    {"name": "LED WALL 3.9 outdoor",  "note": "1x case",                      "quantity": 1,  "unit_price": 2400,"total_price": 2400},
    # REŽIE
    {"name": "GrandMa3 compact",      "note": "Světelný pult",                "quantity": 1,  "unit_price": 2000,"total_price": 2000},
    {"name": "Rack gMA3 8PortNode",   "note": None,                           "quantity": 1,  "unit_price": 1400,"total_price": 1400},
    {"name": "Kabeláž DMX/proudy",    "note": "Paušál akce",                  "quantity": 1,  "unit_price": 2000,"total_price": 2000},
    {"name": "Allen & Heath QU16",    "note": "Zvukový pult",                 "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Motorola R2",           "note": "Vysílačky",                    "quantity": 4,  "unit_price": 150, "total_price": 400},
    # ZVUK
    {"name": "50m CAT kabel",         "note": None,                           "quantity": 2,  "unit_price": 0,   "total_price": 0},
    {"name": "Dx168 Stage box",       "note": None,                           "quantity": 1,  "unit_price": 700, "total_price": 700},
    {"name": "Sennheiser G4",         "note": "Mikrofony",                    "quantity": 4,  "unit_price": 250, "total_price": 1000},
    {"name": "Nexo M620",             "note": "PA MAIN 2x120",               "quantity": 12, "unit_price": 600, "total_price": 7200},
    {"name": "Nexo L18",              "note": "Subwoofer",                    "quantity": 4,  "unit_price": 500, "total_price": 2000},
    {"name": "Nexo PS 15",            "note": "Front fill",                   "quantity": 2,  "unit_price": 700, "total_price": 1400},
    {"name": "Rack NX Amp Nuar",      "note": "Zesilovač",                    "quantity": 2,  "unit_price": 5000,"total_price": 10000},
    {"name": "RCF ART 310A",          "note": "Odposlechy DJ",               "quantity": 2,  "unit_price": 500, "total_price": 1000},
    {"name": "Nexo Ps10",             "note": "Odposlechy stage",             "quantity": 4,  "unit_price": 600, "total_price": 2400},
    # GROUND
    {"name": "Střecha 6x4m",          "note": "Podkládaná, stříbrná",        "quantity": 1,  "unit_price": 7000,"total_price": 7000},
    {"name": "Truss Milos 2m",        "note": "Na stage",                     "quantity": 6,  "unit_price": 152, "total_price": 912},
    {"name": "Patle menší",           "note": "Na stage",                     "quantity": 6,  "unit_price": 50,  "total_price": 300},
    {"name": "Top plate",             "note": "Na stage, beam + WTF!",        "quantity": 6,  "unit_price": 100, "total_price": 600},
    {"name": "Přechody klasik",       "note": "30m",                          "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Přechody black",        "note": "5m",                           "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Přechody big",          "note": "10m",                          "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Pracky pracovní světla","note": "Stánky, areál",                "quantity": 20, "unit_price": 0,   "total_price": 0},
    {"name": "Spotřební materiál",    "note": "Gaffa, pásky, stahovačky",     "quantity": 1,  "unit_price": 700, "total_price": 700},
    {"name": "MOLO",                  "note": "2x 2x1m",                      "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Motor 300kg",           "note": "Na banány, ovladač 1 kanál",   "quantity": 2,  "unit_price": 0,   "total_price": 0},
    # PROUD
    {"name": "Rozvaděč 400V/32A 8x230V","note": "Stánky/areál",              "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "SRS PDU 63A",           "note": "Stage",                        "quantity": 1,  "unit_price": 750, "total_price": 750},
    {"name": "Kabel 32A 125M",        "note": "3x50m = 150m",                "quantity": 3,  "unit_price": 400, "total_price": 1200},
    {"name": "Kabel 63A 125M",        "note": "4x30m = 120m",                "quantity": 4,  "unit_price": 425, "total_price": 1700},
    {"name": "Rozvaděč kostka 400V",  "note": None,                           "quantity": 2,  "unit_price": 400, "total_price": 800},
    # VIDEO kamery
    {"name": "Sony Alpha IV set",     "note": "Sada kamer",                   "quantity": 3,  "unit_price": 750, "total_price": 2250},
    {"name": "Insta 360x5",           "note": "Kamera stage DJ",              "quantity": 1,  "unit_price": 0,   "total_price": 0},
    {"name": "Rekordér Zoom H8",      "note": None,                           "quantity": 1,  "unit_price": 1000,"total_price": 1000},
    {"name": "Stativy a ostatní",     "note": None,                           "quantity": 1,  "unit_price": 2000,"total_price": 2000},
]
for eq in equipment:
    eq["event_id"] = event_id
res = requests.post(f"{SUPABASE_URL}/rest/v1/event_equipment", headers=H, json=equipment)
print(f"✓ Technika: {len(equipment)} položek vloženo (status {res.status_code})")

# 4. Výdaje (grouped by category)
expenses = [
    # TECHNIKA — světla
    {"category": "TECHNIKA", "item": "Sunstrip",               "note": "2 ks × 350",     "price": 700,   "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Cameo pixbar 400g2",     "note": "16 ks × 400",    "price": 6400,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Arri 650",               "note": "2 ks × 135",     "price": 270,   "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Rogue Outcast 1M Beam",  "note": "12 ks × 600",    "price": 7200,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Robe WTF!",              "note": "2 ks × 1600",    "price": 3200,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "EXL Par 25° RGBWA",      "note": "12 ks × 175",    "price": 2100,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Unique Haze",            "note": None,             "price": 250,   "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Smoke big JEM ZR44",     "note": None,             "price": 100,   "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "LedWasher 60x10W",       "note": "8 ks × 500",     "price": 4000,  "deposit": 0, "paid": False},
    # TECHNIKA — video/režie
    {"category": "TECHNIKA", "item": "LED WALL 3.9 outdoor",   "note": "1x case",        "price": 2400,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Procesor LED",           "note": None,             "price": 1000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "GrandMa3 compact",       "note": "Světelný pult",  "price": 2000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Rack gMA3 8PortNode",    "note": None,             "price": 1400,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Kabeláž DMX/proudy",     "note": "Paušál",         "price": 2000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Motorola R2 vysílačky",  "note": "4 ks × 150",     "price": 400,   "deposit": 0, "paid": False},
    # TECHNIKA — zvuk
    {"category": "TECHNIKA", "item": "Dx168 Stage box",        "note": None,             "price": 700,   "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Sennheiser G4 mikrofony","note": "4 ks",           "price": 1000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Nexo M620 PA MAIN",      "note": "12 ks × 600",    "price": 7200,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Nexo L18 sub",           "note": "4 ks × 500",     "price": 2000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Nexo PS15 front fill",   "note": "2 ks × 700",     "price": 1400,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Rack NX Amp Nuar",       "note": "2 ks × 5000",    "price": 10000, "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "RCF ART 310A",           "note": "Odposlechy DJ",  "price": 1000,  "deposit": 0, "paid": False},
    {"category": "TECHNIKA", "item": "Nexo Ps10 odposlechy",   "note": "4 ks × 600",     "price": 2400,  "deposit": 0, "paid": False},
    # INFRASTRUKTURA — ground/stage
    {"category": "INFRASTRUKTURA", "item": "Střecha 6x4m",     "note": "Podkládaná",     "price": 7000,  "deposit": 0, "paid": False},
    {"category": "INFRASTRUKTURA", "item": "Truss Milos 2m",   "note": "6 ks",           "price": 912,   "deposit": 0, "paid": False},
    {"category": "INFRASTRUKTURA", "item": "Patle + Top plate","note": "Stage",          "price": 900,   "deposit": 0, "paid": False},
    {"category": "INFRASTRUKTURA", "item": "Spotřební materiál","note": "Gaffa, pásky",  "price": 700,   "deposit": 0, "paid": False},
    # POWER
    {"category": "POWER",   "item": "SRS PDU 63A",             "note": "Stage",          "price": 750,   "deposit": 0, "paid": False},
    {"category": "POWER",   "item": "Kabel 32A 3×50m",         "note": None,             "price": 1200,  "deposit": 0, "paid": False},
    {"category": "POWER",   "item": "Kabel 63A 4×30m",         "note": None,             "price": 1700,  "deposit": 0, "paid": False},
    {"category": "POWER",   "item": "Rozvaděč kostka 400V",     "note": "2 ks",           "price": 800,   "deposit": 0, "paid": False},
    # POMOCNÁ SÍLA — lidi
    {"category": "POMOCNÁ SÍLA", "item": "Obsluha světla + produkce", "note": "Jakub Kladiva", "price": 10000, "deposit": 0, "paid": False},
    {"category": "POMOCNÁ SÍLA", "item": "Řidič truck + výkladka",    "note": "Martin Liška",  "price": 5000,  "deposit": 0, "paid": False},
    {"category": "POMOCNÁ SÍLA", "item": "Výpomoc",               "note": "David, Artur, Tobias", "price": 9000, "deposit": 0, "paid": False},
    # DOPRAVA
    {"category": "DOPRAVA", "item": "16t truck Prague flat rate", "note": None,           "price": 3250,  "deposit": 0, "paid": False},
    {"category": "DOPRAVA", "item": "Cesta KM",                  "note": "39 Kč/km ~40km","price": 1600, "deposit": 0, "paid": False},
    # VÝSTUPY — video kamery
    {"category": "VÝSTUPY", "item": "Sony Alpha IV set kamer",   "note": "3 ks × 750",    "price": 2250,  "deposit": 0, "paid": False},
    {"category": "VÝSTUPY", "item": "Rekordér Zoom H8",          "note": None,             "price": 1000,  "deposit": 0, "paid": False},
    {"category": "VÝSTUPY", "item": "Stativy a ostatní",         "note": None,             "price": 2000,  "deposit": 0, "paid": False},
]
for ex in expenses:
    ex["event_id"] = event_id
    ex["payment_timing"] = None
    ex["lineup_artist_id"] = None
    ex["equipment_id"] = None

res = requests.post(f"{SUPABASE_URL}/rest/v1/expenses", headers=H, json=expenses)
print(f"✓ Výdaje: {len(expenses)} položek vloženo (status {res.status_code})")
if res.status_code not in [200, 201]:
    print("  Detail:", res.text[:300])

total = sum(e["price"] for e in expenses)
print(f"\n✓ Hotovo! Square Festival vytvořen.")
print(f"  Event ID: {event_id}")
print(f"  Technika: {len(equipment)} položek")
print(f"  Výdaje celkem: {total:,} Kč")
