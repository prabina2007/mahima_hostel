# Database Schema (MongoDB + JSON Fallback)

## users collection (`users`)

```json
{
  "id": "uuid",
  "studentName": "string",
  "email": "string (unique)",
  "phoneNumber": "string",
  "roomNumber": "string",
  "bed": "A | B",
  "rollNumber": "string",
  "passwordHash": "string (bcrypt hash)",
  "defaultPreference": "veg | non-veg",
  "approvalStatus": "pending | approved | rejected",
  "approvedAt": "ISO date | null",
  "rejectedAt": "ISO date | null",
  "adminMealOverride": {
    "lunch": "none | force-on | force-off",
    "dinner": "none | force-on | force-off"
  },
  "meals": {
    "YYYY-MM-DD": {
      "lunch": { "enabled": true, "type": "veg | non-veg", "adminLocked": false },
      "dinner": { "enabled": true, "type": "veg | non-veg", "adminLocked": false }
    }
  },
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Unique constraints:
- `email`
- combination of `roomNumber + bed`

## mealRates collection (`mealRates`)

```json
{
  "monthKey": "YYYY-MM",
  "rate": 0,
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

## representativeLogs collection (`representativeLogs`)

```json
{
  "dateKey": "YYYY-MM-DD",
  "entries": {},
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

Notes:
- MongoDB is the primary storage when `USE_MONGODB=true` and `MONGODB_URI` is valid.
- JSON fallback uses `backend/data/users.json`, `backend/data/mealRates.json`, and `backend/data/representativeLogs.json`.
