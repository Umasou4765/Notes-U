// src/app.js

// Ensure the DOM is loaded before accessing elements
document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', function(e) {
      e.preventDefault();
      // You can change this message as needed
      alert("🚧 Upload feature is under development. Please check back soon!");
    });
  } else {
    console.error("Upload form with ID 'uploadForm' not found.");
  }
});
