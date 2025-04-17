require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io"); // Use Socket.IO's latest syntax
const axios = require("axios");
const pool = require("./db"); // Ensure the `db` file exists and is correctly set up
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5001" ,"https://frontend-mtkt.onrender.com"], // Allowed origins
    methods: ["GET", "POST"], // Allowed methods
  },
});

const PORT = process.env.PORT || 4050;

// CORS Middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5001"], // Allowed origins
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    credentials: true,
  })
);

// Middleware for JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use routes
const lifeguardRoutes = require("./routes/lifeguard"); // Ensure this file exists
const supervisorRoutes = require("./routes/supervisor"); // Ensure this file exists

app.use("/lifeguard", lifeguardRoutes);
app.use("/supervisor", supervisorRoutes);

// WebSocket Setup
io.on("connection", (socket) => {
  console.log("✅ Supervisor connected via WebSocket");

  // Listen for alerts from supervisors
  socket.on("sendAlert", (data) => {
    console.log("📡 Sending alert to lifeguards:", data);
    io.emit("lifeguardAlert", data);
    io.emit("updateAlertLogs");
  });

  socket.on("disconnect", () => {
    console.log("❌ Supervisor disconnected");
  });
});

// Video Stream Route
app.get("/video-stream", (req, res) => {
  res.redirect("http://127.0.0.1:5001/detect-stream");
});

// Detect Drowning Endpoint
app.post("/detect-drowning", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId || !/^\d+$/.test(videoId)) {
    return res.status(400).json({ error: "❌ Invalid video ID" });
  }

  try {
    const result = await pool.query("SELECT filedata FROM videos WHERE id = $1", [videoId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Video not found" });
    }

    const videoBuffer = result.rows[0].filedata;

    // Simulate form data without extra libraries
    const formData = {
      video_file: videoBuffer,
    };

    const response = await axios.post("http://127.0.0.1:5001/detect", formData);

    if (response.data.drowning_detected) {
      io.emit("drowningAlert", { videoId });
    }

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error calling Flask:", error);
    res.status(500).json({ error: "❌ Detection failed" });
  }
});

// Fetch Processed Video
app.get("/processed-video/:videoId", async (req, res) => {
  const { videoId } = req.params;
  const processedVideoPath = path.join(__dirname, "processed", `output_${videoId}.mp4`);

  if (!fs.existsSync(processedVideoPath)) {
    return res.status(404).json({ error: "❌ Processed video not found" });
  }

  res.sendFile(processedVideoPath);
});

// Test Database Connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ message: "✅ Database connected!", time: result.rows[0].now });
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    res.status(500).json({ error: "❌ Database connection failed" });
  }
});

// Fetch Videos Metadata
app.get("/videos", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, filename, uploaded_at FROM videos ORDER BY uploaded_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching videos:", error);
    res.status(500).json({ error: "❌ Database error" });
  }
});

// Stream Specific Video
app.get("/videos/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT filename, filedata FROM videos WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ Video not found" });
    }

    const video = result.rows[0];
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename=${video.filename}`);
    res.send(video.filedata);
  } catch (error) {
    console.error("❌ Error retrieving video:", error);
    res.status(500).json({ error: "❌ Database error" });
  }
});

// Health Check
app.get("/", (req, res) => {
  res.json({ message: "🚀 Server is running!" });
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
