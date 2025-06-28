// server.js
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;

const app = express();

app.use(session({ secret: "your-secret", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: "Ov23liequoOA8QGMvJGT", // <-- PASTE YOUR CLIENT ID HERE
    clientSecret: "288d524be31e7b0a92811e6414a604d51a8f0bf1", // <-- PASTE YOUR CLIENT SECRET HERE
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // This is where you'd handle saving or retrieving user data from your database.
    // For now, we'll just pass the profile directly.
    return done(null, profile);
  }
));

// Route to initiate GitHub authentication
app.get("/auth/github", passport.authenticate("github", { scope: [ "user:email" ] }));

// GitHub will redirect to this URL after authentication
app.get("/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login.html" }),
  (req, res) => {
    // Successful authentication, redirect to your dashboard or a success page.
    console.log("GitHub login successful for user:", req.user.username);
    res.redirect("/dashboard.html"); // Redirect to your success page
  });

// Add a route to serve static files (like your index.html, signup.html, login.html, dashboard.html)
// Make sure your HTML files are in a directory named 'public' (or adjust the path if they are elsewhere)
app.use(express.static("public")); 

app.listen(3000, () => console.log("Server started at http://localhost:3000"));
