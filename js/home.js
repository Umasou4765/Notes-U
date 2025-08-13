import { fetchNotes, getUser, logout } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('logout-btn');
  const categoryLinks = document.querySelectorAll('.category-list a');
  const notesContainer = document.getElementById('notes-container');
  const searchInput = document.getElementById('searchInput');

  let allNotesData = [];
  let activeCategory = 'all';

  logoutButton?.addEventListener('click', async () => {
    try {
      await logout();
      window.location.href = '/auth.html?mode=login';
    } catch {
      alert('Failed to log out.');
    }
  });

  async function verifyUser(){
    try {
      await getUser(); // Will 401 if not logged in
    } catch {
      window.location.href = '/auth.html?mode=login';
    }
  }

  async function loadNotes(){
    try {
      allNotesData = await fetchNotes();
      renderFiltered();
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      notesContainer.innerHTML = `
        <div class="note-card" data-category="error">
          <h3>Error Loading Notes</h3>
          <p>${err.message || 'There was a problem loading your notes.'}</p>
          <div class="tags">
            <span class="category-tag">Error</span>
          </div>
          <div class="note-actions">
            <a href="#" onclick="window.location.reload();return false;">Reload Page</a>
          </div>
        </div>`;
    }
  }

  function renderNotes(list){
    notesContainer.innerHTML = '';
    if(list.length === 0){
      notesContainer.innerHTML = `
        <div class="note-card" data-category="placeholder-note">
          <h3>No Notes Found</h3>
          <p>It looks like there are no notes available for this category yet. Upload some notes to get started!</p>
          <div class="tags">
            <span class="category-tag">Information</span>
            <span class="category-tag">Get Started</span>
          </div>
          <div class="note-actions">
            <a href="upload.html">Upload Now</a>
          </div>
        </div>`;
      return;
    }
    list.forEach(note => {
      const el = document.createElement('div');
      el.className = 'note-card';
      el.dataset.category = note.subject_code;

      const notesTypeDisplay = note.notes_type
        ? note.notes_type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
        : 'Note';

      el.innerHTML = `
        <h3>${escapeHtml(note.title)}</h3>
        <p>${escapeHtml(note.description || 'No description provided.')}</p>
        <div class="tags">
          <span class="category-tag">${escapeHtml(note.academic_year.replace('year','Year '))}</span>
          <span class="category-tag">${escapeHtml(note.semester.replace('semester','Semester '))}</span>
          <span class="category-tag">${escapeHtml(note.subject_code)}</span>
          <span class="category-tag">${escapeHtml(notesTypeDisplay)}</span>
        </div>
        <div class="note-actions">
          <a href="${note.file_url}" target="_blank" rel="noopener">View / Download</a>
        </div>
      `;
      notesContainer.appendChild(el);
    });
  }

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function renderFiltered(){
    const term = (searchInput.value || '').toLowerCase();
    const filtered = allNotesData.filter(n => {
      const matchCategory = activeCategory === 'all' || n.subject_code === activeCategory;
      const hay = `${n.title} ${n.description||''} ${n.subject_code}`.toLowerCase();
      const matchSearch = !term || hay.includes(term);
      return matchCategory && matchSearch;
    });
    renderNotes(filtered);
  }

  categoryLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      categoryLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      activeCategory = link.dataset.category || 'all';
      renderFiltered();
    });
  });

  searchInput?.addEventListener('input', renderFiltered);

  // init
  verifyUser().then(loadNotes);
});