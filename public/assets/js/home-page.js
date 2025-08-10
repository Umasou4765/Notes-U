import { initTheme } from './theme.js';
import { apiFetch } from './api.js';
import { showToast } from './notifications.js';
import { debounce } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  const notesContainer = document.getElementById('notes-container');
  const searchInput = document.getElementById('searchInput');
  const logoutBtn = document.getElementById('logout-btn');
  const categoriesUl = document.querySelector('.category-list');

  let allNotes = [];
  let currentCategory = 'all';

  async function loadSubjects() {
    const res = await fetch('/assets/data/subjects.json');
    return res.json();
  }

  function buildSidebar(subjectsData) {
    categoriesUl.innerHTML = '';
    const allLi = document.createElement('li');
    allLi.innerHTML = `<a href="#" class="active" data-category="all">All Notes</a>`;
    categoriesUl.appendChild(allLi);

    Object.entries(subjectsData).forEach(([year, semesters]) => {
      Object.entries(semesters).forEach(([semester, list]) => {
        const sep = document.createElement('li');
        sep.className = 'category-semester-separator';
        sep.textContent = `--- ${year.replace('year','Year ')} ${semester.replace('semester','Semester ')} ---`;
        categoriesUl.appendChild(sep);
        list.forEach(s => {
          const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-category="${s.code}">${s.code} - ${s.name}</a>`;
          categoriesUl.appendChild(li);
        });
      });
    });
  }

  function safe(text='') {
    return text.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function renderNotes(list) {
    notesContainer.innerHTML = '';
    if (!list.length) {
      notesContainer.innerHTML = `
        <div class="note-card">
          <h3>No Notes Found</h3>
          <p>You have no notes in this category or matching your search.</p>
          <div class="note-actions"><a href="upload.html">Upload Now</a></div>
        </div>`;
      return;
    }
    list.forEach(n => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.dataset.category = n.subject_code;
      card.innerHTML = `
        <h3>${safe(n.title)}</h3>
        <p>${safe(n.description || 'No description.')}</p>
        <div class="tags">
          <span class="category-tag">${safe(n.academic_year.replace('year','Year '))}</span>
          <span class="category-tag">${safe(n.semester.replace('semester','Semester '))}</span>
          <span class="category-tag">${safe(n.subject_code)}</span>
          <span class="category-tag">${safe(n.notes_type.replace(/_/g,' '))}</span>
        </div>
        <div class="note-actions">
          <a href="${safe(n.file_url)}" target="_blank" rel="noopener">View / Download</a>
        </div>
      `;
      notesContainer.appendChild(card);
    });
  }

  function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const filtered = allNotes.filter(n => {
      const matchCat = currentCategory === 'all' || n.subject_code === currentCategory;
      const s = (n.title + ' ' + (n.description||'') + ' ' + n.subject_code).toLowerCase();
      return matchCat && s.includes(term);
    });
    renderNotes(filtered);
  }

  const debouncedFilter = debounce(applyFilters, 200);

  categoriesUl.addEventListener('click', e => {
    const a = e.target.closest('a[data-category]');
    if (!a) return;
    e.preventDefault();
    categoriesUl.querySelectorAll('a').forEach(el => el.classList.remove('active'));
    a.classList.add('active');
    currentCategory = a.dataset.category;
    applyFilters();
  });

  searchInput.addEventListener('input', debouncedFilter);

  logoutBtn.addEventListener('click', async () => {
    try {
      await apiFetch('/api/logout');
      window.location.href = '/auth.html?mode=login';
    } catch { /* toast already shown */ }
  });

  async function loadNotes() {
    try {
      const res = await apiFetch('/api/notes');
      allNotes = res.data.notes;
      applyFilters();
    } catch {
      // handled
    }
  }

  (async function init() {
    try {
      const subjects = await loadSubjects();
      buildSidebar(subjects);
      await loadNotes();
    } catch (err) {
      showToast('Failed to initialize page.', 'error');
    }
  })();
});