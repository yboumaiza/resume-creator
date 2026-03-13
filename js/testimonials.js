(function () {
    const list = document.getElementById('testimonial-list');
    const addBtn = document.getElementById('add-testimonial-btn');

    async function loadTestimonials() {
        try {
            const data = await api('testimonials');
            render(data);
        } catch (err) {
            list.innerHTML = '<p class="empty-state">Failed to load testimonials.</p>';
        }
    }

    function render(items) {
        if (!items.length) {
            list.innerHTML = '<p class="empty-state">No testimonials added yet.</p>';
            return;
        }
        list.innerHTML = items.map(item => `
            <div class="card" data-id="${item.id}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(item.name)}</div>
                        <div class="card-subtitle">${item.position ? escapeHtml(item.position) : ''}${item.position && item.company ? ' at ' : ''}${item.company ? escapeHtml(item.company) : ''}${item.linkedin ? ((item.position || item.company) ? ' &middot; ' : '') + '<a href="' + escapeHtml(item.linkedin) + '" target="_blank">LinkedIn</a>' : ''}</div>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-sm" onclick="editTestimonial(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTestimonial(${item.id})">Delete</button>
                    </div>
                </div>
                <div class="card-description">${escapeHtml(item.message)}</div>
            </div>
        `).join('');
    }

    function getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>Name *</label>
                <input type="text" name="name" required placeholder="e.g. Jane Smith" value="${escapeHtml(data.name || '')}">
            </div>
            <div class="form-group">
                <label>Job Position</label>
                <input type="text" name="position" placeholder="e.g. Engineering Manager" value="${escapeHtml(data.position || '')}">
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" name="company" placeholder="e.g. Acme Corp" value="${escapeHtml(data.company || '')}">
            </div>
            <div class="form-group">
                <label>LinkedIn URL</label>
                <input type="text" name="linkedin" placeholder="https://linkedin.com/in/..." value="${escapeHtml(data.linkedin || '')}">
            </div>
            <div class="form-group">
                <label>Message *</label>
                <textarea name="message" rows="4" required placeholder="What did they say about you?">${escapeHtml(data.message || '')}</textarea>
            </div>
        `;
    }

    function getFormData() {
        const form = document.getElementById('modal-form');
        return {
            name: form.querySelector('[name="name"]').value,
            position: form.querySelector('[name="position"]').value || null,
            company: form.querySelector('[name="company"]').value || null,
            linkedin: form.querySelector('[name="linkedin"]').value || null,
            message: form.querySelector('[name="message"]').value,
        };
    }

    addBtn.addEventListener('click', () => {
        openModal('Add Testimonial', getFormHtml(), async () => {
            try {
                await api('testimonials', 'POST', getFormData());
                closeModal();
                loadTestimonials();
            } catch (err) {
                alert(err.message);
            }
        });
    });

    window.editTestimonial = async function (id) {
        const data = await api(`testimonials&id=${id}`);
        openModal('Edit Testimonial', getFormHtml(data), async () => {
            try {
                await api('testimonials', 'PUT', { id, ...getFormData() });
                closeModal();
                loadTestimonials();
            } catch (err) {
                alert(err.message);
            }
        });
    };

    window.deleteTestimonial = async function (id) {
        if (!confirm('Delete this testimonial?')) return;
        try {
            await api('testimonials', 'DELETE', { id });
            loadTestimonials();
        } catch (err) {
            alert(err.message);
        }
    };

    loadTestimonials();
})();
