(function () {
    const generateBtn = document.getElementById('generate-btn');
    const resultsDiv = document.getElementById('generate-results');
    const resultsContent = document.getElementById('results-content');
    const expCheckboxes = document.getElementById('experience-checkboxes');
    const projCheckboxes = document.getElementById('project-checkboxes');

    let experiences = [];
    let projects = [];

    // --- Checkbox loading ---

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

    // --- Step UI helpers ---

    function appendStep(label) {
        const step = document.createElement('div');
        step.className = 'pipeline-step';
        step.innerHTML = `
            <div class="step-header">
                <div class="spinner-sm"></div>
                <span class="step-label">${escapeHtml(label)}</span>
                <span class="step-status-text">Running...</span>
            </div>
            <div class="step-body"></div>
        `;
        step.querySelector('.step-header').addEventListener('click', () => {
            step.querySelector('.step-body').classList.toggle('open');
        });
        resultsContent.appendChild(step);
        return step;
    }

    function appendStepGroup(label) {
        const group = document.createElement('div');
        group.className = 'step-group-header';
        group.innerHTML = `<span>${escapeHtml(label)}</span>`;
        resultsContent.appendChild(group);
    }

    function completeStep(stepEl) {
        const header = stepEl.querySelector('.step-header');
        header.querySelector('.spinner-sm').outerHTML = '<span class="step-check">&#10003;</span>';
        header.querySelector('.step-status-text').textContent = 'Done';
        stepEl.querySelector('.step-body').classList.add('open');
    }

    function failStep(stepEl, message) {
        const header = stepEl.querySelector('.step-header');
        header.querySelector('.spinner-sm')?.remove();
        const existing = header.querySelector('.step-check');
        if (existing) existing.remove();
        const icon = document.createElement('span');
        icon.className = 'step-error-icon';
        icon.innerHTML = '&#10007;';
        header.prepend(icon);
        header.querySelector('.step-status-text').textContent = 'Failed';
        const body = stepEl.querySelector('.step-body');
        body.innerHTML += `<div class="step-error">${escapeHtml(message)}</div>`;
        body.classList.add('open');
    }

    function getStepBody(stepEl) {
        return stepEl.querySelector('.step-body');
    }

    function updateStepStatus(stepEl, text) {
        stepEl.querySelector('.step-status-text').textContent = text;
    }

    // --- Pipeline ---

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

        resultsContent.innerHTML = '';
        resultsDiv.classList.remove('hidden');
        generateBtn.disabled = true;

        try {
            // Step 1: Analyze JD
            const jobAnalysis = await runAnalyzeJd(jobDescription);

            let allBullets = {};
            let stepNum = 2;

            // Experience group
            if (selectedExpIds.length) {
                appendStepGroup('Experience');
                const expRanked = await runFilterSort(jobAnalysis, selectedExpIds, 'experience', stepNum);
                stepNum++;
                const expBullets = await runBullets(jobAnalysis, expRanked, allBullets, 'experience', stepNum);
                Object.assign(allBullets, expBullets);
                stepNum++;
            }

            // Project group
            if (selectedProjIds.length) {
                appendStepGroup('Projects');
                const projRanked = await runFilterSort(jobAnalysis, selectedProjIds, 'project', stepNum);
                stepNum++;
                const projBullets = await runBullets(jobAnalysis, projRanked, allBullets, 'project', stepNum);
                Object.assign(allBullets, projBullets);
                stepNum++;
            }

            // Objective
            await runObjective(jobAnalysis, allBullets, selectedExpIds, stepNum);
            stepNum++;

            // ATS check
            await runAtsCheck(jobAnalysis, allBullets, stepNum);

        } catch (err) {
            // Pipeline halted — error already shown in the failing step
        } finally {
            generateBtn.disabled = false;
        }
    });

    // --- Analyze JD ---

    async function runAnalyzeJd(jobDescription) {
        const stepEl = appendStep('Step 1: Analyzing job description...');
        try {
            const result = await api('generate&step=analyze-jd', 'POST', {
                job_description: jobDescription,
            });
            renderJobAnalysis(getStepBody(stepEl), result.job_analysis);
            completeStep(stepEl);
            return result.job_analysis;
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    function renderJobAnalysis(body, analysis) {
        let html = '<div class="analysis-group">';
        html += `<span class="badge seniority-badge">${escapeHtml(analysis.seniority_level || 'Unknown')}</span> `;
        html += `<span class="badge employment-badge">${escapeHtml(analysis.employment_type || 'Full-time')}</span>`;
        html += '</div>';

        if (analysis.required_skills?.length) {
            html += '<div class="analysis-group"><h5>Required Skills</h5><div class="tags">';
            html += analysis.required_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('');
            html += '</div></div>';
        }

        if (analysis.preferred_skills?.length) {
            html += '<div class="analysis-group"><h5>Preferred Skills</h5><div class="tags">';
            html += analysis.preferred_skills.map(s => `<span class="tag tag-preferred">${escapeHtml(s)}</span>`).join('');
            html += '</div></div>';
        }

        if (analysis.key_responsibilities?.length) {
            html += '<div class="analysis-group"><h5>Key Responsibilities</h5><ul>';
            html += analysis.key_responsibilities.map(r => `<li>${escapeHtml(r)}</li>`).join('');
            html += '</ul></div>';
        }

        body.innerHTML = html;
    }

    // --- Filter & sort skills ---

    async function runFilterSort(jobAnalysis, itemIds, typeName, stepNum) {
        const typeLabel = typeName === 'experience' ? 'Experience' : 'Projects';
        const stepEl = appendStep(`Step ${stepNum}: ${typeLabel} \u2014 Filter & sort skills...`);
        const body = getStepBody(stepEl);
        const items = [];

        try {
            const total = itemIds.length;

            for (let i = 0; i < itemIds.length; i++) {
                const id = itemIds[i];
                updateStepStatus(stepEl, `Filtering ${i + 1}/${total}...`);

                const filterResult = await api('generate&step=filter-skills', 'POST', {
                    job_analysis: jobAnalysis,
                    item_type: typeName,
                    item_id: id,
                });

                updateStepStatus(stepEl, `Sorting ${i + 1}/${total}...`);

                let sortedSkills = filterResult.relevant_skills || [];
                if (sortedSkills.length > 1) {
                    const sortResult = await api('generate&step=sort-skills', 'POST', {
                        job_analysis: jobAnalysis,
                        item_key: filterResult.item_key,
                        relevant_skills: sortedSkills,
                    });
                    sortedSkills = sortResult.sorted_skills || sortedSkills;
                }

                items.push({
                    key: filterResult.item_key,
                    type: typeName,
                    item: filterResult.item,
                    relevance_score: filterResult.relevance_score,
                    sorted_skills: sortedSkills,
                });
            }

            // Sort by relevance score descending within this type
            items.sort((a, b) => b.relevance_score - a.relevance_score);

            renderRankedItems(body, items);
            completeStep(stepEl);
            return items;
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    function renderRankedItems(body, items) {
        let html = '';
        for (const item of items) {
            const score = item.relevance_score;
            const scoreClass = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
            const title = item.type === 'experience'
                ? `${escapeHtml(item.item.title)} at ${escapeHtml(item.item.company)}`
                : escapeHtml(item.item.name);

            html += `
                <div class="ranked-item">
                    <div class="ranked-item-score ${scoreClass}">${score}</div>
                    <div class="ranked-item-info">
                        <div class="ranked-item-title">${title}</div>
                        ${item.sorted_skills.length
                            ? `<div class="tags">${item.sorted_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>`
                            : '<div class="ranked-item-sub">No relevant skills</div>'}
                    </div>
                </div>
            `;
        }
        body.innerHTML = html;
    }

    // --- Generate bullets ---

    async function runBullets(jobAnalysis, rankedItems, previousBullets, typeName, stepNum) {
        const typeLabel = typeName === 'experience' ? 'Experience' : 'Projects';
        const stepEl = appendStep(`Step ${stepNum}: ${typeLabel} \u2014 Generate bullets...`);
        const body = getStepBody(stepEl);
        const newBullets = {};
        const currentBullets = Object.assign({}, previousBullets);

        try {
            for (let i = 0; i < rankedItems.length; i++) {
                const item = rankedItems[i];
                updateStepStatus(stepEl, `Item ${i + 1}/${rankedItems.length}...`);

                const result = await api('generate&step=bullets', 'POST', {
                    job_analysis: jobAnalysis,
                    item_key: item.key,
                    item: item.item,
                    item_type: typeName,
                    sorted_skills: item.sorted_skills,
                    previous_bullets: currentBullets,
                });

                const bullets = result.bullets || [];
                newBullets[item.key] = bullets;
                currentBullets[item.key] = bullets;

                renderBulletCard(body, item, bullets);
            }

            completeStep(stepEl);
            return newBullets;
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    function renderBulletCard(body, item, bullets) {
        const title = item.type === 'experience'
            ? `${escapeHtml(item.item.title)} \u2014 ${escapeHtml(item.item.company)}`
            : escapeHtml(item.item.name);
        const bulletText = bullets.map(b => `\u2022 ${b}`).join('\n');

        const card = document.createElement('div');
        card.className = 'bullet-card';
        card.innerHTML = `
            <div class="bullet-card-header">
                <h5>${title}</h5>
                <button class="btn-copy">Copy</button>
            </div>
            ${item.sorted_skills.length
                ? `<div class="tags" style="margin-bottom:8px">${item.sorted_skills.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>`
                : ''}
            <ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
        `;
        card.querySelector('.btn-copy').addEventListener('click', function () {
            copyToClipboard(bulletText, this);
        });
        body.appendChild(card);
    }

    // --- Objective ---

    let generatedObjective = '';

    async function runObjective(jobAnalysis, allBullets, experienceIds, stepNum) {
        const stepEl = appendStep(`Step ${stepNum}: Generating objective...`);

        try {
            const result = await api('generate&step=objective', 'POST', {
                job_analysis: jobAnalysis,
                all_bullets: allBullets,
                experience_ids: experienceIds,
            });

            generatedObjective = result.objective || '';
            const body = getStepBody(stepEl);
            body.innerHTML = `
                <div class="objective-header">
                    <h5>Resume Objective</h5>
                    <button class="btn-copy">Copy</button>
                </div>
                <div class="objective-text">${escapeHtml(generatedObjective)}</div>
            `;
            body.querySelector('.btn-copy').addEventListener('click', function () {
                copyToClipboard(generatedObjective, this);
            });
            completeStep(stepEl);
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    // --- ATS check ---

    async function runAtsCheck(jobAnalysis, allBullets, stepNum) {
        const stepEl = appendStep(`Step ${stepNum}: Checking ATS keywords...`);

        try {
            const result = await api('generate&step=ats-check', 'POST', {
                job_analysis: jobAnalysis,
                all_bullets: allBullets,
                objective: generatedObjective,
            });

            renderAtsCheck(getStepBody(stepEl), result.ats_result);
            completeStep(stepEl);
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    function renderAtsCheck(body, atsResult) {
        let html = '';

        // Coverage meter
        const pct = atsResult.keyword_coverage_pct || 0;
        const meterColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';
        html += `
            <div class="ats-coverage">
                <div class="ats-coverage-label">Keyword Coverage: <strong>${pct}%</strong></div>
                <div class="ats-meter">
                    <div class="ats-meter-fill" style="width:${pct}%;background:${meterColor}"></div>
                </div>
            </div>
        `;

        if (atsResult.matched_keywords?.length) {
            html += '<div class="analysis-group"><h5>Matched Keywords</h5><div class="tags">';
            html += atsResult.matched_keywords.map(k => `<span class="tag tag-matched">${escapeHtml(k)}</span>`).join('');
            html += '</div></div>';
        }

        if (atsResult.missing_keywords?.length) {
            html += '<div class="analysis-group"><h5>Missing Keywords</h5><div class="tags">';
            html += atsResult.missing_keywords.map(k => `<span class="tag tag-missing">${escapeHtml(k)}</span>`).join('');
            html += '</div></div>';
        }

        if (atsResult.suggestions?.length) {
            html += '<div class="analysis-group"><h5>Suggestions</h5><ul class="ats-suggestions">';
            for (const s of atsResult.suggestions) {
                html += `<li><strong>${escapeHtml(s.keyword)}:</strong> ${escapeHtml(s.suggestion)}</li>`;
            }
            html += '</ul></div>';
        }

        body.innerHTML = html;
    }
})();
