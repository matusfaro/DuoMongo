# Generate missing audio clips and rebuild the manifest.
#
# Voice MUST be mn-MN-YesuiNeural at -10% rate — the same voice as every
# existing clip. Run from the repo root AFTER `npx tsx scripts/dump-texts.mts`:
#
#   uvx --from edge-tts --with edge-tts python scripts/gen-audio.py
#
# Then run `npm run build` (bundles the manifest + copies public/audio into
# dist/) BEFORE `npx cap sync android`.
import asyncio, json, os, sys
import edge_tts

VOICE = "mn-MN-YesuiNeural"
RATE = "-10%"

entries = json.load(open("scripts/texts.json"))
missing = [e for e in entries if not os.path.exists("public/audio/" + e["file"])]
print(f"{len(missing)} clips to generate")

async def gen(e, sem):
    async with sem:
        out = "public/audio/" + e["file"]
        for attempt in range(4):
            try:
                await edge_tts.Communicate(e["text"], VOICE, rate=RATE).save(out)
                if os.path.getsize(out) > 1000:
                    print("ok", e["file"], e["text"])
                    return True
                os.remove(out)
            except Exception as ex:
                print("retry", e["text"], ex, file=sys.stderr)
                if os.path.exists(out):
                    os.remove(out)
                await asyncio.sleep(2 * (attempt + 1))
        print("FAILED", e["text"], file=sys.stderr)
        return False

async def main():
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(*[gen(e, sem) for e in missing])
    fails = results.count(False)
    print(f"done: {len(results) - fails} ok, {fails} failed")
    if fails:
        sys.exit(1)
    manifest = {e["text"]: e["file"] for e in entries}
    for t, f in manifest.items():
        assert os.path.exists("public/audio/" + f), f"missing clip for: {t}"
    with open("src/data/audio-manifest.json", "w") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
    print(f"manifest rebuilt: {len(manifest)} entries")

asyncio.run(main())
