# Cloudinary Image Upload API Documentation

## Overview

This backend uses Cloudinary for image storage and management. Images are uploaded through multipart/form-data requests and automatically processed by Cloudinary's CDN.

## Configuration

The backend is configured to:
- Store images in the `destinations` folder
- Accept only `jpg`, `png`, and `jpeg` formats
- Use Cloudinary's CDN for optimized delivery

## API Endpoints

### 1. Upload Images with Destination Creation

**Endpoint:** `POST /api/admin/destinations`
**Content-Type:** `multipart/form-data`

**Request Body:**
```javascript
// Form fields (regular JSON fields)
{
  "name": "Destination Name",
  "description": "Description text",
  "category": ["category1", "category2"],
  "features": {
    "category1": ["feature1", "feature2"]
  },
  "estimatedCost": 1000,
  "latitude": 14.5995,
  "longitude": 120.9842
}

// File field(s)
images: File[] // Multiple image files
```

**Response:**
```javascript
{
  "_id": "destination_id",
  "name": "Destination Name",
  "images": [
    {
      "url": "https://res.cloudinary.com/cloud_name/image/upload/v1234567890/destinations/public_id.jpg",
      "publicId": "destinations/public_id"
    }
  ],
  // ... other destination fields
}
```

### 2. Upload Additional Images to Existing Destination

**Endpoint:** `POST /api/admin/destinations/:id/images`
**Content-Type:** `multipart/form-data`

**Request Body:**
```javascript
// File field(s)
images: File[] // Multiple image files
```

**Response:**
```javascript
{
  "_id": "destination_id",
  "images": [
    // Existing images...
    {
      "url": "https://res.cloudinary.com/cloud_name/image/upload/v1234567890/destinations/new_public_id.jpg",
      "publicId": "destinations/new_public_id"
    }
  ]
}
```

### 3. Delete Destination Image

**Endpoint:** `DELETE /api/admin/destinations/:id/images/:imageIndex`

**Response:**
```javascript
{
  "_id": "destination_id",
  "images": [
    // Remaining images after deletion
  ]
}
```

## Frontend Implementation Guide

### 1. Image Upload Form

Use `FormData` for multipart uploads:

```javascript
const createDestination = async (formData, imageFiles) => {
  const data = new FormData();
  
  // Add all form fields
  Object.keys(formData).forEach(key => {
    if (typeof formData[key] === 'object') {
      data.append(key, JSON.stringify(formData[key]));
    } else {
      data.append(key, formData[key]);
    }
  });
  
  // Add image files
  imageFiles.forEach(file => {
    data.append('images', file);
  });
  
  try {
    const response = await fetch('/api/admin/destinations', {
      method: 'POST',
      body: data,
      headers: {
        'Authorization': `Bearer ${token}`
        // Note: Don't set Content-Type header - browser sets it automatically for FormData
      }
    });
    
    return await response.json();
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### 2. File Input Handling

```javascript
const handleImageUpload = (event) => {
  const files = Array.from(event.target.files);
  
  // Validate file types
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const validFiles = files.filter(file => validTypes.includes(file.type));
  
  if (validFiles.length !== files.length) {
    alert('Only JPG and PNG files are allowed');
  }
  
  // Validate file sizes (optional - Cloudinary has limits)
  const maxSize = 10 * 1024 * 1024; // 10MB
  const sizedFiles = validFiles.filter(file => file.size <= maxSize);
  
  return sizedFiles;
};
```

### 3. Displaying Images

Use the `url` field from the response:

```javascript
const DestinationGallery = ({ images }) => {
  return (
    <div className="image-gallery">
      {images.map((image, index) => (
        <img 
          key={index}
          src={image.url}
          alt={`Destination image ${index + 1}`}
          // Cloudinary provides automatic optimization
        />
      ))}
    </div>
  );
};
```

### 4. Image Deletion

```javascript
const deleteImage = async (destinationId, imageIndex) => {
  try {
    const response = await fetch(
      `/api/admin/destinations/${destinationId}/images/${imageIndex}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return await response.json();
  } catch (error) {
    console.error('Delete failed:', error);
  }
};
```

## Cloudinary Features Available

### 1. Automatic Optimization
Cloudinary automatically:
- Compresses images
- Converts to optimal formats
- Serves via global CDN
- Provides responsive delivery

### 2. URL Transformations
You can modify images on-the-fly by adding parameters to the URL:

```javascript
// Resize image
const resizedUrl = `${image.url}/w_300,h_200,c_fill`;

// Add watermark
const watermarkedUrl = `${image.url}/l_logo,w_100,g_south_east`;

// Apply filters
const filteredUrl = `${image.url}/e_grayscale`;
```

### 3. Responsive Images
```javascript
const ResponsiveImage = ({ image, sizes }) => {
  return (
    <img 
      srcSet={`
        ${image.url}/w_400 400w,
        ${image.url}/w_800 800w,
        ${image.url}/w_1200 1200w
      `}
      sizes={sizes}
      src={image.url}
      alt="Destination image"
    />
  );
};
```

## Error Handling

### Common Error Responses

```javascript
// No images uploaded
{
  "message": "No images uploaded"
}

// Invalid file format
{
  "message": "Invalid file format"
}

// File too large
{
  "message": "File size exceeds limit"
}

// Cloudinary error
{
  "message": "Image upload failed",
  "error": "Cloudinary error details"
}
```

### Frontend Error Handling

```javascript
const uploadImages = async (formData, files) => {
  try {
    const response = await createDestination(formData, files);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
  } catch (error) {
    // Handle network errors, timeouts, etc.
    console.error('Upload error:', error);
    throw error;
  }
};
```

## Best Practices

1. **File Validation**: Validate file types and sizes on the frontend before upload
2. **Progress Indicators**: Show upload progress for better UX
3. **Image Previews**: Display image previews before upload
4. **Error Recovery**: Implement retry logic for failed uploads
5. **Lazy Loading**: Use lazy loading for image galleries
6. **Responsive Images**: Use Cloudinary's URL transformations for responsive delivery

## Security Considerations

- All upload endpoints require authentication
- File types are restricted to images only
- Cloudinary provides built-in security features
- Images are stored in a dedicated folder structure
- Public IDs are generated automatically to prevent conflicts
