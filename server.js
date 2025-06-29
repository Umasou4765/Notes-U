Require("dotenv").config(); // Load .env file contents

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const path = require("path");

const app = express();

// Session Setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'a_strong_default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport User Serialization & Deserialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// GitHub OAuth Strategy Configuration
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(`GitHub Profile: ${profile.username} (ID: ${profile.id})`);
    return done(null, profile);
  }
));

// --- Authentication Routes ---

// Initiate GitHub login/signup
app.get("/auth/github", passport.authenticate("github", { scope: ["user:email"] }));

// GitHub callback route
app.get("/auth/github/callback",
  passport.authenticate("github", {
    failureRedirect: "/login.html",
    failureFlash: true
  }),
  (req, res) => {
    console.log(`GitHub login successful for user: ${req.user.username}`);
    res.redirect("/dashboard.html");
  }
);

// --- API Routes ---

// Get current logged-in user information
app.get("/api/user", (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: "Unauthorized: User not logged in." });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error logging out.");
    }
    console.log("User logged out successfully.");
    res.redirect("/login.html");
  });
});

// --- Static File Serving ---
app.use(express.static(path.join(__dirname, "public")));

// Catch-all route, redirects to home.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// --- Server Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server started at http://localhost:${PORT}`);
  console.log(`Open your browser to http://localhost:${PORT}/login.html`);
});
