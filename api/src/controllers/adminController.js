// This controller manages admin operations for destinations
const Destination = require("../models/Destination");
const User = require("../models/User");
const Itinerary = require("../models/Itinerary");
const { normalizeFeatures } = require("../utils/normalizeFeatures");
const cloudinary = require("../config/cloudinary");
const {
  getRouteSummary,
  reverseGeocode
} = require("../services/openRouteService");

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

exports.createDestination = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      features, // array from frontend
      estimatedCost,
      latitude,
      longitude
    } = req.body;

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);

    if (parsedLatitude === null || parsedLongitude === null) {
      return res.status(400).json({
        message: "latitude and longitude are required numbers"
      });
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      return res.status(400).json({ message: "latitude must be between -90 and 90" });
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ message: "longitude must be between -180 and 180" });
    }

    const normalizedFeatures = normalizeFeatures(category, features);
    let resolvedAddress = null;

    if (process.env.OPENROUTESERVICE_API_KEY) {
      try {
        resolvedAddress = await reverseGeocode(parsedLongitude, parsedLatitude);
      } catch (orsErr) {
        return res.status(502).json({
          message: "OpenRouteService validation failed",
          details: orsErr.message
        });
      }
    }

    const uploadedImages = (req.files || []).map((file) => ({
      url: file.path || file.secure_url,
      publicId: file.filename || file.public_id
    }));

    const destination = await Destination.create({
      name,
      description,
      category,
      features: normalizedFeatures,
      estimatedCost,
      location: {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      },
      images: uploadedImages,
      isActive: true
    });

    res.status(201).json(destination);
  } catch (err) {
    console.error("Create destination error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// EDIT
exports.updateDestination = async (req, res) => {
  try {
    const updates = { ...req.body };

    const hasLatitude = Object.prototype.hasOwnProperty.call(updates, "latitude");
    const hasLongitude = Object.prototype.hasOwnProperty.call(updates, "longitude");

    if (hasLatitude || hasLongitude) {
      const parsedLatitude = parseCoordinate(updates.latitude);
      const parsedLongitude = parseCoordinate(updates.longitude);

      if (parsedLatitude === null || parsedLongitude === null) {
        return res.status(400).json({
          message: "latitude and longitude are required together as numbers"
        });
      }

      if (parsedLatitude < -90 || parsedLatitude > 90) {
        return res.status(400).json({ message: "latitude must be between -90 and 90" });
      }

      if (parsedLongitude < -180 || parsedLongitude > 180) {
        return res.status(400).json({ message: "longitude must be between -180 and 180" });
      }

      let resolvedAddress = null;
      if (process.env.OPENROUTESERVICE_API_KEY) {
        try {
          resolvedAddress = await reverseGeocode(parsedLongitude, parsedLatitude);
        } catch (orsErr) {
          return res.status(502).json({
            message: "OpenRouteService validation failed",
            details: orsErr.message
          });
        }
      }

      updates.location = {
        latitude: parsedLatitude,
        longitude: parsedLongitude,
        resolvedAddress
      };
      delete updates.latitude;
      delete updates.longitude;
    }

    const destination = await Destination.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    res.json(destination);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// SOFT DELETE (DEACTIVATE) destination
exports.deleteDestination = async (req, res) => {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    destination.isActive = false;
    await destination.save();

    res.json({ message: "Destination deactivated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllDestinationsAdmin = async (req, res) => {
  try {
    const destinations = await Destination.find(); // includes inactive
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllItineraries = async (_req, res) => {
  try {
    const itineraries = await Itinerary.find()
      .populate("user", "name email")
      .populate("destinations.destination", "name");

    res.json(itineraries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.uploadDestinationImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const uploadedImages = req.files.map((file) => ({
      url: file.path || file.secure_url,
      publicId: file.filename || file.public_id
    }));

    const destination = await Destination.findByIdAndUpdate(
      id,
      { $push: { images: { $each: uploadedImages } } },
      { new: true }
    );

    res.json(destination);
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: "Image upload failed" });
  }
};



exports.deleteDestinationImage = async (req, res) => {
  const { id, imageIndex } = req.params;

  const destination = await Destination.findById(id);

  const image = destination.images[imageIndex];

  await cloudinary.uploader.destroy(image.publicId);

  destination.images.splice(imageIndex, 1);

  await destination.save();

  res.json(destination);
};

exports.getRoutePreview = async (req, res) => {
  try {
    const {
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
      profile
    } = req.body;

    const parsedStartLatitude = parseCoordinate(startLatitude);
    const parsedStartLongitude = parseCoordinate(startLongitude);
    const parsedEndLatitude = parseCoordinate(endLatitude);
    const parsedEndLongitude = parseCoordinate(endLongitude);

    if (
      parsedStartLatitude === null ||
      parsedStartLongitude === null ||
      parsedEndLatitude === null ||
      parsedEndLongitude === null
    ) {
      return res.status(400).json({
        message: "start/end latitude and longitude are required numbers"
      });
    }

    const route = await getRouteSummary({
      startLatitude: parsedStartLatitude,
      startLongitude: parsedStartLongitude,
      endLatitude: parsedEndLatitude,
      endLongitude: parsedEndLongitude,
      profile
    });

    res.json(route);
  } catch (err) {
    console.error("Route preview error:", err);
    res.status(502).json({
      message: "OpenRouteService route fetch failed",
      details: err.message
    });
  }
};

