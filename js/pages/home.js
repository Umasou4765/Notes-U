import { apiService } from '../services/api.js';
import { dom } from '../utils/dom.js';
import { NoteCard } from '../components/NoteCard.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

class HomePage {
  constructor() {
    this.allNotesData = [];
    this.activeCategory = 'all';
    this.elements = {};
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
    this.loadPage();
  }

  setupElements() {
    this.elements = {
      logoutButton: dom.safeGetElement('#logout-btn'),
      categoryLinks: dom.getElements('.category-list a'),
      notesContainer: dom.getElement('#notes-container'),
      searchInput: dom.getElement('#searchInput')
    };
  }

  setupEventListeners() {
    // Logout button
    if (this.elements.logoutButton) {
      dom.on(this.elements.logoutButton, 'click', this.handleLogout.bind(this));
    }

    // Category filter links
    this.elements.categoryLinks.forEach(link => {
      dom.on(link, 'click', this.handleCategoryChange.bind(this));
    });

    // Search input with debouncing
    const debouncedSearch = dom.debounce(this.handleSearch.bind(this), 300);
    dom.on(this.elements.searchInput, 'input', debouncedSearch);
  }

  async loadPage() {
    try {
      await this.verifyUser();
      await this.loadNotes();
    } catch (error) {
      console.error('Failed to load page:', error);
      this.showError(error.message);
    }
  }

  async verifyUser() {
    try {
      await apiService.getUser();
    } catch (error) {
      window.location.href = '/auth.html?mode=login';
      throw error;
    }
  }

  async handleLogout() {
    try {
      await apiService.logout();
      window.location.href = '/auth.html?mode=login';
    } catch (error) {
      alert(ERROR_MESSAGES.LOGOUT_FAILED);
    }
  }

  async loadNotes() {
    try {
      this.allNotesData = await apiService.fetchNotes();
      this.renderFilteredNotes();
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      this.showError(error.message);
    }
  }

  handleCategoryChange(event) {
    event.preventDefault();
    const link = event.currentTarget;
    
    // Update active category
    this.activeCategory = link.dataset.category || 'all';
    
    // Update active state
    this.elements.categoryLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    this.renderFilteredNotes();
  }

  handleSearch() {
    this.renderFilteredNotes();
  }

  renderFilteredNotes() {
    const searchTerm = (this.elements.searchInput.value || '').toLowerCase();
    
    const filteredNotes = this.allNotesData.filter(note => {
      const matchesSearch = !searchTerm || 
        note.title.toLowerCase().includes(searchTerm) ||
        note.description?.toLowerCase().includes(searchTerm) ||
        note.subject_code.toLowerCase().includes(searchTerm);
      
      const matchesCategory = this.activeCategory === 'all' || 
        note.subject_code === this.activeCategory;
      
      return matchesSearch && matchesCategory;
    });

    this.renderNotes(filteredNotes);
  }

  renderNotes(notes) {
    // Clear container
    this.elements.notesContainer.innerHTML = '';

    if (notes.length === 0) {
      this.elements.notesContainer.appendChild(NoteCard.createEmptyCard());
      return;
    }

    // Render each note
    notes.forEach(note => {
      const noteCard = new NoteCard(note);
      this.elements.notesContainer.appendChild(noteCard.render());
    });
  }

  showError(message) {
    this.elements.notesContainer.innerHTML = '';
    this.elements.notesContainer.appendChild(
      NoteCard.createErrorCard({ message })
    );
  }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HomePage();
});
