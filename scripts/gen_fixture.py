import json, random, string
random.seed(42)
chaps = []
for i in range(1, 201):
    chaps.append({
        "id": f"ch{i:03d}",
        "novel_id": "n1",
        "nomor_chapter": i,
        "judul_chapter": f"Bab {i} — {''.join(random.choices(string.ascii_uppercase, k=8))}",
        "status_pengerjaan": random.choice(["Selesai", "Dalam Progres", "Belum Dimulai"]),
        "konten_text": ("Teks bab " + str(i) + ". " + "Kata penghubung. " * 150),
        "metadata": {"created_at": "2026-01-01", "updated_at": "2026-01-02", "tags": ["fantasi", "aksi", "mystery"], "source": "auto"},
        "glossary_refs": [f"g{i}" for i in range(1, 10)],
        "references": [f"r{i}" for i in range(1, 5)]
    })
with open("fixture_chapters.json", "w") as f:
    json.dump({"chapters": chaps, "count": len(chaps), "novel_id": "n1"}, f)
print("fixture_chapters.json written, bytes:", len(json.dumps({"chapters": chaps})))
