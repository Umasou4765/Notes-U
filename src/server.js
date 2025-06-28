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
    // In a real application, you would typically serialize a unique identifier for the user
    // (e.g., user.id from your database) rather than the entire profile object.
    done(null, user);
});
passport.deserializeUser((obj, done) => {
    // In a real application, you would fetch the user from your database using the ID
    // serialized above.
    done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: "YOUR_GITHUB_CLIENT_ID", // <--- PASTE YOUR CLIENT ID HERE
    clientSecret: "YOUR_GITHUB_CLIENT_SECRET", // <--- PASTE YOUR CLIENT SECRET HERE
    callbackURL: "http://localhost:3000/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // This function is called after GitHub successfully authenticates the user.
    // 'profile' contains user information from GitHub.
    // Here, you would typically:
    // 1. Check if the user (profile.id or profile.username) already exists in your database.
    // 2. If they exist, log them in.
    // 3. If not, create a new user record in your database using 'profile' data.
    // 4. Call `done(null, user)` where `user` is the user object from your database.
    
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
    // req.user will contain the user object (the 'profile' from the strategy callback)
    console.log("GitHub login successful for user:", req.user.username);
    res.redirect("/dashboard.html"); // Redirect to your success page
  });

// Add a route to serve static files (like your index.html, signup.html, login.html, dashboard.html)
app.use(express.static("public")); // Assuming your HTML files are in a 'public' directory

app.listen(3000, () => console.log("Server started at http://localhost:3000"));
