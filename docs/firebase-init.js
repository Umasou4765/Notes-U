<script type="module">
/* Existing Firebase helpers assumed */
import { onAuth, logout, fetchMyNotes } from './firebase-init.js';

/* THEME INIT (reuse from other pages) */
(function initTheme(){
  const stored = localStorage.getItem('theme');
  function apply(t){
    document.body.classList.remove('light','dark');
    document.body.classList.add(t);
    localStorage.setItem('theme', t);
  }
  if(stored) apply(stored);
  else apply(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{
    if(!localStorage.getItem('theme')) apply(e.matches?'dark':'light');
  });
  window.addEventListener('storage', e=>{
    if(e.key==='theme' && e.newValue) apply(e.newValue);
  });
})();

document.getElementById('year').textContent = new Date().getFullYear();

/* ELEMENTS */
const logoutButton    = document.getElementById('logout-btn');
const categoryList    = document.getElementById('categoryList');
const mobileCategoryList = document.getElementById('mobileCategoryList');
const searchInput     = document.getElementById('searchInput');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const resultsSummary  = document.getElementById('resultsSummary');
const notesHost       = document.getElementById('notesHost');
const gridViewBtn     = document.getElementById('gridViewBtn');
const listViewBtn     = document.getElementById('listViewBtn');
const sortButtons     = Array.from(document.querySelectorAll('.sort-btn'));
const sortSelect      = document.getElementById('sortSelect');
const menuBtn         = document.getElementById('menu-btn');
const drawer          = document.getElementById('sidebarDrawer');
const drawerOverlay   = document.getElementById('drawerOverlay');
const closeDrawerBtn  = document.getElementById('closeDrawerBtn');

let allNotesData = [];
let activeCategory = 'all';
let activeSort = 'newest';

/* Clone category list for mobile */
function syncMobileCategories(){
  mobileCategoryList.innerHTML = categoryList.innerHTML;
}
syncMobileCategories();

/* Drawer logic */
function openDrawer(){
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  drawerOverlay.classList.add('visible');
  drawerOverlay.setAttribute('aria-hidden','false');
  // Focus first link
  const first = drawer.querySelector('a');
  if(first) first.focus();
}
function closeDrawer(){
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  drawerOverlay.classList.remove('visible');
  drawerOverlay.setAttribute('aria-hidden','true');
  menuBtn.focus();
}
menuBtn.addEventListener('click', openDrawer);
closeDrawerBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
});

/* Logout */
logoutButton?.addEventListener('click', async () => {
  try {
    await logout();
    location.href='auth.html?mode=login';
  } catch {
    alert('Failed to log out.');
  }
});

/* Load */
onAuth(user=>{
  if(!user){
    location.replace('auth.html?mode=login');
    return;
  }
  loadNotes();
});

/* Fetch notes */
async function loadNotes(){
  notesHost.innerHTML = skeletons(6);
  try {
    allNotesData = await fetchMyNotes();
    renderFiltered();
  } catch(err){
    notesHost.innerHTML = `<div class="note-list"><div class="note-card">
      <div class="note-body">
        <div class="note-header"><h3>Error Loading Notes</h3></div>
        <p>${escapeHtml(err.message||'There was a problem loading your notes.')}</p>
        <div class="note-actions">
          <a class="action-link" href="#" onclick="location.reload();return false;">Reload Page</a>
        </div>
      </div></div></div>`;
  }
}

/* Skeleton */
function skeletons(n){
  return `<div class="note-grid">${Array.from({length:n}).map(()=>'<div class="skeleton"></div>').join('')}</div>`;
}

/* Rendering */
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fileExtToLabel(ext){
  if(!ext) return 'FILE';
  if(ext.length>5) return ext.slice(0,5).toUpperCase();
  return ext.toUpperCase();
}
function sortNotes(list){
  switch(activeSort){
    case 'oldest': return list.slice().sort((a,b)=> (a.createdAt||0)-(b.createdAt||0));
    case 'title': return list.slice().sort((a,b)=> (a.title||'').localeCompare(b.title||'', undefined, { sensitivity:'base' }));
    case 'newest':
    default: return list.slice().sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }
}

