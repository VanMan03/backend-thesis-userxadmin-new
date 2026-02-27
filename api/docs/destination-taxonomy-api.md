# Destination Taxonomy API (Admin)

All routes below require:
- Admin auth middleware (`auth`, `role("admin")`)
- Base path: `/api/admin`

## Data Shape

`validFeatures` is an object map:

```json
{
  "Nature Tourism": ["Eco-Tours", "Wilderness Trekking"],
  "Cultural Tourism": ["Heritage Tours", "Food Tourism"]
}
```

Notes:
- Category names and feature names are trimmed strings.
- Empty categories or empty feature arrays are rejected.
- URL path params (`:category`, `:feature`) must be URL-encoded by the client.

## 1) Get Taxonomy

- Method: `GET`
- Path: `/destination-taxonomy`

Response `200`:

```json
{
  "key": "default",
  "validFeatures": {
    "Nature Tourism": ["Eco-Tours", "Wilderness Trekking"]
  },
  "updatedAt": "2026-02-27T08:20:00.000Z"
}
```

## 2) Replace Full Taxonomy

- Method: `PUT`
- Path: `/destination-taxonomy`
- Body: either raw map or wrapped with `validFeatures`

Example request (wrapped):

```json
{
  "validFeatures": {
    "Nature Tourism": ["Eco-Tours", "Volcanic Sites"],
    "Adventure Tourism": ["Zipline", "ATV Trails"]
  }
}
```

Example request (raw map):

```json
{
  "Nature Tourism": ["Eco-Tours", "Volcanic Sites"],
  "Adventure Tourism": ["Zipline", "ATV Trails"]
}
```

Response `200`:

```json
{
  "key": "default",
  "validFeatures": {
    "Nature Tourism": ["Eco-Tours", "Volcanic Sites"],
    "Adventure Tourism": ["Zipline", "ATV Trails"]
  },
  "updatedAt": "2026-02-27T08:22:00.000Z"
}
```

Error `400`:

```json
{ "message": "validFeatures must include at least one category with at least one feature" }
```

## 3) Create Category

- Method: `POST`
- Path: `/destination-taxonomy/categories`

Request:

```json
{
  "category": "Adventure Tourism",
  "features": ["Zipline", "ATV Trails"]
}
```

Responses:
- `201` created
- `409` if category already exists
- `400` if invalid payload

## 4) Update Category (rename and/or replace features)

- Method: `PUT`
- Path: `/destination-taxonomy/categories/:category`

Request examples:

Rename only:

```json
{ "category": "Extreme Adventure" }
```

Replace features only:

```json
{ "features": ["Rock Climbing", "Canyoneering"] }
```

Rename + replace features:

```json
{
  "category": "Extreme Adventure",
  "features": ["Rock Climbing", "Canyoneering"]
}
```

Responses:
- `200` updated
- `404` category not found
- `409` target category already exists
- `400` invalid payload

## 5) Delete Category

- Method: `DELETE`
- Path: `/destination-taxonomy/categories/:category`

Responses:
- `200` deleted
- `404` category not found
- `400` if deleting would leave zero categories

## 6) Create Feature in Category

- Method: `POST`
- Path: `/destination-taxonomy/categories/:category/features`

Request:

```json
{ "feature": "Paragliding" }
```

Responses:
- `201` created
- `404` category not found
- `409` feature already exists
- `400` invalid payload

## 7) Update Feature in Category

- Method: `PUT`
- Path: `/destination-taxonomy/categories/:category/features/:feature`

Request:

```json
{ "feature": "Advanced Paragliding" }
```

Responses:
- `200` updated
- `404` category or feature not found
- `409` target feature already exists
- `400` invalid payload

## 8) Delete Feature in Category

- Method: `DELETE`
- Path: `/destination-taxonomy/categories/:category/features/:feature`

Responses:
- `200` deleted
- `404` category or feature not found
- `400` if deleting would leave zero features in that category

## Destination Create/Update Integration

The destination endpoints now validate against the taxonomy above:
- `POST /api/admin/destinations`
- `PUT /api/admin/destinations/:id`

Validation behavior:
- Category must exist in taxonomy.
- Features must be valid for selected category.
- Invalid category/feature input is rejected with `400`.
