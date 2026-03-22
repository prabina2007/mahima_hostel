# Database Schema (MongoDB + JSON Fallback)

## users collection (`users`)

```json
{
  "id": "uuid",
  "studentName": "string",
  "email": "string (unique)",
  "roomNumber": "string",
  "bed": "A | B",
  "rollNumber": "string",
  "passwordHash": "string (bcrypt hash)",
  "defaultPreference": "veg | non-veg",
  "meals": {
    "YYYY-MM-DD": {
      "lunch": { "enabled": true, "type": "veg | non-veg" },
      "dinner": { "enabled": true, "type": "veg | non-veg" }
    }
  },
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Unique constraints:
- `email`
- combination of `roomNumber + bed`

## otps collection (`otps`)

```json
{
  "id": "uuid",
  "email": "string",
  "codeHash": "string",
  "expiresAt": "ISO date",
  "used": false,
  "createdAt": "ISO date"
}
```

Notes:
- MongoDB is the primary storage when `USE_MONGODB=true` and `MONGODB_URI` is valid.
- JSON fallback uses `backend/data/users.json` and `backend/data/otps.json`.
