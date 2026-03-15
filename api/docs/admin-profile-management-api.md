# Admin Profile & Management API

All routes below require:
- Admin auth middleware (`auth`, `role("admin")`)
- Base path: `/api/admin`
- `Authorization: Bearer <JWT>`

## Data Shape

Admin DTO:

```json
{
  "id": "65f0c0f0c0f0c0f0c0f0c0f0",
  "fullName": "Jane Admin",
  "email": "jane@example.com",
  "role": "admin",
  "createdAt": "2026-03-12T08:20:00.000Z",
  "updatedAt": "2026-03-12T08:30:00.000Z"
}
```

Success response shape:

```json
{
  "message": "Human readable message",
  "data": {}
}
```

Error response shape:

```json
{ "message": "Error message" }
```

## 1) Get Current Admin Profile

- Method: `GET`
- Path: `/profile`

Response `200`:

```json
{
  "message": "Admin profile retrieved",
  "data": {
    "admin": {
      "id": "65f0c0f0c0f0c0f0c0f0c0f0",
      "fullName": "Jane Admin",
      "email": "jane@example.com",
      "role": "admin",
      "createdAt": "2026-03-12T08:20:00.000Z",
      "updatedAt": "2026-03-12T08:30:00.000Z"
    }
  }
}
```

Errors:
- `404` if admin not found
- `401` if missing/invalid token
- `403` if not admin

## 2) Update Admin Name/Email

- Method: `PUT` or `PATCH`
- Path: `/profile`

Request (at least one field required):

```json
{
  "fullName": "Jane Administrator",
  "email": "jane.admin@example.com"
}
```

Response `200`:

```json
{
  "message": "Admin profile updated",
  "data": {
    "admin": {
      "id": "65f0c0f0c0f0c0f0c0f0c0f0",
      "fullName": "Jane Administrator",
      "email": "jane.admin@example.com",
      "role": "admin",
      "createdAt": "2026-03-12T08:20:00.000Z",
      "updatedAt": "2026-03-12T08:35:00.000Z"
    }
  }
}
```

Errors:
- `400` if neither `fullName` nor `email` is provided
- `409` if email already exists
- `404` if admin not found
- `401` if missing/invalid token
- `403` if not admin

## 3) Change Admin Password

- Method: `POST`
- Path: `/password`

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

Response `200`:

```json
{ "message": "Password updated successfully" }
```

Errors:
- `400` if required fields missing
- `400` if current password is incorrect
- `404` if admin not found
- `401` if missing/invalid token
- `403` if not admin

## 4) List Admins

- Method: `GET`
- Path: `/admins`

Response `200`:

```json
{
  "message": "Admins retrieved",
  "data": {
    "admins": [
      {
        "id": "65f0c0f0c0f0c0f0c0f0c0f0",
        "fullName": "Jane Admin",
        "email": "jane@example.com",
        "role": "admin",
        "createdAt": "2026-03-12T08:20:00.000Z",
        "updatedAt": "2026-03-12T08:30:00.000Z"
      }
    ]
  }
}
```

Errors:
- `401` if missing/invalid token
- `403` if not admin

## 5) Create Admin

- Method: `POST`
- Path: `/admins`

Request:

```json
{
  "fullName": "New Admin",
  "email": "new.admin@example.com",
  "password": "secure-password",
  "role": "admin"
}
```

Response `201`:

```json
{
  "message": "Admin created",
  "data": {
    "admin": {
      "id": "65f0c0f0c0f0c0f0c0f0c0f0",
      "fullName": "New Admin",
      "email": "new.admin@example.com",
      "role": "admin",
      "createdAt": "2026-03-12T08:20:00.000Z",
      "updatedAt": "2026-03-12T08:20:00.000Z"
    }
  }
}
```

Errors:
- `400` if required fields missing
- `400` if `role` is not `admin`
- `409` if email already exists
- `401` if missing/invalid token
- `403` if not admin
