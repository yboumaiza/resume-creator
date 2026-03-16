const API_BASE = 'api/index.php';

async function api(route, method = 'GET', body = null) {
    const url = `${API_BASE}?route=${route}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        const err = new Error(data.error || 'Request failed');
        err.detail = data.error_detail || null;
        throw err;
    }
    return data;
}

// Tab switching
function switchToTab(tabName) {
    const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    const content = document.getElementById(`tab-${tabName}`);
    if (!tab || !content) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    content.classList.add('active');

    if (tabName === 'personal' && typeof loadPersonalInfo === 'function') {
        loadPersonalInfo();
    }
    const container = document.querySelector('.container');
    if (tabName === 'build') {
        container.classList.add('build-active');
    } else {
        container.classList.remove('build-active');
    }
    if (tabName === 'build' && typeof loadSelectionCheckboxes === 'function') {
        loadSelectionCheckboxes();
    }

    // Update URL hash without triggering hashchange
    if (location.hash !== `#${tabName}`) {
        history.replaceState(null, '', `#${tabName}`);
    }
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
});

// Restore tab from URL hash on load (deferred until all scripts are ready)
const validTabs = Array.from(document.querySelectorAll('.tab')).map(t => t.dataset.tab);
document.addEventListener('DOMContentLoaded', () => {
    const hashTab = location.hash.replace('#', '');
    switchToTab(validTabs.includes(hashTab) ? hashTab : 'personal');
});

// Handle browser back/forward
window.addEventListener('hashchange', () => {
    const tab = location.hash.replace('#', '');
    if (validTabs.includes(tab)) switchToTab(tab);
});

// Modal helpers
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');
const modalForm = document.getElementById('modal-form');

function openModal(title, fieldsHtml, onSubmit, submitLabel = 'Save') {
    modalTitle.textContent = title;
    modalFields.innerHTML = fieldsHtml;
    modalOverlay.classList.remove('hidden');

    // Initialize tag inputs
    modalFields.querySelectorAll('.tag-input-wrapper').forEach(initTagInput);

    modalForm.querySelector('[type="submit"]').textContent = submitLabel;

    modalForm.onsubmit = (e) => {
        e.preventDefault();
        onSubmit();
    };
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    modalForm.onsubmit = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Tag input component
function initTagInput(wrapper) {
    const input = wrapper.querySelector('input');
    const hiddenInput = wrapper.dataset.name;

    input.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
            e.preventDefault();
            addTag(wrapper, input.value.trim());
            input.value = '';
        }
        if (e.key === 'Backspace' && !input.value) {
            const tags = wrapper.querySelectorAll('.tag');
            if (tags.length) tags[tags.length - 1].remove();
        }
    });

    wrapper.addEventListener('click', () => input.focus());
}

function addTag(wrapper, value) {
    const input = wrapper.querySelector('input');
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${escapeHtml(value)} <span class="tag-remove">&times;</span>`;
    tag.querySelector('.tag-remove').addEventListener('click', () => tag.remove());
    wrapper.insertBefore(tag, input);
}

function getTagValues(wrapper) {
    return Array.from(wrapper.querySelectorAll('.tag')).map(t => {
        const clone = t.cloneNode(true);
        clone.querySelector('.tag-remove')?.remove();
        return clone.textContent.trim();
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
