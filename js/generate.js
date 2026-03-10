(function () {
    const generateBtn = document.getElementById('generate-btn');
    const resultsDiv = document.getElementById('generate-results');
    const resultsContent = document.getElementById('results-content');
    const loadingDiv = document.getElementById('generate-loading');
    const expCheckboxes = document.getElementById('experience-checkboxes');
    const projCheckboxes = document.getElementById('project-checkboxes');

    let experiences = [];
    let projects = [];

    window.loadGenerateCheckboxes = async function () {
        try {
            [experiences, projects] = await Promise.all([
                api('experiences'),
                api('projects'),
            ]);

            expCheckboxes.innerHTML = experiences.length
                ? experiences.map(e => `
                    <label class="checkbox-item">
                        <input type="checkbox" value="${e.id}">
                        <div>
                            <div class="checkbox-item-label">${escapeHtml(e.title)}</div>
                            <div class="checkbox-item-sub">${escapeHtml(e.company)}</div>
                        </div>
                    </label>
                `).join('')
                : '<p class="empty-state">No experience added yet.</p>';

            projCheckboxes.innerHTML = projects.length
                ? projects.map(p => `
                    <label class="checkbox-item">
                        <input type="checkbox" value="${p.id}">
                        <div>
                            <div class="checkbox-item-label">${escapeHtml(p.name)}</div>
                        </div>
                    </label>
                `).join('')
                : '<p class="empty-state">No projects added yet.</p>';
        } catch (err) {
            expCheckboxes.innerHTML = '<p class="empty-state">Failed to load.</p>';
            projCheckboxes.innerHTML = '<p class="empty-state">Failed to load.</p>';
        }
    };

    generateBtn.addEventListener('click', async () => {
        const jobDescription = document.getElementById('job-description').value.trim();
        if (!jobDescription) {
            alert('Please paste a job description.');
            return;
        }

        const selectedExpIds = Array.from(expCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
        const selectedProjIds = Array.from(projCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

        if (!selectedExpIds.length && !selectedProjIds.length) {
            alert('Select at least one experience or project.');
            return;
        }

        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        generateBtn.disabled = true;

        try {
            const result = await api('generate', 'POST', {
                job_description: jobDescription,
                experience_ids: selectedExpIds,
                project_ids: selectedProjIds,
            });

            renderResults(result.data, selectedExpIds, selectedProjIds);
        } catch (err) {
            resultsContent.innerHTML = `<div class="result-section"><p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p></div>`;
            resultsDiv.classList.remove('hidden');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    function renderResults(data, expIds, projIds) {
        let html = '';

        // Professional summary
        if (data.professional_summary) {
            const summaryText = data.professional_summary;
            html += `
                <div class="result-section">
                    <div class="result-section-header">
                        <h4>Professional Summary</h4>
                        <button class="btn-copy" onclick="copyToClipboard(${JSON.stringify(JSON.stringify(summaryText))}, this)">Copy</button>
                    </div>
                    <p>${escapeHtml(summaryText)}</p>
                </div>
            `;
        }

        // Experience items
        const items = data.items || {};
        for (const expId of expIds) {
            const key = `exp_${expId}`;
            const bullets = items[key];
            if (!bullets) continue;
            const exp = experiences.find(e => e.id === expId);
            const bulletText = bullets.map(b => `• ${b}`).join('\n');
            html += `
                <div class="result-section">
                    <div class="result-section-header">
                        <h4>${escapeHtml(exp?.title || '')} — ${escapeHtml(exp?.company || '')}</h4>
                        <button class="btn-copy" onclick="copyToClipboard(${JSON.stringify(JSON.stringify(bulletText))}, this)">Copy</button>
                    </div>
                    <ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>
            `;
        }

        // Project items
        for (const projId of projIds) {
            const key = `proj_${projId}`;
            const bullets = items[key];
            if (!bullets) continue;
            const proj = projects.find(p => p.id === projId);
            const bulletText = bullets.map(b => `• ${b}`).join('\n');
            html += `
                <div class="result-section">
                    <div class="result-section-header">
                        <h4>${escapeHtml(proj?.name || '')}</h4>
                        <button class="btn-copy" onclick="copyToClipboard(${JSON.stringify(JSON.stringify(bulletText))}, this)">Copy</button>
                    </div>
                    <ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
                </div>
            `;
        }

        resultsContent.innerHTML = html;
        resultsDiv.classList.remove('hidden');
    }
})();
