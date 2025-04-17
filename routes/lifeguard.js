const express = require("express");
const router = express.Router();
const pool = require("../db");

// ✅ Fetch the Most Recent Video (For Lifeguards)
router.get("/recent-video", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM detected_videos ORDER BY timestamp DESC LIMIT 1"
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "❌ No recent video found." });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error fetching recent video:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Process Video and Save Detected Results
router.post("/process-video", async (req, res) => {
    try {
        const { videoId } = req.body; // Assume video ID is sent in the request
        const detectedVideoPath = `/processed_videos/video_${videoId}_detected.mp4`; // Update path accordingly

        // Process the video with YOLO (pseudo-code)
        await runYOLODetection(videoId, detectedVideoPath);

        // Insert the detected video into the detected_videos table
        const timestamp = new Date();
        await pool.query(
            "INSERT INTO detected_videos (video_id, timestamp, detected_video_path) VALUES ($1, $2, $3)",
            [videoId, timestamp, detectedVideoPath]
        );

        res.status(200).send({ message: "✅ Video processed and saved!" });
    } catch (err) {
        console.error("❌ Error processing video:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Register Lifeguard
router.post("/register", async (req, res) => {
    try {
        const { lname, password, phone_number } = req.body;
        if (!lname || !password || !phone_number) {
            return res.status(400).json({ error: "❌ All fields are required." });
        }

        // Check if the lifeguard already exists
        const existingLifeguard = await pool.query("SELECT * FROM lifeguard WHERE lname = $1", [lname]);
        if (existingLifeguard.rows.length > 0) {
            return res.status(400).json({ error: "❌ Lifeguard already exists." });
        }

        // Store password as plain text (⚠️ Not secure)
        const newLifeguard = await pool.query(
            "INSERT INTO lifeguard (lname, password, phone_number) VALUES ($1, $2, $3) RETURNING *",
            [lname, password, phone_number]
        );

        res.status(201).json({ message: "✅ Lifeguard registered successfully", lifeguard: newLifeguard.rows[0] });
    } catch (err) {
        console.error("❌ Error registering lifeguard:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Get All Lifeguards
router.get("/all", async (req, res) => {
    try {
        const lifeguards = await pool.query("SELECT lname, phone_number, password FROM lifeguard"); // Exclude passwords
        res.json({ lifeguards: lifeguards.rows });
    } catch (err) {
        console.error("❌ Error fetching lifeguards:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Remove Lifeguard
router.delete("/remove/:phone_number", async (req, res) => {
    try {
        const { phone_number } = req.params;

        const deleteLifeguard = await pool.query(
            "DELETE FROM lifeguard WHERE phone_number = $1 RETURNING *",
            [phone_number]
        );

        if (deleteLifeguard.rowCount === 0) {
            return res.status(404).json({ error: "❌ Lifeguard not found" });
        }

        res.json({ message: "✅ Lifeguard removed successfully" });
    } catch (err) {
        console.error("❌ Error removing lifeguard:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Fetch Videos Assigned to Lifeguard
router.get("/videos/:lifeguardId", async (req, res) => {
    try {
        const { lifeguardId } = req.params;

        const assignedVideos = await pool.query(
            `SELECT videos.id, videos.filename 
             FROM alert_logs 
             JOIN videos ON alert_logs.video_id = videos.id 
             WHERE $1 = ANY(alert_logs.lifeguard_ids)`,
            [lifeguardId]
        );

        res.json({ videos: assignedVideos.rows });
    } catch (err) {
        console.error("❌ Error fetching assigned videos:", err);
        res.status(500).json({ error: "❌ Internal server error" });
    }
});

// ✅ Login Lifeguard
router.post("/login", async (req, res) => {
    try {
        const { lname, password } = req.body;

        if (!lname || !password) {
            return res.status(400).json({ success: false, error: "❌ Please provide a username and password." });
        }

        // Check if the lifeguard exists
        const lifeguard = await pool.query("SELECT id, lname, password FROM lifeguard WHERE lname = $1", [lname]);

        if (lifeguard.rows.length === 0) {
            return res.status(401).json({ success: false, error: "❌ Lifeguard not found" });
        }

        // Compare passwords directly (⚠️ Less secure)
        if (password !== lifeguard.rows[0].password) {
            return res.status(401).json({ success: false, error: "❌ Invalid credentials" });
        }

        // Send proper success response
        res.json({ 
            success: true, 
            userId: lifeguard.rows[0].id, 
            role: "lifeguard", 
            message: "✅ Login successful", 
            user: { lname: lifeguard.rows[0].lname } 
        });

    } catch (err) {
        console.error("❌ Error logging in lifeguard:", err);
        res.status(500).json({ success: false, error: "❌ Internal server error" });
    }
});

module.exports = router;
