const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const axios = require("axios"); // ✅ Import axios

// Multer Setup
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Register Supervisor
router.post("/register", async (req, res) => {
  try {
    const { lname, password, phone_number } = req.body;
    if (!lname || !password || !phone_number) {
      return res.status(400).json({ error: "❌ All fields are required." });
    }

    const existingSupervisor = await pool.query("SELECT * FROM supervisor WHERE lname = $1", [lname]);
    if (existingSupervisor.rows.length > 0) {
      return res.status(400).json({ error: "❌ Supervisor already exists." });
    }

    const newSupervisor = await pool.query(
      "INSERT INTO supervisor (lname, password, phone_number) VALUES ($1, $2, $3) RETURNING *",
      [lname, password, phone_number]
    );

    res.status(201).json({ message: "✅ Supervisor registered successfully", supervisor: newSupervisor.rows[0] });
  } catch (err) {
    console.error("Error registering supervisor:", err.message);
    res.status(500).json({ error: "❌ Internal server error" });
  }
});

// Get All Supervisors
router.get("/all", async (req, res) => {
  try {
    const supervisors = await pool.query("SELECT lname, phone_number, password FROM supervisor");
    res.json({ supervisors: supervisors.rows });
  } catch (err) {
    console.error("Error fetching supervisors:", err.message);
    res.status(500).json({ error: "❌ Internal server error" });
  }
});

// Remove Supervisor
// Remove Supervisor
router.delete("/remove/:phone_number", async (req, res) => {
  const client = await pool.connect();
  try {
    const { phone_number } = req.params;

    await client.query("BEGIN");

    // Get supervisor id
    const supervisorResult = await client.query(
      "SELECT id FROM supervisor WHERE phone_number = $1",
      [phone_number]
    );

    if (supervisorResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "❌ Supervisor not found" });
    }

    const supervisor_id = supervisorResult.rows[0].id;

    // Delete related alert_logs
    await client.query(
      "DELETE FROM alert_logs WHERE supervisor_id = $1",
      [supervisor_id]
    );

    // Delete supervisor
    await client.query(
      "DELETE FROM supervisor WHERE id = $1",
      [supervisor_id]
    );

    await client.query("COMMIT");

    res.json({ message: "✅ Supervisor removed successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error removing supervisor:", err.message);
    res.status(500).json({ error: "❌ Internal server error" });
  } finally {
    client.release();
  }
});

// Login Supervisor
router.post("/login", async (req, res) => {
  try {
    const { lname, password } = req.body;

    if (!lname || !password) {
      return res.status(400).json({ error: "❌ Please provide a username and password." });
    }

    const supervisor = await pool.query("SELECT * FROM supervisor WHERE lname = $1", [lname]);
    if (supervisor.rows.length === 0 || password !== supervisor.rows[0].password) {
      return res.status(401).json({ error: "❌ Invalid credentials" });
    }

    res.json({ success: true, userId: supervisor.rows[0].id, role: "supervisor" });
  } catch (err) {
    console.error("Error logging in supervisor:", err.message);
    res.status(500).json({ error: "❌ Internal server error" });
  }
});

// Upload Video
router.post("/upload", upload.single("video"), async (req, res) => {
  if (!req.file) {
    console.error("❌ No file uploaded.");
    return res.status(400).json({ error: "❌ No file uploaded" });
  }

  const { originalname, buffer } = req.file;

  try {
    const newVideo = await pool.query(
      "INSERT INTO videos (filename, filedata) VALUES ($1, $2) RETURNING id",
      [originalname, buffer]
    );

    console.log("✅ Video stored in DB with ID:", newVideo.rows[0].id);

    // ✅ Send video for real-time drowning detection
    console.log("📡 Sending video ID for detection:", newVideo.rows[0].id);
    await axios.post("https://drowning-flask.onrender.com/detect", {
      videoId: newVideo.rows[0].id
    });

    res.json({ message: "✅ Video uploaded successfully!", videoId: newVideo.rows[0].id });
  } catch (error) {
    console.error("❌ Database error:", error);
    res.status(500).json({ error: "❌ Database error" });
  }
});

// Fetch All Videos
router.get("/videos", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, filename, uploaded_at FROM videos ORDER BY uploaded_at DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching videos:", err.message);
    res.status(500).json({ error: "❌ Database error" });
  }
});

module.exports = router;
