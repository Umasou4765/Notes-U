document.addEventListener('DOMContentLoaded', function () {
  // 1. Show a welcome alert
  alert("Welcome to UniNotes! Good luck with your studies 🎓");

  // 2. Study tips array
  const tips = [
    "Review your notes after every class.",
    "Teach someone else to test your understanding.",
    "Take regular breaks while studying.",
    "Organize your notes by subject and topic.",
    "Set specific study goals for each session.",
    "Don't cram – space out your learning.",
    "Practice with past exam papers.",
    "Use diagrams and mind maps.",
    "Ask questions if you don't understand something.",
    "Stay hydrated and get enough sleep!"
  ];

  // 3. Button and tip display
  const tipBtn = document.getElementById('tipBtn');
  const studyTip = document.getElementById('studyTip');

  if (tipBtn && studyTip) {
    tipBtn.addEventListener('click', function () {
      // Pick a random tip
      const randomIndex = Math.floor(Math.random() * tips.length);
      studyTip.textContent = tips[randomIndex];
    });
  }
});
