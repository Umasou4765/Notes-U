/*
 * File: docs/js/home.js
 * Description: Home page logic - fetches and renders notes, handles category filters, search,
 *              pagination (load more), and note deletion. Uses Firebase service helpers.
 */

import { onAuth, fetchNotes, deleteNote, auth, logout } from './services/firebase.js';
import { showToast } from './services/ui.js';

let lastSnapshot = null;
let hasMore = false;
const PAGE_SIZE = 50; // server page size


// Theme init (shared pattern)
(function initTheme(){
  function applyTheme(isDarkOrString){
    const isDark = (typeof isDarkOrString === 'string') ? (isDarkOrString === 'dark') : !!isDarkOrString;
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }
  const stored = localStorage.getItem('theme');
  if(stored === 'dark') applyTheme(true);
  else if(stored === 'light') applyTheme(false);
  else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e=>{ if(!localStorage.getItem('theme')) applyTheme(e.matches); });
  window.addEventListener('storage', e=>{ if(e.key==='theme' && e.newValue) applyTheme(e.newValue==='dark'); });

  document.getElementById('theme-toggle')?.addEventListener('click', ()=>{
    const willBeDark = !document.body.classList.contains('dark');
    applyTheme(willBeDark);
  }, { passive:true });
})();

document.getElementById('year').textContent = new Date().getFullYear();

/* Elements */
const logoutButton    = document.getElementById('logout-btn');
const categoryList    = document.getElementById('categoryList');
const mobileCategoryList = document.getElementById('mobileCategoryList');
const searchInput     = document.getElementById('searchInput');
const resultsSummary  = document.getElementById('resultsSummary');
const notesHost       = document.getElementById('notesHost');
const gridViewBtn     = document.getElementById('gridViewBtn');
const listViewBtn     = document.getElementById('listViewBtn');
const menuBtn         = document.getElementById('menuBtn');
const drawer          = document.getElementById('sidebarDrawer');
const drawerOverlay   = document.getElementById('drawerOverlay');
const closeDrawerBtn  = document.getElementById('closeDrawerBtn');

let allNotesData = [];
let activeCategory = 'all';
let activeSort = 'newest';

function syncMobileCategories(){ mobileCategoryList.innerHTML = categoryList.innerHTML; }
syncMobileCategories();

function openDrawer(){
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden','false');
  drawerOverlay.classList.add('visible');
  drawerOverlay.setAttribute('aria-hidden','false');
  const first = drawer.querySelector('a'); if(first) first.focus();
}
function closeDrawer(){
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  drawerOverlay.classList.remove('visible');
  drawerOverlay.setAttribute('aria-hidden','true');
  menuBtn.focus();
}
menuBtn?.addEventListener('click', openDrawer);
closeDrawerBtn?.addEventListener('click', closeDrawer);
drawerOverlay?.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });

// Logout
logoutButton?.addEventListener('click', async () => {
  try {
    await logout();
    location.href='auth.html?mode=login';
  } catch {
    showToast('Failed to log out.', 'error');
  }
});

// Auth guard + load
onAuth(user=>{
  if(!user){ location.replace('auth.html?mode=login'); return; }
  loadNotes();
});

async function loadNotes(reset = true){
  // reset = true -> fresh load; false -> load next page and append
  if (reset){
    notesHost.innerHTML = skeletons(6);
    lastSnapshot = null;
    allNotesData = [];
  }

  try {
    const resp = await fetchNotes({ category: activeCategory, sort: activeSort, limit: PAGE_SIZE, startAfter: lastSnapshot });
    const fetched = resp && resp.notes ? resp.notes : [];
    const newLast = resp && resp.lastSnapshot ? resp.lastSnapshot : null;
    const newHasMore = !!(resp && resp.hasMore);

    if (reset) allNotesData = fetched; else allNotesData = allNotesData.concat(fetched);

    lastSnapshot = newLast;
    hasMore = newHasMore;

    renderFiltered();
    updateSummary(allNotesData.length);
    const loadMoreBtn = document.getElementById('loadMoreBtn'); if(loadMoreBtn) loadMoreBtn.hidden = !hasMore;
  } catch(err){
    notesHost.innerHTML = `<div class="note-list"><div class="note-card"><div class="note-body"><div class="note-header"><h3>Error Loading Notes</h3></div><p>${escapeHtml(err.message||'There was a problem loading notes.')}</p><div class="note-actions"><a class="action-link" href="#" onclick="location.reload();return false;">Reload Page</a></div></div></div></div>`;
  }
}

// Hook up "Load More" button
const loadMoreBtn = document.getElementById('loadMoreBtn');
loadMoreBtn?.addEventListener('click', () => { loadNotes(false); });



function skeletons(n){ return `<div class="note-grid">${Array.from({length:n}).map(()=>'<div class="skeleton"></div>').join('')}</div>`; }

