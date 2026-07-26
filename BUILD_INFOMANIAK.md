# Construire et déployer TIF chez Infomaniak

## Piège à ne jamais oublier

Les variables `NEXT_PUBLIC_*` sont figées **au moment du build**, pas à l'exécution.

Le fichier `.env.production.local` déclare `NEXT_PUBLIC_MAPBOX_TOKEN` et
`NEXT_PUBLIC_ABLY_KEY` avec des **valeurs vides**, et il est **prioritaire** sur
`.env.local` qui contient les bonnes valeurs. Construire avec ce fichier en place
produit une application dont la carte ne démarre pas, avec l'erreur
« An API access token is required to use Mapbox GL », et l'application bascule sur
sa page d'erreur.

C'est arrivé le 26 juillet 2026. Le fichier a donc été renommé
`.env.production.local.PIEGE-NE-PAS-REACTIVER`. **Ne pas le remettre en place.**

Vérification obligatoire après chaque build :

    grep -rl 'pk\.ey' .next/static/chunks | wc -l    # doit être > 0

Si le résultat est 0, le jeton Mapbox n'est pas dans le build : ne pas déployer.

## Procédure

    SKIP_ENV_VALIDATION=1 npx next build
    grep -rl 'pk\.ey' .next/static/chunks | wc -l          # contrôle
    cp -r .next/static .next/standalone/.next/
    cp -r public .next/standalone/
    rm -f .next/standalone/.env                            # garder celui du serveur
    tar -czf /tmp/tif_deploy.tar.gz -C .next/standalone .

Puis envoi par SFTP vers `/srv/customer/`, extraction dans
`/srv/customer/sites/tif.borja-swiss-solutions.ch` après avoir supprimé les anciens
`.next`, `node_modules` et `public`, sans jamais toucher au `.env` du serveur.

Enfin, **Redémarrer** depuis le tableau de bord Infomaniak. Une modale de confirmation
avec case à cocher doit être validée, sinon rien ne se passe.

## Autres pièges vérifiés

- Ne jamais lancer `npm run build` avec `DATABASE_URL` défini : le script contient
  `prisma migrate deploy`, qui viserait la base de production.
- `sshpass -e ssh` fonctionne mais ne renvoie pas la sortie console. Ne pas utiliser
  l'option `-tt`, elle casse sshpass. Vérifier les effets par SFTP.
- `chmod` et `rm` passent mieux en SFTP qu'en exécution SSH.
- Après un changement DNS, attendre au moins une heure avant de demander le certificat
  SSL. Let's Encrypt bloque après cinq échecs de validation par heure.
