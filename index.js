const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config(); // Load environment variables

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.h997f.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server
    await client.connect();

    // Database and collection references
    const servicesCollection = client.db("cardoctor").collection("services");
    const bookingCollection = client.db("cardoctor").collection("bookings");

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

      // Validate the id to be a 24-character hex string
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid service ID format" });
      }

      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { title: 1, price: 1, img: 1, service_id: 1 }, // Adjust projection fields as needed
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
    app.put("/bookings/:id", async (req, res) => {
      const updatedBooking = req.body;
      console.log(updatedBooking);
    });
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });
    // Fetch bookings by serviceId or email
    app.get("/bookings", async (req, res) => {
      const { serviceId, email } = req.query;

      // Ensure at least one of the parameters is provided
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
        console.error("Error fetching bookings:", error);
        res.status(500).send({ message: "Failed to fetch bookings", error });
      }
    });

    // Add a new booking
    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      // Convert dueAmount to a number
      booking.dueAmount = parseFloat(booking.dueAmount);

      try {
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        console.error("Error inserting booking:", error);
        res.status(500).send({ message: "Failed to book the service", error });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    // Optional: Close the client when done
    // await client.close();
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
