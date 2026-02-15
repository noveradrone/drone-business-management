# Drone Business Management App

Application complète de gestion d’entreprise de drone.

## Stack technique
- Backend: Node.js + Express
- Base de données: SQLite (via `better-sqlite3`)
- Frontend: React (Vite)
- Fichiers: stockage local (URL de photos stockée en base)
- Exports: CSV + PDF

## Structure
- `/Users/ozturk/Documents/New project/drone-business-management/backend`: API REST + DB + exports
- `/Users/ozturk/Documents/New project/drone-business-management/frontend`: application React

## Démarrage rapide

### 1) Backend
```bash
cd /Users/ozturk/Documents/New\ project/drone-business-management/backend
npm install
npm run dev
```
API disponible sur `http://localhost:4000/api`.

Compte par défaut créé au bootstrap:
- Email: `admin@drone.local`
- Password: `admin123`

### 2) Frontend
```bash
cd /Users/ozturk/Documents/New\ project/drone-business-management/frontend
npm install
npm run dev
```
UI disponible sur `http://localhost:5173`.

Si nécessaire, définir `VITE_API_BASE` dans un `.env` côté frontend.

---

## Schéma base de données

### `users`
- `id` (PK)
- `name`
- `email` (unique)
- `password_hash`
- `role` (`admin|manager|pilot|accounting`)
- `created_at`

### `drones`
- `id` (PK)
- `brand`, `model`
- `serial_number` (unique)
- `status` (`active|maintenance|grounded|retired`)
- `purchase_date`, `purchase_price`
- `total_flight_hours`, `total_cycles`
- `notes`, `created_at`

### `maintenance_records`
- `id` (PK)
- `drone_id` (FK -> drones)
- `maintenance_date`, `maintenance_type`
- `description`, `parts_replaced`
- `flight_hours_at_maintenance`, `cycles_at_maintenance`
- `cost`, `next_due_date`, `created_at`

### `clients`
- `id` (PK)
- `company_name`
- `contact_name`, `email`, `phone`
- `billing_address`, `notes`, `created_at`

### `missions`
- `id` (PK)
- `drone_id` (FK -> drones)
- `client_id` (FK -> clients)
- `mission_date`, `location`, `duration_minutes`
- `flight_hours_logged`, `cycles_logged`
- `photo_url`, `notes`, `created_at`

### `quotes`
- `id` (PK)
- `client_id` (FK -> clients)
- `quote_number` (unique)
- `quote_date`, `valid_until`
- `status` (`draft|sent|accepted|rejected|expired`)
- `subtotal`, `tax_rate`, `total`
- `notes`, `created_at`

### `quote_items`
- `id` (PK)
- `quote_id` (FK -> quotes)
- `description`, `quantity`, `unit_price`, `total`

### `invoices`
- `id` (PK)
- `client_id` (FK -> clients)
- `mission_id` (FK -> missions, optionnel)
- `quote_id` (FK -> quotes, optionnel)
- `invoice_number` (unique)
- `invoice_date`, `due_date`
- `status` (`draft|sent|partial|paid|overdue|cancelled`)
- `subtotal`, `tax_rate`, `total`, `amount_received`
- `currency`, `notes`, `created_at`

### `invoice_items`
- `id` (PK)
- `invoice_id` (FK -> invoices)
- `description`, `quantity`, `unit_price`, `total`

### `payments`
- `id` (PK)
- `invoice_id` (FK -> invoices)
- `payment_date`, `amount`
- `method`, `reference`, `notes`, `created_at`

### `insurances`
- `id` (PK)
- `provider`
- `policy_number` (unique)
- `coverage_details`
- `insured_entity_type` (`company|drone`)
- `insured_entity_id`
- `valid_from`, `valid_until`
- `premium_amount`, `notes`, `created_at`

### `reminders`
- `id` (PK)
- `reminder_type` (`invoice_overdue|insurance_expiry|maintenance_due`)
- `target_id`, `due_date`
- `status` (`pending|sent|dismissed`)
- `message`, `created_at`

---

## API REST documentée

Base URL: `http://localhost:4000/api`

Authentification: header `Authorization: Bearer <token>` pour toutes les routes protégées.

### Auth
- `POST /auth/register`
  - Body: `{ name, email, password, role? }`
  - Retour: utilisateur créé
- `POST /auth/login`
  - Body: `{ email, password }`
  - Retour: `{ token, user }`
- `GET /auth/me`
  - Retour: profil utilisateur connecté

### Utilisateurs
- `GET /users` (admin)
  - Retour: liste des utilisateurs

### Drones
- `GET /drones`
- `GET /drones/:id`
- `POST /drones`
  - Body: `{ brand, model, serial_number, status?, purchase_date?, purchase_price?, notes? }`
- `PUT /drones/:id`
- `DELETE /drones/:id`

### Maintenance / usure
- `GET /maintenance`
- `POST /maintenance`
  - Body: `{ drone_id, maintenance_date, maintenance_type, description?, parts_replaced?, flight_hours_at_maintenance?, cycles_at_maintenance?, cost?, next_due_date? }`
  - Effets: mise à jour cumul heures/cycles du drone + rappels

### Clients
- `GET /clients`
- `POST /clients`
  - Body: `{ company_name, contact_name?, email?, phone?, billing_address?, siret?, vat_number?, notes? }`
- `PUT /clients/:id`

