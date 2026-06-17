/**
 * Nettoie le CSV brut exporté depuis Firebase Auth
 * Usage : npx ts-node scripts/clean-firebase-export.ts
 *
 * Input  : raw-users.csv (à la racine du projet)
 * Output : tif-emails-infomaniak.csv (format email,name pour Infomaniak Newsletter)
 */

import * as fs       from 'fs'
import * as readline from 'readline'
import * as path     from 'path'

const ROOT       = process.cwd()
const INPUT_PATH = path.join(ROOT, 'raw-users.csv')
const OUT_PATH   = path.join(ROOT, 'tif-emails-infomaniak.csv')

// Format CSV Firebase Auth :
// Col 0 : UID
// Col 1 : Email
// Col 2 : Email vérifié (true/false)
// Col 3 : Password Hash
// Col 4 : Password Salt
// Col 5 : Nom affiché (displayName)
// Col 6 : Photo URL
// ...

async function clean() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('❌  raw-users.csv introuvable.')
    console.error('    Lance d\'abord :')
    console.error('    firebase auth:export raw-users.csv --format=csv --project tif-2af68')
    process.exit(1)
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const seen    = new Set<string>()
  const rows: string[] = []

  let totalLines = 0
  let skippedInvalid = 0
  let skippedDupe    = 0
  let skippedGuest   = 0

  const rl = readline.createInterface({
    input:     fs.createReadStream(INPUT_PATH),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    totalLines++
    if (totalLines === 1) continue // skip header Firebase

    // Gérer les virgules dans les champs entre guillemets (parsing basique)
    const cols  = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',')
    const email = (cols[1] ?? '').trim().replace(/"/g, '').toLowerCase()
    const name  = (cols[5] ?? '').trim().replace(/"/g, '')

    if (!email || !emailRe.test(email)) { skippedInvalid++; continue }

    // Exclure les comptes invités Firebase (email auto-généré)
    if (email.endsWith('@privaterelay.appleid.com')) { skippedGuest++; continue }

    if (seen.has(email)) { skippedDupe++; continue }
    seen.add(email)

    rows.push(name ? `${email},${name}` : `${email},`)
  }

  // Header Infomaniak Newsletter : email obligatoire, name optionnel
  const output = ['email,name', ...rows].join('\n')
  fs.writeFileSync(OUT_PATH, output, 'utf-8')

  console.log('\n✅  Export nettoyé :')
  console.log(`    Lignes lues      : ${totalLines - 1}`)
  console.log(`    Emails valides   : ${rows.length}`)
  console.log(`    Invalides skips  : ${skippedInvalid}`)
  console.log(`    Doublons retirés : ${skippedDupe}`)
  console.log(`    Guests/Apple     : ${skippedGuest}`)
  console.log(`\n📁  Fichier prêt → tif-emails-infomaniak.csv`)
  console.log(`    → manager.infomaniak.com → Newsletter → Listes → Importer CSV`)
}

clean().catch(err => { console.error(err); process.exit(1) })
