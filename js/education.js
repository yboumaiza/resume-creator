(function () {
    const list = document.getElementById('education-list');
    const addBtn = document.getElementById('add-education-btn');

    async function loadEducation() {
        try {
            const data = await api('education');
            render(data);
        } catch (err) {
            list.innerHTML = '<p class="empty-state">Failed to load education.</p>';
        }
    }

    function render(items) {
        if (!items.length) {
            list.innerHTML = '<p class="empty-state">No education added yet.</p>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="card" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.degree)}</div>
                        <div class="card-subtitle">${escapeHtml(item.school)} &middot; ${item.start_date} &ndash; ${item.end_date || 'Present'}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editEducation(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEducation(${item.id})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>Degree *</label>
                <input type="text" name="degree" required placeholder="e.g. B.Sc. Computer Science" value="${escapeHtml(data.degree || '')}">
            </div>
            <div class="form-group">
                <label>School *</label>
                <input type="text" name="school" required value="${escapeHtml(data.school || '')}">
            </div>
            <div class="form-group">
                <label>Start Date * (MM/YYYY)</label>
                <input type="text" name="start_date" required placeholder="MM/YYYY" value="${escapeHtml(data.start_date || '')}">
            </div>
            <div class="form-group">
                <label>End Date (MM/YYYY, leave empty if current)</label>
                <input type="text" name="end_date" placeholder="MM/YYYY" value="${escapeHtml(data.end_date || '')}">
            </div>
        `;
    }

    function getFormData() {
        const form = document.getElementById('modal-form');
        return {
            degree: form.querySelector('[name="degree"]').value,
            school: form.querySelector('[name="school"]').value,
            start_date: form.querySelector('[name="start_date"]').value,
            end_date: form.querySelector('[name="end_date"]').value || null,
        };
    }

    addBtn.addEventListener('click', () => {
        openModal('Add Education', getFormHtml(), async () => {
            try {
                await api('education', 'POST', getFormData());
                closeModal();
                loadEducation();
            } catch (err) {
                alert(err.message);
            }
        });
    });

    window.editEducation = async function (id) {
        const data = await api(`education&id=${id}`);
        openModal('Edit Education', getFormHtml(data), async () => {
            try {
                await api('education', 'PUT', { id, ...getFormData() });
                closeModal();
                loadEducation();
            } catch (err) {
                alert(err.message);
            }
        });
    };

    window.deleteEducation = async function (id) {
        if (!confirm('Delete this education entry?')) return;
        try {
            await api('education', 'DELETE', { id });
            loadEducation();
        } catch (err) {
            alert(err.message);
        }
    };

    loadEducation();
})();
