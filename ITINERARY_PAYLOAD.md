# Itinerary Generation API Payload

## Updated Payload for Mapbox Integration

### Endpoint: `POST /api/itineraries/generate`

The payload has been enhanced to support distance-based sorting using Mapbox APIs.

## 📋 Expected Payload

### **Basic Payload (Original functionality)**
```json
{
  "maxBudget": 5000,
  "days": 3
}
```

### **Enhanced Payload (With distance-based sorting)**
```json
{
  "maxBudget": 5000,
  "days": 3,
  "userLongitude": 120.9842,
  "userLatitude": 14.5995
}
```

## 📝 Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `maxBudget` | Number | ✅ Yes | Maximum budget for the itinerary |
| `days` | Number | ❌ No | Number of days for the itinerary (optional) |
| `userLongitude` | Number | ❌ No | User's current longitude (for distance sorting) |
| `userLatitude` | Number | ❌ No | User's current latitude (for distance sorting) |

## 🎯 Behavior Changes

### **Without Location Data**
- Uses original hybrid recommendation algorithm
- Destinations ordered by recommendation scores only
- No distance calculations performed

### **With Location Data**
- Applies distance-based sorting to recommendations
- Destinations ordered from nearest → farthest
- Includes `distanceFromUser` and `durationFromUser` in response
- Requires `MAPBOX_SERVER_TOKEN` environment variable

## 📤 Response Format

### **Enhanced Response (with location)**
```json
{
  "_id": "itinerary_id",
  "user": "user_id",
  "destinations": [
    {
      "destination": "destination_id",
      "cost": 1500,
      "hybridScore": 0.85,
      "distanceFromUser": 2500,
      "durationFromUser": 300
    }
  ],
  "days": 3,
  "dayPlans": [...],
  "totalCost": 4500,
  "maxBudget": 5000,
  "budgetMode": "constrained",
  "isSaved": true,
  "createdAt": "2024-03-02T08:00:00.000Z",
  "updatedAt": "2024-03-02T08:00:00.000Z"
}
```

### **Original Response (without location)**
```json
{
  "_id": "itinerary_id",
  "user": "user_id", 
  "destinations": [
    {
      "destination": "destination_id",
      "cost": 1500,
      "hybridScore": 0.85
    }
  ],
  "days": 3,
  "dayPlans": [...],
  "totalCost": 4500,
  "maxBudget": 5000,
  "budgetMode": "constrained",
  "isSaved": true,
  "createdAt": "2024-03-02T08:00:00.000Z",
  "updatedAt": "2024-03-02T08:00:00.000Z"
}
```

## 🔄 Backward Compatibility

✅ **Fully Backward Compatible**
- Existing payloads without location data work unchanged
- New location fields are optional
- Response includes additional fields only when location is provided

## 🚨 Error Handling

### **Missing Required Fields**
```json
{
  "message": "maxBudget is required"
}
```

### **Invalid Days**
```json
{
  "message": "days must be a positive integer"
}
```

### **Mapbox Service Unavailable** (when location provided)
```json
{
  "message": "Server error"
}
```

## 💡 Usage Examples

### **Frontend Implementation**
```javascript
// Without location (original behavior)
const response = await fetch('/api/itineraries/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    maxBudget: 5000,
    days: 3
  })
});

// With location (distance-based sorting)
const response = await fetch('/api/itineraries/generate', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    maxBudget: 5000,
    days: 3,
    userLongitude: 120.9842,
    userLatitude: 14.5995
  })
});
```

### **Getting User Location**
```javascript
// Get user's current location
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { longitude, latitude } = position.coords;
    // Use coordinates in itinerary generation
  },
  (error) => {
    console.error('Location access denied:', error);
    // Fallback to original behavior without location
  }
);
```
