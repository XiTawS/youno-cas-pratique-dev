import { config } from 'dotenv';

// IMPORTANT : ce fichier doit être importé en TOUT PREMIER dans server.ts,
// avant n'importe quel autre import (en particulier @clerk/fastify qui
// initialise son clerkClient singleton à l'import en lisant process.env).
// Si dotenv charge après les imports, les SDK voient process.env vide.
//
// En prod (Render/Vercel), les envs sont injectées par la plateforme et les
// chemins inexistants échouent silencieusement - process.env reste autoritatif.
config({ path: '../../.env' });
config({ path: '../../.env.local', override: true });
