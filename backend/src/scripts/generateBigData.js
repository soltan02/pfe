// Generate large realistic datasets for the STB Security Big Data analytics
// layer.  Creates agents, assigns them to sites, and fills the presences /
// rapports / demandes tables with historical data spanning multiple years.
//
// Usage:
//   node backend/src/scripts/generateBigData.js
//
// Environment variables (all optional, defaults produce ~365k presences):
//   BD_AGENTS  — number of agents to generate    (default 500)
//   BD_YEARS   — years of historical data         (default 2)
//   BD_BATCH   — rows per batched INSERT          (default 1000)

require('dotenv').config();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { stbAgencies } = require('./seedSites');

// ---- configuration --------------------------------------------------------
const NUM_AGENTS  = parseInt(process.env.BD_AGENTS || '500', 10);
const NUM_YEARS   = parseInt(process.env.BD_YEARS  || '2', 10);
const BATCH       = parseInt(process.env.BD_BATCH  || '1000', 10);

// Tunisian first / last names for realistic data
const LAST_NAMES  = [
  'Ben Ali','Trabelsi','Ben Salah','Hamdi','Jebali','Chahed','Sassi','Mzali',
  'Bouazizi','Rezgui','Gharbi','Jeddi','Riahi','Dridi','Brahmi','Bouzid',
  'Haddad','Zouari','Marzouki','Lahmar','Chebbi','Khelifi','Ghannouchi',
  'Nouri','Ayari','Mansouri','Boukadida','Mejri','Baccouche','Slim',
];
const FIRST_NAMES = [
  'Mohamed','Ahmed','Ali','Sami','Karim','Youssef','Nabil','Hichem','Amine',
  'Fares','Riadh','Mourad','Walid','Bilel','Hatem','Sofiane','Maher','Habib',
  'Aymen','Khaled','Fatma','Amira','Sarra','Ines','Mariem','Nour','Rania',
  'Hana','Asma','Olfa',
];

// Presence statut probabilities (agent-level; varies ±5% per agent)
const BASE_PROBS = { present: 0.85, retard: 0.07, absent: 0.05, conge: 0.03 };
// Rapport types and their relative weights
const RAPPORT_TYPES   = ['incident', 'absence', 'sante', 'autre'];
const RAPPORT_WEIGHTS = [0.40, 0.30, 0.15, 0.15];
// Demande types
const DEMANDE_TYPES = ['conge', 'affectation', 'equipement', 'autre'];

// ---- helpers ---------------------------------------------------------------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function jitter(base, range) { return Math.max(0, Math.min(1, base + (Math.random() - 0.5) * range)); }

function weightedPick(items, weights) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    cum += weights[i];
    if (r < cum) return items[i];
  }
  return items[items.length - 1];
}

