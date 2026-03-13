(function () {
    const list = document.getElementById('certification-list');
    const addBtn = document.getElementById('add-certification-btn');

    async function loadCertifications() {
        try {
            const data = await api('certifications');
            render(data);
        } catch (err) {
            list.innerHTML = '<p class="empty-state">Failed to load certifications.</p>';
        }
    }

    function render(items) {
        if (!items.length) {
            list.innerHTML = '<p class="empty-state">No certifications added yet.</p>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="card" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.expertise)}</div>
                        <div class="card-subtitle">${escapeHtml(item.source)}${item.cert_id ? ' &middot; ID: ' + escapeHtml(item.cert_id) : ''}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editCertification(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCertification(${item.id})">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>Source / Issuer *</label>
                <input type="text" name="source" required placeholder="e.g. AWS, Google, Coursera" value="${escapeHtml(data.source || '')}">
            </div>
            <div class="form-group">
                <label>Expertise / Certification Name *</label>
                <input type="text" name="expertise" required placeholder="e.g. Solutions Architect Associate" value="${escapeHtml(data.expertise || '')}">
            </div>
            <div class="form-group">
                <label>Certification ID (optional)</label>
                <input type="text" name="cert_id" placeholder="e.g. ABC-123-XYZ" value="${escapeHtml(data.cert_id || '')}">
            </div>
        `;
    }

    function getFormData() {
        const form = document.getElementById('modal-form');
        return {
            source: form.querySelector('[name="source"]').value,
            expertise: form.querySelector('[name="expertise"]').value,
            cert_id: form.querySelector('[name="cert_id"]').value || null,
        };
    }

    addBtn.addEventListener('click', () => {
        openModal('Add Certification', getFormHtml(), async () => {
            try {
                await api('certifications', 'POST', getFormData());
                closeModal();
                loadCertifications();
            } catch (err) {
                alert(err.message);
            }
        });
    });

    window.editCertification = async function (id) {
        const data = await api(`certifications&id=${id}`);
        openModal('Edit Certification', getFormHtml(data), async () => {
            try {
                await api('certifications', 'PUT', { id, ...getFormData() });
                closeModal();
                loadCertifications();
            } catch (err) {
                alert(err.message);
            }
        });
    };

    window.deleteCertification = async function (id) {
        if (!confirm('Delete this certification?')) return;
        try {
            await api('certifications', 'DELETE', { id });
            loadCertifications();
        } catch (err) {
            alert(err.message);
        }
    };

    loadCertifications();
})();
