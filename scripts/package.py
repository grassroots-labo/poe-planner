"""Create local trial and source archives from explicit source paths only."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parent.parent
dist = root / "dist"
dist.mkdir(exist_ok=True)
extension = sorted(p for p in (root / "extension").iterdir() if p.is_file() and p.suffix in {".js", ".json", ".html", ".css"})
docs = [root / n for n in ["README.md", "TESTING.md", "LICENSE"]]
source = extension + docs + [root / "package.json", root / ".gitignore"] + sorted((root / "tests").glob("*.js")) + [root / "tests/browser.html", root / "scripts/serve.js", root / "scripts/package.py"]
hashes = []
for name, files in [("poe-planner-v0.1.0-chrome.zip", extension + docs), ("poe-planner-v0.1.0-source.zip", source)]:
    archive = dist / name
    with ZipFile(archive, "w", ZIP_DEFLATED) as z:
        for file in files:
            z.write(file, file.relative_to(root).as_posix())
    hashes.append(hashlib.sha256(archive.read_bytes()).hexdigest() + "  " + name)
    print(name, archive.stat().st_size, "bytes", len(files), "files")
(dist / "SHA256SUMS.txt").write_text("\n".join(hashes) + "\n", encoding="utf-8")