function fmtTime(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function dateRange(startDate, endDate) {
  const dates = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Batch insert helper — builds a multi-row VALUES clause
async function batchInsert(table, columns, rows) {
  if (rows.length === 0) return;
  const colCount = columns.length;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    chunk.forEach((row, ri) => {
      const placeholders = row.map((_, ci) => `$${ri * colCount + ci + 1}`);
      values.push(`(${placeholders.join(',')})`);
      params.push(...row);
    });
    const sql = `INSERT INTO ${table} (${columns.join(',')})
      VALUES ${values.join(',')}
      ON CONFLICT DO NOTHING`;
    await pool.query(sql, params);
  }
}

// ---- main ------------------------------------------------------------------
async function generate() {
  const t0 = Date.now();
  console.log(`\n=== STB Security — Big Data Generator ===`);
  console.log(`Agents: ${NUM_AGENTS}  |  Years: ${NUM_YEARS}  |  Batch: ${BATCH}\n`);

  // 1. Ensure sites exist
  console.log('1/6  Ensuring sites...');
  let sites = (await pool.query('SELECT id, nom FROM sites')).rows;
  if (sites.length < 5) {
    console.log('     Seeding STB agencies...');
    for (const a of stbAgencies) {
      const exists = await pool.query('SELECT id FROM sites WHERE nom=$1', [a.nom]);
      if (exists.rows.length === 0) {
        await pool.query(
          'INSERT INTO sites (nom, adresse, ville, statut) VALUES ($1,$2,$3,$4)',
          [a.nom, a.adresse, a.ville, 'actif']
        );
      }
    }
    sites = (await pool.query('SELECT id, nom FROM sites')).rows;
  }
  console.log(`     ${sites.length} sites ready.`);

  // 2. Create chef_equipe users (one per site that lacks a chef)
  console.log('2/6  Ensuring chef_equipe users...');
  const sitesWithoutChef = (await pool.query(
    'SELECT id, nom FROM sites WHERE chef_id IS NULL'
  )).rows;
  for (const s of sitesWithoutChef) {
    const nom = `Chef ${s.nom.replace('STB ', '')}`;
    const email = `chef_${s.id}@stb.tn`;
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    let chefId;
    if (existing.rows.length > 0) {
      chefId = existing.rows[0].id;
    } else {
      const hash = await bcrypt.hash('password', 10);
      const res = await pool.query(
        'INSERT INTO users (nom, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id',
        [nom, email, hash, 'chef_equipe']
      );
      chefId = res.rows[0].id;
    }
    await pool.query('UPDATE sites SET chef_id=$1 WHERE id=$2', [chefId, s.id]);
  }
  console.log(`     ${sitesWithoutChef.length} new chefs assigned.`);

  // 3. Generate agents + user logins
  console.log('3/6  Generating agents...');
  const existingMatricules = new Set(
    (await pool.query('SELECT matricule FROM agents')).rows.map(r => r.matricule)
  );
  const startIdx = existingMatricules.size;
  const newAgentRows = [];
  for (let i = 0; i < NUM_AGENTS; i++) {
    const matricule = `A${String(startIdx + i + 1).padStart(4, '0')}`;
    if (existingMatricules.has(matricule)) continue;
    newAgentRows.push({
      nom: pick(LAST_NAMES),
      prenom: pick(FIRST_NAMES),
      matricule,
      telephone: String(20000000 + randInt(0, 9999999)),
      statut: Math.random() < 0.92 ? 'actif' : 'inactif',
    });
  }
  // Insert agents
  if (newAgentRows.length > 0) {
    const agentBatch = newAgentRows.map(a => [a.nom, a.prenom, a.matricule, a.telephone, a.statut]);
    await batchInsert('agents', ['nom','prenom','matricule','telephone','statut'], agentBatch);
  }
  // Create user logins for new agents
  const allAgents = (await pool.query('SELECT id, matricule FROM agents')).rows;
  const existingAgentUsers = new Set(
    (await pool.query('SELECT agent_id FROM users WHERE agent_id IS NOT NULL')).rows.map(r => r.agent_id)
  );
  let loginCount = 0;
  const defaultHash = await bcrypt.hash('password', 10);
  for (const agent of allAgents) {
    if (existingAgentUsers.has(agent.id)) continue;
    await pool.query(
      'INSERT INTO users (nom, email, password, role, agent_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [agent.matricule, `${agent.matricule}@stb.tn`, defaultHash, 'agent', agent.id]
    );
    loginCount++;
  }
  console.log(`     ${newAgentRows.length} agents created, ${loginCount} logins added.`);
  console.log(`     Total agents: ${allAgents.length}`);

  // 4. Affectations — assign each active agent to a site
  console.log('4/6  Generating affectations...');
  const siteIds = sites.map(s => s.id);
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - NUM_YEARS);

  const affectRows = [];
  for (const agent of allAgents) {
    // 1–3 affectations spanning the period
    const numAff = randInt(1, 3);
    let cursor = new Date(startDate);
    for (let a = 0; a < numAff; a++) {
      const daysLen = Math.floor((endDate - cursor) / (86400000 * (numAff - a)));
      const segEnd = new Date(cursor.getTime() + daysLen * 86400000);
      affectRows.push([
        agent.id,
        pick(siteIds),
        cursor.toISOString().slice(0, 10),
        segEnd.toISOString().slice(0, 10),
        segEnd < endDate ? 'termine' : 'en cours',
      ]);
      cursor = new Date(segEnd.getTime() + 86400000);
      if (cursor > endDate) break;
    }
  }
  await batchInsert(
    'affectations',
    ['agent_id','site_id','date_debut','date_fin','statut'],
    affectRows
  );
  console.log(`     ${affectRows.length} affectations inserted.`);

  // 5. Presences — daily attendance for each agent over the full period
  console.log('5/6  Generating presences (this may take a moment)...');
  const allDates = dateRange(startDate, endDate);

  // Build a lookup: agent → site on each date (from affectations)
  const agentAffectations = {};
  for (const row of affectRows) {
    const [agentId, siteId, dd, df] = row;
    if (!agentAffectations[agentId]) agentAffectations[agentId] = [];
    agentAffectations[agentId].push({ siteId, start: new Date(dd), end: new Date(df) });
  }

  let presCount = 0;
  // Process in chunks of agents to keep memory bounded
  const agentChunkSize = 50;
  for (let ac = 0; ac < allAgents.length; ac += agentChunkSize) {
    const agentSlice = allAgents.slice(ac, ac + agentChunkSize);
    const presRows = [];
    for (const agent of agentSlice) {
      // Per-agent jittered probabilities
      const pPresent = jitter(BASE_PROBS.present, 0.10);
      const pRetard  = jitter(BASE_PROBS.retard, 0.04);
      const pAbsent  = jitter(BASE_PROBS.absent, 0.04);
      // rest is conge

      const affs = agentAffectations[agent.id] || [];
      for (const d of allDates) {
        // find which site the agent is at on this date
        const aff = affs.find(a => d >= a.start && d <= a.end);
        if (!aff) continue; // no assignment → no presence record

        const r = Math.random();
        let statut, arrH, arrM, depH, depM;
        if (r < pPresent) {
          statut = 'present';
          arrH = 7; arrM = randInt(0, 15);   // 07:00–07:15
          depH = 17; depM = randInt(0, 30);
        } else if (r < pPresent + pRetard) {
          statut = 'retard';
          arrH = 8; arrM = randInt(0, 59);   // late: 08:00–08:59
          depH = 17; depM = randInt(30, 59);
        } else if (r < pPresent + pRetard + pAbsent) {
          statut = 'absent';
          arrH = null; arrM = null; depH = null; depM = null;
        } else {
          statut = 'conge';
          arrH = null; arrM = null; depH = null; depM = null;
        }

        presRows.push([
          agent.id,
          aff.siteId,
          d.toISOString().slice(0, 10),
          statut,
          arrH !== null ? fmtTime(arrH, arrM) : null,
          depH !== null ? fmtTime(depH, depM) : null,
        ]);
      }
    }
    await batchInsert(
      'presences',
      ['agent_id','site_id','date','statut','heure_arrivee','heure_depart'],
      presRows
    );
    presCount += presRows.length;
    process.stdout.write(`     ${presCount} presences so far...\r`);
  }
  console.log(`     ${presCount} presences inserted.              `);

  // 6. Rapports + Demandes — scattered over the period
  console.log('6/6  Generating rapports & demandes...');
  // ~1 rapport per 50 presence-days per agent (incident/absence/sante/autre)
  const chefUsers = (await pool.query(
    "SELECT u.id, s.id AS site_id FROM users u JOIN sites s ON s.chef_id = u.id WHERE u.role='chef_equipe'"
  )).rows;
  const chefBySite = {};
  for (const c of chefUsers) chefBySite[c.site_id] = c.id;

  const rapportRows = [];
  const demandeRows = [];
  for (const agent of allAgents) {
    const affs = agentAffectations[agent.id] || [];
    const rapportCount = randInt(2, Math.ceil(allDates.length / 80));
    for (let i = 0; i < rapportCount; i++) {
      const d = pick(allDates);
      const aff = affs.find(a => d >= a.start && d <= a.end);
      if (!aff) continue;
      const type = weightedPick(RAPPORT_TYPES, RAPPORT_WEIGHTS);
      const statut = Math.random() < 0.6 ? 'approved' : 'pending';
      const chefId = chefBySite[aff.siteId] || null;
      rapportRows.push([
        agent.id, aff.siteId, type,
        `${type === 'incident' ? 'Security incident' : type === 'absence' ? 'Unjustified absence' : type === 'sante' ? 'Health issue' : 'Other'} report for agent ${agent.matricule}`,
        d.toISOString().slice(0, 10),
        statut,
        chefId,
        statut === 'approved' ? 1 : null, // admin user id=1 validates
      ]);
    }
    // ~1 demande per 100 days
    const demandeCount = randInt(1, Math.ceil(allDates.length / 150));
    for (let i = 0; i < demandeCount; i++) {
      const d = pick(allDates);
      const dEnd = new Date(d.getTime() + randInt(1, 14) * 86400000);
      const type = pick(DEMANDE_TYPES);
      const approved = Math.random() < 0.5;
      demandeRows.push([
        agent.id, type,
        `${type} request from ${agent.matricule}`,
        d.toISOString().slice(0, 10),
        dEnd.toISOString().slice(0, 10),
        approved ? 'approved' : 'pending',
        approved,
        approved ? 1 : null,
      ]);
    }
  }
  await batchInsert(
    'rapports',
    ['agent_id','site_id','type','contenu','date','statut','created_by','valide_par'],
    rapportRows
  );
  await batchInsert(
    'demandes',
    ['agent_id','type','motif','date_debut','date_fin','statut','chef_approved','valide_par'],
    demandeRows
  );
  console.log(`     ${rapportRows.length} rapports, ${demandeRows.length} demandes inserted.`);

  // Summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const counts = {};
  for (const t of ['agents','sites','users','affectations','presences','rapports','demandes']) {
    counts[t] = (await pool.query(`SELECT COUNT(*) FROM ${t}`)).rows[0].count;
  }
  console.log(`\n=== Generation complete in ${elapsed}s ===`);
  console.log('Row counts:');
  for (const [t, c] of Object.entries(counts)) {
    console.log(`  ${t.padEnd(15)} ${c}`);
  }

  await pool.end();
}

generate().catch(e => { console.error('Fatal:', e); pool.end(); process.exit(1); });
