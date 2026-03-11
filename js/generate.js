(function () {
    const generateBtn = document.getElementById('generate-btn');
    const autoSelectBtn = document.getElementById('auto-select-btn');
    const autoSelectStatus = document.getElementById('auto-select-status');
    const autoSelectReasoning = document.getElementById('auto-select-reasoning');
    const resultsDiv = document.getElementById('generate-results');
    const resultsContent = document.getElementById('results-content');
    const expCheckboxes = document.getElementById('experience-checkboxes');
    const projCheckboxes = document.getElementById('project-checkboxes');

    let experiences = [];
    let projects = [];

    // ── Load checkboxes ──

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

    // ── Auto-select (unchanged) ──

    autoSelectBtn.addEventListener('click', async () => {
        const jobDescription = document.getElementById('job-description').value.trim();
        if (!jobDescription) {
            alert('Please paste a job description first.');
            return;
        }

        if (!experiences.length && !projects.length) {
            alert('Add some experiences or projects first.');
            return;
        }

        autoSelectBtn.disabled = true;
        autoSelectStatus.textContent = 'Analyzing...';
        autoSelectStatus.className = 'auto-select-status loading-text';
        autoSelectReasoning.classList.add('hidden');

        try {
            const result = await api('auto-select', 'POST', {
                job_description: jobDescription,
            });

            expCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);
            projCheckboxes.querySelectorAll('input').forEach(cb => cb.checked = false);

            const expIds = result.experience_ids || [];
            const projIds = result.project_ids || [];

            expIds.forEach(id => {
                const cb = expCheckboxes.querySelector(`input[value="${id}"]`);
                if (cb) cb.checked = true;
            });

            projIds.forEach(id => {
                const cb = projCheckboxes.querySelector(`input[value="${id}"]`);
                if (cb) cb.checked = true;
            });

            const total = expIds.length + projIds.length;
            autoSelectStatus.textContent = total
                ? `Selected ${total} relevant item${total > 1 ? 's' : ''}`
                : 'Nothing relevant found';
            autoSelectStatus.className = 'auto-select-status';

            if (result.reasoning) {
                autoSelectReasoning.textContent = result.reasoning;
                autoSelectReasoning.classList.remove('hidden');
            }
        } catch (err) {
            autoSelectStatus.textContent = 'Auto-select failed: ' + err.message;
            autoSelectStatus.className = 'auto-select-status error-text';
        } finally {
            autoSelectBtn.disabled = false;
        }
    });

    // ── Pipeline UI Helpers ──

    function appendStep(title, status) {
        const el = document.createElement('div');
        el.className = `pipeline-step ${status}`;
        el.innerHTML = `
            <div class="pipeline-step-header">
                ${status === 'loading' ? '<div class="spinner-sm"></div>' : '<span class="step-check">&#10003;</span>'}
                <h4>${escapeHtml(title)}</h4>
            </div>
            <div class="pipeline-step-body"></div>
        `;
        resultsContent.appendChild(el);
        return el;
    }

    function completeStep(el, title) {
        el.className = 'pipeline-step complete';
        const header = el.querySelector('.pipeline-step-header');
        header.innerHTML = `<span class="step-check">&#10003;</span><h4>${escapeHtml(title)}</h4>`;
    }

    function failStep(el, message) {
        el.className = 'pipeline-step error';
        const spinner = el.querySelector('.spinner-sm');
        if (spinner) spinner.remove();
        const body = el.querySelector('.pipeline-step-body');
        body.innerHTML = `<p style="color:var(--danger)">${escapeHtml(message)}</p>`;
    }

    function setStepStatus(el, message) {
        let statusEl = el.querySelector('.step-status-text');
        if (!statusEl) {
            statusEl = document.createElement('span');
            statusEl.className = 'step-status-text';
            el.querySelector('.pipeline-step-header').appendChild(statusEl);
        }
        statusEl.textContent = message;
    }

    function getStepBody(el) {
        return el.querySelector('.pipeline-step-body');
    }

    // ── Step Renderers ──

    function renderJobAnalysis(parentEl, analysis) {
        const body = getStepBody(parentEl);
        let html = '';

        if (analysis.key_requirements?.length) {
            html += `<div class="analysis-group"><h5>Key Requirements</h5><ul>${analysis.key_requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
        }

        if (analysis.must_have_skills?.length) {
            html += `<div class="analysis-group"><h5>Must-Have Skills</h5><div class="tags">${analysis.must_have_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div></div>`;
        }

        if (analysis.nice_to_have_skills?.length) {
            html += `<div class="analysis-group"><h5>Nice-to-Have</h5><div class="tags">${analysis.nice_to_have_skills.map(s => `<span class="tag tag-nice">${escapeHtml(s)}</span>`).join('')}</div></div>`;
        }

        if (analysis.role_focus_areas?.length) {
            html += `<div class="analysis-group"><h5>Focus Areas</h5><p>${analysis.role_focus_areas.map(a => escapeHtml(a)).join(' &middot; ')}</p></div>`;
        }

        if (analysis.seniority_level) {
            html += `<div class="analysis-group"><h5>Seniority</h5><span class="seniority-badge">${escapeHtml(analysis.seniority_level)}</span></div>`;
        }

        body.innerHTML = html;
    }

    function renderRankedItems(parentEl, items) {
        const body = getStepBody(parentEl);
        body.innerHTML = items.map((item, i) => {
            const title = item.type === 'experience'
                ? `${escapeHtml(item.title)} — ${escapeHtml(item.company)}`
                : escapeHtml(item.name);
            const sub = item.type === 'experience'
                ? `${item.start_date} &ndash; ${item.end_date || 'Present'}`
                : '';
            const skillTags = (item.relevant_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');

            return `
                <div class="ranked-item">
                    <span class="rank-number">${i + 1}</span>
                    <div class="ranked-item-info">
                        <div class="ranked-item-title">${title}</div>
                        ${sub ? `<div class="ranked-item-sub">${sub}</div>` : ''}
                        ${skillTags ? `<div class="tags" style="margin-top:4px">${skillTags}</div>` : ''}
                    </div>
                    <span class="relevance-badge">${item.relevance_score}%</span>
                </div>
            `;
        }).join('');
    }

    function renderItemBullets(parentEl, item, bullets) {
        const body = getStepBody(parentEl);
        const title = item.type === 'experience'
            ? `${escapeHtml(item.title)} — ${escapeHtml(item.company)}`
            : escapeHtml(item.name);
        const bulletText = bullets.map(b => `\u2022 ${b}`).join('\n');
        const skillTags = (item.relevant_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');

        const card = document.createElement('div');
        card.className = 'bullet-card';
        card.innerHTML = `
            <div class="bullet-card-header">
                <h5>${title}</h5>
                <button class="btn-copy" onclick="copyToClipboard(${JSON.stringify(JSON.stringify(bulletText))}, this)">Copy</button>
            </div>
            <ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
            ${skillTags ? `<div class="result-skills">${skillTags}</div>` : ''}
        `;
        body.appendChild(card);
    }

    function renderSummary(parentEl, text) {
        const body = getStepBody(parentEl);
        body.innerHTML = `
            <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                <button class="btn-copy" onclick="copyToClipboard(${JSON.stringify(JSON.stringify(text))}, this)">Copy</button>
            </div>
            <p class="summary-text">${escapeHtml(text)}</p>
        `;
    }

    // ── Main Pipeline ──

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

        // Reset
        resultsContent.innerHTML = '';
        resultsDiv.classList.remove('hidden');
        generateBtn.disabled = true;

        try {
            // ── STEP 1: Analyze Job ──
            const step1 = appendStep('Step 1: Analyzing job description...', 'loading');

            const analyzeResult = await api('generate/analyze', 'POST', {
                job_description: jobDescription,
            });
            const jobAnalysis = analyzeResult.job_analysis;

            completeStep(step1, 'Step 1: Job Analysis');
            renderJobAnalysis(step1, jobAnalysis);

            // ── STEP 2: Score & Sort ──
            const step2 = appendStep('Step 2: Ranking & filtering skills...', 'loading');

            const scoreResult = await api('generate/score', 'POST', {
                job_analysis: jobAnalysis,
                experience_ids: selectedExpIds,
                project_ids: selectedProjIds,
            });
            const rankedItems = scoreResult.ranked_items;

            completeStep(step2, 'Step 2: Relevance Ranking');
            renderRankedItems(step2, rankedItems);

            // ── STEP 3: Per-item Bullets ──
            const step3 = appendStep('Step 3: Generating bullet points...', 'loading');
            const allBullets = {};

            for (const item of rankedItems) {
                const itemKey = `${item.type === 'experience' ? 'exp' : 'proj'}_${item.id}`;
                const label = item.title || item.name;
                setStepStatus(step3, `Writing bullets for ${label}...`);

                try {
                    const bulletResult = await api('generate/bullets', 'POST', {
                        job_analysis: jobAnalysis,
                        item: item,
                    });

                    allBullets[bulletResult.item_key] = bulletResult.bullets;
                    renderItemBullets(step3, item, bulletResult.bullets);
                } catch (itemErr) {
                    // Show error for this item but continue
                    const body = getStepBody(step3);
                    const errCard = document.createElement('div');
                    errCard.className = 'bullet-card';
                    errCard.innerHTML = `<p style="color:var(--danger)">Failed to generate bullets for ${escapeHtml(label)}: ${escapeHtml(itemErr.message)}</p>`;
                    body.appendChild(errCard);
                }
            }

            completeStep(step3, 'Step 3: Bullet Points');

            // ── STEP 4: Professional Summary ──
            if (Object.keys(allBullets).length > 0) {
                const step4 = appendStep('Step 4: Writing professional summary...', 'loading');

                const summaryResult = await api('generate/summary', 'POST', {
                    job_analysis: jobAnalysis,
                    all_bullets: allBullets,
                });

                completeStep(step4, 'Step 4: Professional Summary');
                renderSummary(step4, summaryResult.professional_summary);
            }

        } catch (err) {
            // Top-level error (steps 1, 2, or 4 failed entirely)
            const errEl = document.createElement('div');
            errEl.className = 'pipeline-step error';
            errEl.innerHTML = `
                <div class="pipeline-step-header"><h4>Error</h4></div>
                <div class="pipeline-step-body"><p style="color:var(--danger)">${escapeHtml(err.message)}</p></div>
            `;
            resultsContent.appendChild(errEl);
        } finally {
            generateBtn.disabled = false;
        }
    });
})();