function escapeHtml(str=''){ return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fileExtToLabel(ext){ if(!ext) return 'FILE'; if(ext.length>5) return ext.slice(0,5).toUpperCase(); return ext.toUpperCase(); }
function subjectInitials(code=''){ const c = code.replace(/[^A-Z0-9]/gi,'').toUpperCase(); if(c.length<=4) return c; return c.slice(0,4); }

function sortNotes(list){
  switch(activeSort){
    case 'oldest': return list.slice().sort((a,b)=> (a.createdAt||0)-(b.createdAt||0));
    case 'title': return list.slice().sort((a,b)=> (a.title||'').localeCompare(b.title||'', undefined, { sensitivity:'base' }));
    case 'newest':
    default: return list.slice().sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  }
}

function renderNotes(list){
  // Empty state: show friendly hint and CTA when no notes are loaded
  if(!list || list.length === 0){
    notesHost.innerHTML = `<div class="note-empty" style="padding:28px; text-align:center;">
      <div class="card-container" style="padding:28px; max-width:680px; margin:0 auto;">
        <h3 style="margin:0 0 8px;">No notes yet</h3>
        <p style="margin:0 0 12px; color:var(--text-soft);">Looks like there are no notes to show. You can be the first — upload a note to get started.</p>
        <a class="btn-primary" href="upload.html" style="display:inline-block; width:auto; padding:10px 18px;">Upload a Note</a>
      </div>
    </div>`;
    return;
  }

  const isList = document.body.classList.contains('view-list');
  const wrapperClass = isList ? 'note-list' : 'note-grid';
  const currentUser = auth.currentUser;
  const cards = list.map(note=>{
    const typeDisplay = (note.notes_type||'note').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const ext = fileExtToLabel(note.file_ext||note.file_url?.split('.').pop()||'');
    const initials = subjectInitials(note.subject_code);
    const isOwner = currentUser && note.uid === currentUser.uid;
    const deleteBtn = isOwner ? `<button class="action-btn-del" data-id="${note.id}" data-path="${escapeHtml(note.storage_path||'')}">Delete</button>` : '';
    return `<div class="note-card" data-category="${escapeHtml(note.subject_code)}"><div class="thumb" aria-hidden="true"><div>${escapeHtml(initials)}</div><span class="ext">${escapeHtml(ext)}</span></div><div class="note-body"><div class="note-header"><h3>${escapeHtml(note.title||'Untitled')}</h3></div><p>${escapeHtml(note.description || 'No description provided.')}</p><div class="tags"><span class="category-tag">${escapeHtml(note.academic_year.replace('year','Year '))}</span><span class="category-tag">${escapeHtml(note.semester.replace('semester','Semester '))}</span><span class="category-tag">${escapeHtml(note.subject_code)}</span><span class="category-tag">${escapeHtml(typeDisplay)}</span></div><div class="note-actions"><a class="action-link" href="${note.file_url}" target="_blank" rel="noopener">View / Download</a> ${deleteBtn}</div></div></div>`;
  }).join('');
  notesHost.innerHTML = `<div class="${wrapperClass}">${cards}</div>`;
}

// Delegate delete clicks to avoid inline onclicks and to keep handlers unobtrusive
notesHost.addEventListener('click', async (e) => {
  const btn = e.target.closest('.action-btn-del');
  if(!btn) return;
  const id = btn.dataset.id;
  const path = btn.dataset.path || null;
  if(!confirm('Are you sure you want to delete this note?')) return;
  try {
    await deleteNote(id, path || undefined);
    showToast('Note deleted', 'success');
    loadNotes();
  } catch (err) {
    showToast('Delete failed: ' + (err.message || err), 'error');
  }
});

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
  updateSummary(sorted.length, filtered.length);
}

function updateSummary(count){ resultsSummary.textContent = `${count} note${count!==1?'s':''} shown`; }

function bindCategoryClicks(root){ root.querySelectorAll('a[data-category]').forEach(link=>{ link.addEventListener('click', e=>{ e.preventDefault(); document.querySelectorAll('ul.category-list a[aria-current="true"]').forEach(a=>a.removeAttribute('aria-current')); const cat = link.dataset.category || 'all'; activeCategory = cat; document.querySelectorAll(`a[data-category="${CSS.escape(cat)}"]`).forEach(a=>a.setAttribute('aria-current','true')); if(cat==='all'){ document.querySelectorAll('a[data-category="all"]').forEach(a=>a.setAttribute('aria-current','true')); } 
    // Server-side: refetch notes for the chosen category
    loadNotes();
    if(drawer.classList.contains('open')) closeDrawer(); }, { passive:false }); }); }
bindCategoryClicks(categoryList); syncMobileCategories(); bindCategoryClicks(mobileCategoryList);

searchInput?.addEventListener('input', renderFiltered);

// Sort select (server-side request when sort changes)
const sortSelect = document.getElementById('sortSelect');
sortSelect?.addEventListener('change', ()=>{
  activeSort = sortSelect.value || 'newest';
  loadNotes();
});

function setView(mode){ const isGrid = mode === 'grid'; document.body.classList.toggle('view-grid', isGrid); document.body.classList.toggle('view-list', !isGrid); gridViewBtn.setAttribute('aria-pressed', isGrid ? 'true':'false'); listViewBtn.setAttribute('aria-pressed', !isGrid ? 'true':'false'); renderFiltered(); }
gridViewBtn?.addEventListener('click', ()=> setView('grid'));
listViewBtn?.addEventListener('click', ()=> setView('list'));

/* Initial placeholder */
notesHost.innerHTML = skeletons(6);