function renderNotes(list){
  const isList = document.body.classList.contains('view-list');
  const wrapperClass = isList ? 'note-list' : 'note-grid';

  if (list.length === 0) {
    notesHost.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--label); font-size: 1rem; border: 1px dashed var(--border); border-radius: 12px; margin-top: 20px;">
        <p>No notes found for this category or search query.</p>
        <p style="font-size: 0.85rem; margin-top: 10px;">Click the "Upload" button to add your first note!</p>
      </div>
    `;
    return;
  }

  const cards = list.map(note=>{
    const typeDisplay = (note.notes_type||'note').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const ext = fileExtToLabel(note.file_ext||note.file_url?.split('.').pop()||'');
    const initials = subjectInitials(note.subject_code);
    return `<div class="note-card" data-category="${escapeHtml(note.subject_code)}">
      <div class="thumb" aria-hidden="true">
        <div>${escapeHtml(initials)}</div>
        <span class="ext">${escapeHtml(ext)}</span>
      </div>
      <div class="note-body">
        <div class="note-header">
          <h3>${escapeHtml(note.title||'Untitled')}</h3>
        </div>
        <p>${escapeHtml(note.description || 'No description provided.')}</p>
        <div class="tags">
          <span class="category-tag">${escapeHtml(note.academic_year.replace('year','Year '))}</span>
          <span class="category-tag">${escapeHtml(note.semester.replace('semester','Semester '))}</span>
          <span class="category-tag">${escapeHtml(note.subject_code)}</span>
          <span class="category-tag">${escapeHtml(typeDisplay)}</span>
        </div>
        <div class="note-actions">
          <a class="action-link" href="${note.file_url}" target="_blank" rel="noopener">View / Download</a>
        </div>
      </div>
    </div>`;
  }).join('');
  notesHost.innerHTML = `<div class="${wrapperClass}">${cards}</div>`;
}

function subjectInitials(code=''){
  const c = code.replace(/[^A-Z0-9]/gi,'').toUpperCase();
  if(c.length<=4) return c;
  return c.slice(0,4);
}

function renderFiltered(){
  const term = (searchInput.value || '').toLowerCase();
  const filtered = allNotesData.filter(n => {
    const matchCategory = activeCategory === 'all' || n.subject_code === activeCategory;
    const hay = `${n.title||''} ${n.description||''} ${n.subject_code||''}`.toLowerCase();
    const matchSearch = !term || hay.includes(term);
    return matchCategory && matchSearch;
  });
  const sorted = sortNotes(filtered);
  renderNotes(sorted);
  updateSummary(sorted.length);
}

function updateSummary(count){
  resultsSummary.textContent = `${count} note${count!==1?'s':''} shown`;
}

/* Category interactions (desktop + mobile) */
function bindCategoryClicks(root){
  root.querySelectorAll('a[data-category]').forEach(link=>{
    link.addEventListener('click', e=>{
      e.preventDefault();
      // Remove aria-current across both lists
      document.querySelectorAll('ul.category-list a[aria-current="true"]').forEach(a=>a.removeAttribute('aria-current'));
      const cat = link.dataset.category || 'all';
      activeCategory = cat;
      // Mark matching links in both lists
      document.querySelectorAll(`a[data-category="${CSS.escape(cat)}"]`).forEach(a=>a.setAttribute('aria-current','true'));
      if(cat==='all'){
        document.querySelectorAll('a[data-category="all"]').forEach(a=>a.setAttribute('aria-current','true'));
      }
      renderFiltered();
      if(drawer.classList.contains('open')) closeDrawer();
    }, { passive:false });
  });
}
bindCategoryClicks(categoryList);
syncMobileCategories();
bindCategoryClicks(mobileCategoryList);

/* Search */
searchInput.addEventListener('input', renderFiltered);

/* View Mode */
function setView(mode){
  const isGrid = mode === 'grid';
  document.body.classList.toggle('view-grid', isGrid);
  document.body.classList.toggle('view-list', !isGrid);
  gridViewBtn.setAttribute('aria-pressed', isGrid ? 'true':'false');
  listViewBtn.setAttribute('aria-pressed', !isGrid ? 'true':'false');
  renderFiltered();
}
gridViewBtn.addEventListener('click', ()=> setView('grid'));
listViewBtn.addEventListener('click', ()=> setView('list'));

/* Sorting dropdown */
sortSelect?.addEventListener('change', ()=>{
  activeSort = sortSelect.value;
  renderFiltered();
});

/* Initial placeholder */
notesHost.innerHTML = skeletons(6);

</script>
