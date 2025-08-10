function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}
function passwordPolicy(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  return null;
}
module.exports = { isValidEmail, passwordPolicy };