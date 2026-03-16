(function () {
    const list = document.getElementById('experience-list');
    const addBtn = document.getElementById('add-experience-btn');

    async function loadExperiences() {
        try {
            const data = await api('experiences');
            render(data);
        } catch (err) {
            list.innerHTML = `<p class="empty-state">Failed to load experiences.</p>`;
        }
    }

    function render(items) {
        if (!items.length) {
            list.innerHTML = '<p class="empty-state">No work experience added yet.</p>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="card" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.title)}</div>
                        <div class="card-subtitle">${escapeHtml(item.company)} &middot; ${item.start_date} &ndash; ${item.end_date || 'Present'}${item.commitment ? ' &middot; <span class="badge commitment-badge">' + escapeHtml(item.commitment) + '</span>' : ''}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editExperience(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteExperience(${item.id})">Delete</button>
                    </div>
                </div>
                <div class="card-description">${escapeHtml(item.description)}</div>
                <div class="tags">${item.skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
            </div>
        `).join('');
    }

    function getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>Job Title *</label>
                <input type="text" name="title" required value="${escapeHtml(data.title || '')}">
            </div>
            <div class="form-group">
                <label>Company *</label>
                <input type="text" name="company" required value="${escapeHtml(data.company || '')}">
            </div>
            <div class="form-group">
                <label>Start Date *</label>
                <input type="date" name="start_date" required value="${data.start_date || ''}">
            </div>
            <div class="form-group">
                <label>End Date (leave empty if current)</label>
                <input type="date" name="end_date" value="${data.end_date || ''}">
            </div>
            <div class="form-group">
                <label>Commitment</label>
                <select name="commitment">
                    <option value="">Select...</option>
                    <option value="Full-Time"${data.commitment === 'Full-Time' ? ' selected' : ''}>Full-Time</option>
                    <option value="Part-Time"${data.commitment === 'Part-Time' ? ' selected' : ''}>Part-Time</option>
                    <option value="Freelance"${data.commitment === 'Freelance' ? ' selected' : ''}>Freelance</option>
                    <option value="Contractor"${data.commitment === 'Contractor' ? ' selected' : ''}>Contractor</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea name="description" rows="4" required>${escapeHtml(data.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Skills (press Enter to add)</label>
                <div class="tag-input-wrapper" data-name="skills">
                    ${(data.skills || []).map(s => `<span class="tag">${escapeHtml(s)} <span class="tag-remove">&times;</span></span>`).join('')}
                    <input type="text" placeholder="Type a skill...">
                </div>
            </div>
        `;
    }

    function getFormData() {
        const form = document.getElementById('modal-form');
        return {
            title: form.querySelector('[name="title"]').value,
            company: form.querySelector('[name="company"]').value,
            start_date: form.querySelector('[name="start_date"]').value,
            end_date: form.querySelector('[name="end_date"]').value || null,
            commitment: form.querySelector('[name="commitment"]').value || null,
            description: form.querySelector('[name="description"]').value,
            skills: getTagValues(form.querySelector('.tag-input-wrapper')),
        };
    }

    addBtn.addEventListener('click', () => {
        openModal('Add Experience', getFormHtml(), async () => {
            try {
                await api('experiences', 'POST', getFormData());
                closeModal();
                loadExperiences();
            } catch (err) {
                showToast(err.message);
            }
        });

        // Re-attach tag remove handlers after modal opens
        setTimeout(() => {
            document.querySelectorAll('#modal-fields .tag-remove').forEach(btn => {
                btn.addEventListener('click', () => btn.parentElement.remove());
            });
        }, 0);
    });

    window.editExperience = async function (id) {
        const data = await api(`experiences&id=${id}`);
        openModal('Edit Experience', getFormHtml(data), async () => {
            try {
                await api('experiences', 'PUT', { id, ...getFormData() });
                closeModal();
                loadExperiences();
            } catch (err) {
                showToast(err.message);
            }
        });

        setTimeout(() => {
            document.querySelectorAll('#modal-fields .tag-remove').forEach(btn => {
                btn.addEventListener('click', () => btn.parentElement.remove());
            });
        }, 0);
    };

    window.deleteExperience = async function (id) {
        if (!await showConfirm('Delete this experience?')) return;
        try {
            await api('experiences', 'DELETE', { id });
            loadExperiences();
        } catch (err) {
            showToast(err.message);
        }
    };

    loadExperiences();
})();
