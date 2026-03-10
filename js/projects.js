(function () {
    const list = document.getElementById('project-list');
    const addBtn = document.getElementById('add-project-btn');

    async function loadProjects() {
        try {
            const data = await api('projects');
            render(data);
        } catch (err) {
            list.innerHTML = `<p class="empty-state">Failed to load projects.</p>`;
        }
    }

    function render(items) {
        if (!items.length) {
            list.innerHTML = '<p class="empty-state">No projects added yet.</p>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="card" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.name)}</div>
                        ${item.url ? `<div class="card-subtitle"><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></div>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editProject(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProject(${item.id})">Delete</button>
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
                <label>Project Name *</label>
                <input type="text" name="name" required value="${escapeHtml(data.name || '')}">
            </div>
            <div class="form-group">
                <label>URL (optional)</label>
                <input type="url" name="url" value="${escapeHtml(data.url || '')}">
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
            name: form.querySelector('[name="name"]').value,
            url: form.querySelector('[name="url"]').value || null,
            description: form.querySelector('[name="description"]').value,
            skills: getTagValues(form.querySelector('.tag-input-wrapper')),
        };
    }

    addBtn.addEventListener('click', () => {
        openModal('Add Project', getFormHtml(), async () => {
            try {
                await api('projects', 'POST', getFormData());
                closeModal();
                loadProjects();
            } catch (err) {
                alert(err.message);
            }
        });

        setTimeout(() => {
            document.querySelectorAll('#modal-fields .tag-remove').forEach(btn => {
                btn.addEventListener('click', () => btn.parentElement.remove());
            });
        }, 0);
    });

    window.editProject = async function (id) {
        const data = await api(`projects&id=${id}`);
        openModal('Edit Project', getFormHtml(data), async () => {
            try {
                await api('projects', 'PUT', { id, ...getFormData() });
                closeModal();
                loadProjects();
            } catch (err) {
                alert(err.message);
            }
        });

        setTimeout(() => {
            document.querySelectorAll('#modal-fields .tag-remove').forEach(btn => {
                btn.addEventListener('click', () => btn.parentElement.remove());
            });
        }, 0);
    };

    window.deleteProject = async function (id) {
        if (!confirm('Delete this project?')) return;
        try {
            await api('projects', 'DELETE', { id });
            loadProjects();
        } catch (err) {
            alert(err.message);
        }
    };

    loadProjects();
})();
