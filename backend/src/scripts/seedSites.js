// Populate the sites table with the real STB bank-branch list across Tunisia.
// Idempotent: each agency is only inserted if no site with the same name
// already exists, so this script is safe to re-run.

require('dotenv').config();
const pool = require('../config/db');

const stbAgencies = [
  { nom: 'STB Siege Central', adresse: 'Rue Hedi Nouira', ville: 'Tunis' },
  { nom: 'STB Tunis Lafayette', adresse: 'Avenue de la Liberte', ville: 'Tunis' },
  { nom: 'STB Tunis Bab Bhar', adresse: 'Avenue Habib Bourguiba', ville: 'Tunis' },
  { nom: 'STB Tunis El Menzah', adresse: 'El Menzah 5', ville: 'Tunis' },
  { nom: 'STB Tunis La Marsa', adresse: 'Avenue Taieb Mhiri', ville: 'Tunis' },
  { nom: 'STB Ariana', adresse: 'Avenue Habib Bourguiba', ville: 'Ariana' },
  { nom: 'STB Ben Arous', adresse: 'Centre Urbain', ville: 'Ben Arous' },
  { nom: 'STB Manouba', adresse: 'Cite El Mourouj', ville: 'Manouba' },
  { nom: 'STB Nabeul', adresse: 'Avenue Habib Thameur', ville: 'Nabeul' },
  { nom: 'STB Hammamet', adresse: 'Centre Ville', ville: 'Nabeul' },
  { nom: 'STB Bizerte', adresse: 'Avenue Habib Bourguiba', ville: 'Bizerte' },
  { nom: 'STB Zaghouan', adresse: 'Avenue de la Republique', ville: 'Zaghouan' },
  { nom: 'STB Beja', adresse: 'Avenue Habib Bourguiba', ville: 'Beja' },
  { nom: 'STB Jendouba', adresse: 'Avenue Farhat Hached', ville: 'Jendouba' },
  { nom: 'STB Le Kef', adresse: 'Avenue Habib Bourguiba', ville: 'Kef' },
  { nom: 'STB Siliana', adresse: 'Avenue de la Republique', ville: 'Siliana' },
  { nom: 'STB Kairouan', adresse: 'Avenue Ali Zouaoui', ville: 'Kairouan' },
  { nom: 'STB Kasserine', adresse: 'Avenue Habib Bourguiba', ville: 'Kasserine' },
  { nom: 'STB Sidi Bouzid', adresse: 'Avenue Habib Bourguiba', ville: 'Sidi Bouzid' },
  { nom: 'STB Sousse', adresse: 'Boulevard de la Corniche', ville: 'Sousse' },
  { nom: 'STB Sousse Khezama', adresse: 'Khezama Est', ville: 'Sousse' },
  { nom: 'STB Monastir', adresse: 'Avenue de la Republique', ville: 'Monastir' },
  { nom: 'STB Mahdia', adresse: 'Rue Ibn Khaldoun', ville: 'Mahdia' },
  { nom: 'STB Sfax Centre', adresse: 'Avenue Habib Bourguiba', ville: 'Sfax' },
  { nom: 'STB Sfax Chaker', adresse: 'Quartier Chaker', ville: 'Sfax' },
  { nom: 'STB Sfax Sakiet', adresse: 'Sakiet Ezzit', ville: 'Sfax' },
  { nom: 'STB Gabes', adresse: 'Avenue Habib Bourguiba', ville: 'Gabes' },
  { nom: 'STB Medenine', adresse: 'Avenue Habib Bourguiba', ville: 'Medenine' },
  { nom: 'STB Tataouine', adresse: 'Avenue Habib Bourguiba', ville: 'Tataouine' },
  { nom: 'STB Gafsa', adresse: 'Avenue Habib Bourguiba', ville: 'Gafsa' },
  { nom: 'STB Tozeur', adresse: 'Avenue Habib Bourguiba', ville: 'Tozeur' },
  { nom: 'STB Kebili', adresse: 'Avenue de la Republique', ville: 'Kebili' },
];

async function seed() {
  try {
    console.log('Adding STB agencies to sites table...');
    let count = 0;
    for (const agency of stbAgencies) {
      const exists = await pool.query(
        'SELECT id FROM sites WHERE nom = $1', [agency.nom]
      );
      // Skip agencies that are already in the table.
      if (exists.rows.length === 0) {
        await pool.query(
          'INSERT INTO sites (nom, adresse, ville, statut) VALUES ($1, $2, $3, $4)',
          [agency.nom, agency.adresse, agency.ville, 'actif']
        );
        count++;
      }
    }
    console.log(`Done! ${count} agencies added.`);
    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
}

// Export the agency list so other scripts (e.g. the Big Data generator) can
// reuse it without duplicating the branch data. Only auto-run the seed when
// this file is executed directly.
module.exports = { stbAgencies };

if (require.main === module) {
  seed();
}
