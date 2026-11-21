// Aplica o ícone e as informações de versão no ALICE.exe (usa a biblioteca resedit).
// Uso: node tools/set-exe-info.mjs dist/ALICE-win32-x64/ALICE.exe build/icon.ico 1.0.0
import fs from 'node:fs';
import * as ResEdit from 'resedit';

const [exePath, icoPath, version = '1.0.0'] = process.argv.slice(2);
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);

const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map((i) => i.data));

const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const [a, b, c] = version.split('.').map(Number);
vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, {
  ProductName: 'ALICE', FileDescription: 'ALICE', CompanyName: 'ALICE', InternalName: 'ALICE',
  OriginalFilename: 'ALICE.exe', ProductVersion: version, FileVersion: version, LegalCopyright: '',
});
vi.outputToResourceEntries(res.entries);

res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log('Ícone e versão aplicados em', exePath);
