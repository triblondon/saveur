Let's figure out how to add user authentication to this app.

Goal:

People can have their own recipes, and share them selectively with other users. Typically, when importing/creating a recipe it should be shared through a collection rather than setting recipe-level sharing permissions one-by-one.

Principles:

- Use email as username, but no verifiable email address or phone number is required.
- Enforce minimum password length but not complexity rules.
- Sessions last up to 30 days and are extended on user activity (sliding expiry).
- Session state is client-side.

Authentication and session approach:

- Use a stateless, signed session token in an `httpOnly`, `secure`, `sameSite=lax` cookie.
- Keep session state client-side by storing `user_id`, `issued_at`, and `expires_at` in the signed token payload.
- Validate token signature and expiry on every authenticated request.
- Refresh (re-issue) the cookie on authenticated activity to preserve sliding 30-day expiry.
- Expiry-only session invalidation is acceptable (no logout-all-devices or token revocation list in scope).
- Do not store session tokens in `localStorage` or other JS-readable storage.

Data relationships:

- New entity type: users
  - Users have name, email, and password hash (hashed/salted using modern best practice).
- New entity type: collections
  - Collections have name, description, visibility (`public` or `private`), and owner user.
  - Collections can have collaborators (non-owner users with full rights over recipes in that collection) and viewers (non-owner users with read-only rights).
  - Public collections can be viewed without login, but are direct-link only and should not be indexable by crawlers.
- Modify entity: recipe
  - Add `collection_id`.
  - Recipes belong to exactly one collection.
  - Use `created_by_user_id` (or repurpose current `owner_id`) as authorship/uploader metadata.

Authorization model:

- Collection owner:
  - Full recipe permissions in that collection.
  - Can edit collection metadata, visibility, membership, and delete the collection.
- Collection collaborator:
  - Same permissions as owner over recipes in that collection (create/edit/delete/import/move recipes).
  - Cannot edit collection metadata, visibility, membership, or delete the collection.
- Collection viewer:
  - Read-only access to recipes in private collections they are granted to.
- Anonymous user:
  - Read-only access to recipes in public collections, by direct link only.

Collection deletion rules:

- Only the collection owner can delete a collection.
- On delete, owner must choose one of:
  - Delete all recipes in the collection.
  - Reassign recipes to another collection where the owner has write access (owner or collaborator).
- Reassignment updates `collection_id` only; `created_by_user_id` remains unchanged.
- Delete/reassign should run transactionally so there is no partial move/delete state.

UI:

- Header:
  - If user is not logged in, hide app nav and show `Sign in or register` at top-right.
  - If user is authenticated, show `Collections`, `Recipes`, `Import recipe`, and a signed-in status indicator (person icon with user initials).
- Home page:
  - When logged out: show authentication-first landing experience (not a public collection index).
  - When logged in: tiled recipe cards grouped into collections, ordered as owner first, collaborator second, viewer third; show preview-sized subsets per collection.
- New sign in / register page:
  - Show registration form by default with link: `Already registered? Login`.
- New `Collections` list view:
  - List accessible collections with sharing summary and recipe count.
  - Sort by most recently updated (including recipe edits, sharing changes, and metadata edits).
  - Allow add/edit collection.
- New collection page:
  - Show collection name, sharing summary, add/import recipe action, and tiled recipe list.
  - If current user is owner, show controls for permissions and deletion.
  - If there are no recipes, include import UI to encourage first import.
- `Recipes` page:
  - Show all recipes across all collections the current user can access, mixed together.
- Update import / new recipe UI:
  - Add option to choose destination collection (or pre-populate when launched from a collection).
- Update existing recipe view:
  - Add linked collection name.

Non-goals / known gaps:

- No account recovery flow for now.
- No anti-abuse controls yet.
- No audit or version history on edits yet.
