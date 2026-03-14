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
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

        if (tab.dataset.tab === 'personal' && typeof loadPersonalInfo === 'function') {
            loadPersonalInfo();
        }
        if (tab.dataset.tab === 'selection' && typeof loadSelectionCheckboxes === 'function') {
            loadSelectionCheckboxes();
        }
    });
});

// Modal helpers
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');
const modalForm = document.getElementById('modal-form');

function openModal(title, fieldsHtml, onSubmit) {
    modalTitle.textContent = title;
    modalFields.innerHTML = fieldsHtml;
    modalOverlay.classList.remove('hidden');

    // Initialize tag inputs
    modalFields.querySelectorAll('.tag-input-wrapper').forEach(initTagInput);

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