### Missions / vols
- `GET /missions`
- `POST /missions`
  - Body: `{ drone_id, client_id, mission_date, location, duration_minutes, flight_hours_logged?, cycles_logged?, photo_url?, notes? }`
  - Effets: incrément heures/cycles drone

### Devis
- `GET /quotes`
- `GET /quotes/:id`
- `POST /quotes`
  - Body: `{ client_id, quote_number, quote_date, valid_until?, status?, tax_rate?, notes?, items: [{ description, quantity, unit_price }] }`
- `GET /quotes/:id/pdf`
  - Retour: PDF de devis avec mentions légales configurables

### Factures & paiements
- `GET /invoices`
- `GET /invoices/:id`
- `POST /invoices`
  - Body: `{ client_id, mission_id?, quote_id?, invoice_number, invoice_date, due_date, status?, tax_rate?, currency?, notes?, items: [{ description, quantity, unit_price }] }`
- `POST /invoices/:id/payments`
  - Body: `{ payment_date, amount, method?, reference?, notes? }`
  - Effets: recalcul `amount_received` et statut (`partial|paid|overdue`)
- `GET /invoices/:id/payments/:paymentId/receipt-pdf`
  - Retour: reçu PDF de paiement (preuve d'encaissement)
- `GET /invoices/:id/pdf`
  - Retour: PDF de facture avec mentions légales configurables

### Paramètres entreprise (logo + identité légale)
- `GET /settings/company`
  - Retour: profil entreprise utilisé dans les PDFs
- `PUT /settings/company`
  - Body: `{ company_name, legal_form, capital_amount, address_line1, zip_code, city, country, siret, vat_number, rcs_info, phone, email, website, bank_name, bank_bic, bank_iban, logo_data_url, payment_terms, late_penalty_rate, fixed_indemnity, vat_exemption_mention, quote_validity_days }`

### Assurance
- `GET /insurances`
- `POST /insurances`
  - Body: `{ provider, policy_number, coverage_details?, insured_entity_type, insured_entity_id?, valid_from, valid_until, premium_amount?, notes? }`
  - Effets: génération rappels expiration

### Dashboard / notifications
- `GET /dashboard/summary`
  - Retour: KPI drones, missions, clients, factures ouvertes, encaissements, rappels, top drones, cashflow
- `GET /dashboard/reminders`
  - Retour: rappels automatiques en attente

### Export CSV
- `GET /exports/csv/:entity`
  - `entity` possible: `drones|clients|missions|invoices|insurances|maintenance|payments`
  - Retour: fichier CSV

---

## Scripts d’export

### CSV batch (backend)
```bash
cd /Users/ozturk/Documents/New\ project/drone-business-management/backend
npm run export:reports
```
Génère des CSV dans `/Users/ozturk/Documents/New project/drone-business-management/backend/exports`.

### PDF
- Endpoint: `GET /api/invoices/:id/pdf`
- Endpoint: `GET /api/quotes/:id/pdf`

---

## UI React (écrans principaux)

### `LoginPage`
- Authentification utilisateur
- Stockage du JWT (`localStorage`)

### `DashboardPage`
- Vue récapitulative KPI
- Top drones par heures de vol

### `DronesPage`
- Liste drones
- Formulaire d’ajout drone

### `ClientsPage`
- Liste clients
- Formulaire d’ajout client

### `MissionsPage`
- Liste + création de mission

### `QuotesPage`
- Liste + création de devis
- Téléchargement PDF de devis

### `InvoicesPage`
- Liste + création de facture
- Téléchargement PDF de facture
- Enregistrement de paiements partiels/total
- Reste à payer recalculé automatiquement
- Reçu PDF par paiement
- KPI finance + filtres de recherche/statut

### `InsurancesPage`
- Liste + création contrats assurance

### `ExportsPage`
- Téléchargement CSV par entité

### `SettingsPage`
- Paramétrage identité entreprise (`Novera Drone`)
- Upload logo (base64) pour les PDFs
- Champs légaux FR (SIRET, TVA, pénalités, indemnité, etc.)

### `Layout`
- Navigation globale entre modules

---

## Option notifications push (extension)
Non activé par défaut. Points d’intégration recommandés:
- Backend: service worker push (Web Push) ou FCM
- Frontend: abonnement push + affichage rappels
- Déclencheur: `refreshAutomaticReminders()` + cron

---

## Déploiement 24/7 (Render)

Le repo contient un blueprint Render:
- `/Users/ozturk/Documents/New project/drone-business-management/render.yaml`

### Étapes
1. Push ce dossier sur GitHub.
2. Dans Render: `New` -> `Blueprint` -> sélectionne le repo.
3. Render crée:
- `novera-drone-api` (backend Node)
- `novera-drone-web` (frontend static)
4. Vérifie l’URL backend réelle (ex: `https://novera-drone-api.onrender.com/api`).
5. Si nécessaire, mets à jour `VITE_API_BASE` dans le service frontend puis redeploy.

### Persistance base de données
- Le backend est configuré avec `DB_PATH=/var/data/drone-business.db` + disque Render monté sur `/var/data`.
- Important: choisis un plan supportant les disques persistants (sinon la DB SQLite sera perdue au redémarrage).

### Variables importantes
- `JWT_SECRET` (généré automatiquement dans le blueprint)
- `DB_PATH` (déjà configuré)
- `VITE_API_BASE` (URL de ton backend)
