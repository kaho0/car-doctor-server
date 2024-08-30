// Import necessary modules
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config(); // Load environment variables

// Initialize express app
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cookieParser());
app.use(express.json());

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"], // Allow these origins
    credentials: true, // Allow credentials such as cookies
  })
);

// MongoDB connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h997f.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Logger middleware
const logger = async (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

// JWT token verification middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("token is", token);
  if (!token) {
    return res.status(401).send({ message: "Not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

// Main function to run the app
async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Database and collection references
    const servicesCollection = client.db("cardoctor").collection("services");
    const bookingCollection = client.db("cardoctor").collection("bookings");

    // JWT token generation endpoint
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      try {
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "4h",
        });

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: false, // Set to true in production
            sameSite: "None", // Must be "None" if using cross-site cookies
          })
          .send({ success: true, token });
      } catch (error) {
        res
          .status(500)
          .send({ success: false, message: "Token generation failed" });
      }
    });
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });
    // Fetch all services
    app.get("/services", async (req, res) => {
      try {
        const cursor = servicesCollection.find();
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error fetching services", error });
      }
    });

    // Fetch service by ID
    app.get("/services/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid service ID format" });
      }
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, img: 1, service_id: 1 },
      };
      try {
        const result = await servicesCollection.findOne(query, options);
        if (result) {
          res.send(result);
        } else {
          res.status(404).send({ message: "Service not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Error fetching service", error });
      }
    });

    // Update a booking
    app.put("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid booking ID format" });
      }
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: updatedBooking,
      };
      try {
        const result = await bookingCollection.updateOne(query, update);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update booking", error });
      }
    });

    // Delete a booking
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid booking ID format" });
      }
      const query = { _id: new ObjectId(id) };
      try {
        const result = await bookingCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete booking", error });
      }
    });

    // Fetch bookings by serviceId or email
    app.get("/bookings", verifyToken, async (req, res) => {
      const { serviceId, email } = req.query;
      if (!serviceId && !email) {
        return res.status(400).send({ message: "Missing serviceId or email" });
      }

      let query = {};
      if (serviceId) {
        query.serviceId = serviceId;
      }
      if (email) {
        query.email = email;
      }

      try {
        const existingBookings = await bookingCollection.find(query).toArray();
        res.send(existingBookings);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch bookings", error });
      }
    });

    // Add a new booking
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      booking.dueAmount = parseFloat(booking.dueAmount);
      try {
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to book the service", error });
      }
    });

    // Confirm MongoDB connection
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

// Run the MongoDB connection function
run().catch(console.dir);

// Default route
app.get("/", (req, res) => {
  res.send("Running Car Doctor Server");
});

// Start the server
app.listen(port, () => {
  console.log(`Car Doctor server is running at http://localhost:${port}`);
});
