import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

const teams = [
  ['MAJ2026','Chelsea_FC.svg'],
  ['AYM2026','Real_Madrid_CF.svg'],
  ['MAH2026','Arsenal_FC.svg'],
  ['SAH2026','Ajax_Amsterdam.svg'],
  ['ZAK2026','Manchester_United_FC_crest.svg'],
  ['HAQ2026','FC_Barcelona_(crest).svg'],
  ['DRI2026','FC_Internazionale_Milano_2021.svg'],
  ['WAL2026','Paris_Saint-Germain_F.C..svg'],
  ['SMQ2026','Logo_of_AC_Milan.svg'],
  ['MOQ2026','Atletico_Madrid_2017_logo.svg'],
  ['AYO2026','Liverpool_FC.svg'],
  ['HUS2026','Manchester_City_FC_badge.svg'],
  ['YAS2026','FC_Bayern_München_logo_(2017).svg'],
  ['KRM2026','Juventus_FC_2017_logo.svg'],
  ['YZD2026','Tottenham_Hotspur.svg'],
  ['AZZ2026','Borussia_Dortmund_logo.svg'],
];

// ensure bucket
await sb.storage.createBucket('team-logos', { public: true }).catch(()=>{});

for (const [code, file] of teams) {
  const src = `https://en.wikipedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=300`;
  const res = await fetch(src);
  if (!res.ok) { console.log('FAIL DL', code, res.status); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${code}.png`;
  const { error } = await sb.storage.from('team-logos').upload(path, buf, { contentType: 'image/png', upsert: true });
  if (error) { console.log('FAIL UP', code, error.message); continue; }
  const { data } = sb.storage.from('team-logos').getPublicUrl(path);
  await sb.from('teams').update({ logo_url: data.publicUrl }).eq('access_code', code);
  console.log('OK', code, buf.length, data.publicUrl);
}
