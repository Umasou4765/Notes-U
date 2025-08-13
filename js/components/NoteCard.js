import { dom } from '../utils/dom.js';

export class NoteCard {
  constructor(note) {
    this.note = note;
  }

  formatNotesType(notesType) {
    if (!notesType) return 'Note';
    return notesType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatAcademicYear(year) {
    return year.replace('year', 'Year ');
  }

  formatSemester(semester) {
    return semester.replace('semester', 'Semester ');
  }

  createTag(tagText) {
    return dom.createElement('span', {
      className: 'category-tag'
    }, [dom.escapeHtml(tagText)]);
  }

  createTagsContainer() {
    const tagsContainer = dom.createElement('div', {
      className: 'tags'
    });

    const tags = [
      this.formatAcademicYear(this.note.academic_year),
      this.formatSemester(this.note.semester),
      this.note.subject_code,
      this.formatNotesType(this.note.notes_type)
    ];

    tags.forEach(tagText => {
      tagsContainer.appendChild(this.createTag(tagText));
    });

    return tagsContainer;
  }

  createActionsContainer() {
    return dom.createElement('div', {
      className: 'note-actions'
    }, [
      dom.createElement('a', {
        href: this.note.file_url,
        target: '_blank',
        rel: 'noopener'
      }, ['View / Download'])
    ]);
  }

  render() {
    const card = dom.createElement('div', {
      className: 'note-card',
      dataset: { category: this.note.subject_code }
    });

    const title = dom.createElement('h3', {}, [
      dom.escapeHtml(this.note.title)
    ]);

    const description = dom.createElement('p', {}, [
      dom.escapeHtml(this.note.description || 'No description provided.')
    ]);

    const tagsContainer = this.createTagsContainer();
    const actionsContainer = this.createActionsContainer();

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(tagsContainer);
    card.appendChild(actionsContainer);

    return card;
  }

  static createErrorCard(error) {
    return dom.createElement('div', {
      className: 'note-card',
      dataset: { category: 'error' }
    }, [
      dom.createElement('h3', {}, ['Error Loading Notes']),
      dom.createElement('p', {}, [
        dom.escapeHtml(error.message || 'There was a problem loading your notes.')
      ]),
      dom.createElement('div', { className: 'tags' }, [
        dom.createElement('span', { className: 'category-tag' }, ['Error'])
      ]),
      dom.createElement('div', { className: 'note-actions' }, [
        dom.createElement('a', {
          href: '#',
          onclick: 'window.location.reload();return false;'
        }, ['Reload Page'])
      ])
    ]);
  }

  static createEmptyCard() {
    return dom.createElement('div', {
      className: 'note-card',
      dataset: { category: 'placeholder-note' }
    }, [
      dom.createElement('h3', {}, ['No Notes Found']),
      dom.createElement('p', {}, [
        'It looks like there are no notes available for this category yet. Upload some notes to get started!'
      ]),
      dom.createElement('div', { className: 'tags' }, [
        dom.createElement('span', { className: 'category-tag' }, ['Information']),
        dom.createElement('span', { className: 'category-tag' }, ['Get Started'])
      ]),
      dom.createElement('div', { className: 'note-actions' }, [
        dom.createElement('a', { href: 'upload.html' }, ['Upload Now'])
      ])
    ]);
  }
}
