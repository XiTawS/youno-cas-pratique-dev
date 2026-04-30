# Cas pratique - Développeur (Alternance / Stage)

> Brief reçu de Kaio (Youno) le 2026-04-27. Document source, non modifié.

Bonjour,

Merci pour ce premier échange. Comme convenu, voici le cas pratique pour l'étape suivante.

#### Le contexte

Chez Youno, on construit **Konsole**, une plateforme SaaS qui aide les équipes sales/marketing à industrialiser leur Revenue Engineering. Un des modules de Konsole consiste à **analyser un site web et donner des infos exploitables sur l'entreprise qui le détient**.

#### Ta mission

Construis une **petite application web** qui :

1. Prend en entrée une **URL de site web** (ex : `stripe.com`)
2. Récupère des **informations utiles sur l'entreprise** (nom, description, tech stack détectée, secteur, taille approximative, signaux GTM à toi de choisir ce qui te paraît le plus pertinent)
3. Affiche le résultat dans une **UI simple et propre**
4. Optionnel mais apprécié : propose un **scoring automatique** (par exemple "fit pour une boîte qui vend à des SaaS B2B") avec une logique que tu auras définie

#### Comment récupérer les données

Choix libre, c'est une partie de l'exercice :

- **APIs publiques** : Clearbit, Hunter, BuiltWith, etc. (plans gratuits)
- **Scraping du site** : titre, meta, favicon, liens, etc.
- **LLM pour analyser le HTML récupéré** : OpenAI free tier, Anthropic free tier, Groq free, etc.
- **Combinaison des 3** souvent la meilleure approche

#### Contraintes techniques

- **Stack libre** : prends ce avec quoi tu es le plus à l'aise (Next.js, React, Vue, Svelte, Python/Flask, Node/Express, etc.)
- **Hébergement obligatoire** : l'app doit être **déployée en ligne et accessible via un lien** (Vercel, Netlify, Render, etc. tous ont des plans gratuits)
- **Code sur GitHub** : repo public, avec un README clair

#### Livrables attendus

1. Un **lien vers l'application déployée** (qu'on peut tester en live)
2. Un **lien vers le repo GitHub** (code public)
3. Un **README** qui explique :
   - Les choix techniques et pourquoi
   - Comment lancer le projet en local
   - Les limites actuelles et ce que tu améliorerais avec plus de temps
4. Une **vidéo Loom (5-8 min max)** qui :
   - Montre l'application en action
   - Explique ton architecture et tes choix
   - Pitche comment tu pourrais l'intégrer à un produit comme Konsole
5. **Bonus (fortement apprécié)** : un **second Loom (3-5 min)** qui présente un **side project** que tu as fait (pro ou perso), avec la stack utilisée et ce que tu en as retiré.

#### Contraintes & infos pratiques

- **Temps à y consacrer** : 5 à 8 heures max. On préfère un MVP qui tourne à un projet ambitieux qui plante.
- **Coût** : 0 €. Tous les outils et hébergeurs proposés ont un plan gratuit suffisant.
- **Délai** : tu as **1 semaine** à partir de la réception de ce brief pour nous renvoyer le tout.
- **Restitution** : on planifiera un call de 45 min avec Kaio pour que tu présentes ton travail en live.

#### Ce qu'on va regarder

- **Ça tourne ou pas** : est-ce que ton app fonctionne vraiment en live, ou juste "en local chez moi" ?
- **Qualité du code** : structure, lisibilité, découpage logique, gestion des erreurs
- **Pertinence des choix techniques** : tu as choisi avec la tête ou par réflexe ?
- **Sens produit** : ce que tu affiches est-il vraiment utile pour un utilisateur Konsole ?
- **Le try hard** : est-ce que tu es allé au bout ou tu t'es arrêté au minimum ?
- **Communication** : est-ce que ton README et ton Loom expliquent clairement ce que tu as fait ?

#### Besoin d'aide ?

Si tu bloques sur un sujet, n'hésite pas à nous écrire. Tu ne seras pas pénalisé. On préfère un candidat qui pose les bonnes questions à un candidat qui galère en silence.

On a hâte de voir ce que tu nous livres.

Kaio
