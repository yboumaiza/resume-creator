(function () {
    const generateBtn = document.getElementById('selection-btn');
    const resultsDiv = document.getElementById('selection-results');
    const resultsContent = document.getElementById('results-content');
    const expCheckboxes = document.getElementById('experience-checkboxes');
    const projCheckboxes = document.getElementById('project-checkboxes');

    // Editable results DOM refs
    const resultObjectiveSlot = document.getElementById('result-objective');
    const resultExperiencesSlot = document.getElementById('result-experiences');
    const resultProjectsSlot = document.getElementById('result-projects');

    const previewEmpty = document.getElementById('preview-empty');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const downloadPdfContainer = document.getElementById('download-pdf-container');

    let experiences = [];
    let projects = [];

    // --- Editable state ---

    let cachedJobAnalysis = null;
    let cachedSelectedExpIds = [];

    const editableResults = {
        objective: '',
        experiences: [],
        projects: [],
    };

    function resetEditableResults() {
        editableResults.objective = '';
        editableResults.experiences = [];
        editableResults.projects = [];
        cachedJobAnalysis = null;
        cachedSelectedExpIds = [];
        resultObjectiveSlot.innerHTML = '';
        resultObjectiveSlot.classList.add('hidden');
        resultExperiencesSlot.innerHTML = '';
        resultExperiencesSlot.classList.add('hidden');
        resultProjectsSlot.innerHTML = '';
        resultProjectsSlot.classList.add('hidden');
        downloadPdfContainer.classList.add('hidden');
    }

    function populateEditableItems(section, rankedItems, bulletsMap) {
        editableResults[section] = rankedItems.map(ri => ({
            key: ri.key,
            item: ri.item,
            type: ri.type,
            relevance_score: ri.relevance_score,
            skills: [...(ri.sorted_skills || [])],
            bullets: [...(bulletsMap[ri.key] || [])],
        }));
    }

    // --- Checkbox loading ---

    window.loadSelectionCheckboxes = async function () {
        // Skip reload if checkboxes already exist (preserves checked state)
        if (expCheckboxes.children.length > 0 || projCheckboxes.children.length > 0) {
            return;
        }
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

    function completeStep(stepEl, autoOpen) {
        const header = stepEl.querySelector('.step-header');
        header.querySelector('.spinner-sm').outerHTML = '<span class="step-check">&#10003;</span>';
        header.querySelector('.step-status-text').textContent = 'Done';
        if (autoOpen !== false) {
            stepEl.querySelector('.step-body').classList.add('open');
        }
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
        resetEditableResults();
        generateBtn.disabled = true;

        try {
            // Step 1: Analyze JD
            const jobAnalysis = await runAnalyzeJd(jobDescription);
            cachedJobAnalysis = jobAnalysis;
            cachedSelectedExpIds = selectedExpIds;

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

                populateEditableItems('experiences', expRanked, expBullets);
            }

            // Project group
            if (selectedProjIds.length) {
                appendStepGroup('Projects');
                const projRanked = await runFilterSort(jobAnalysis, selectedProjIds, 'project', stepNum);
                stepNum++;
                const projBullets = await runBullets(jobAnalysis, projRanked, allBullets, 'project', stepNum);
                Object.assign(allBullets, projBullets);
                stepNum++;

                populateEditableItems('projects', projRanked, projBullets);
            }

            // Objective
            await runObjective(jobAnalysis, allBullets, selectedExpIds, stepNum);

            // Render results in Preview tab and switch to it
            if (previewEmpty) previewEmpty.classList.add('hidden');
            renderEditableObjective();
            if (editableResults.experiences.length) renderEditableSection('experiences');
            if (editableResults.projects.length) renderEditableSection('projects');
            downloadPdfContainer.classList.remove('hidden');
            document.querySelector('.tab[data-tab="preview"]').click();

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
            const result = await api('selection&step=analyze-jd', 'POST', {
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

                const filterResult = await api('selection&step=filter-skills', 'POST', {
                    job_analysis: jobAnalysis,
                    item_type: typeName,
                    item_id: id,
                });

                updateStepStatus(stepEl, `Sorting ${i + 1}/${total}...`);

                let sortedSkills = filterResult.relevant_skills || [];
                if (sortedSkills.length > 1) {
                    const sortResult = await api('selection&step=sort-skills', 'POST', {
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

            body.innerHTML = `<p class="step-summary">${items.length} item${items.length !== 1 ? 's' : ''} ranked</p>`;
            completeStep(stepEl, false);
            return items;
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
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

                const result = await api('selection&step=bullets', 'POST', {
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
            }

            body.innerHTML = `<p class="step-summary">${rankedItems.length} item${rankedItems.length !== 1 ? 's' : ''} processed</p>`;
            completeStep(stepEl, false);
            return newBullets;
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    // --- Objective ---

    let generatedObjective = '';

    async function runObjective(jobAnalysis, allBullets, experienceIds, stepNum) {
        const stepEl = appendStep(`Step ${stepNum}: Generating objective...`);

        try {
            const result = await api('selection&step=objective', 'POST', {
                job_analysis: jobAnalysis,
                all_bullets: allBullets,
                experience_ids: experienceIds,
            });

            generatedObjective = result.objective || '';
            editableResults.objective = generatedObjective;
            completeStep(stepEl, false);
        } catch (err) {
            failStep(stepEl, err.message);
            throw err;
        }
    }

    // ===== Editable Results Rendering =====

    // --- Editable section (experiences or projects) ---

    function renderEditableSection(section) {
        const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
        const items = editableResults[section];
        const sectionLabel = section === 'experiences' ? 'Experience' : 'Projects';

        let html = `<h4 class="result-section-title">${sectionLabel}</h4>`;
        items.forEach((entry, idx) => {
            html += renderEditableItemCard(entry, section, idx);
        });

        slot.innerHTML = html;
        slot.classList.remove('hidden');
        attachEditableHandlers(slot, section);
    }

    function renderEditableItemCard(entry, section, idx) {
        const title = entry.type === 'experience'
            ? `${escapeHtml(entry.item.title)} \u2014 ${escapeHtml(entry.item.company)}`
            : escapeHtml(entry.item.name);
        const score = entry.relevance_score;
        const scoreClass = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';

        // Skills
        let skillsHtml = '<div class="editable-tags">';
        entry.skills.forEach((s, si) => {
            const isFirst = si === 0;
            const isLast = si === entry.skills.length - 1;
            skillsHtml += `
                <span class="tag editable-tag" data-section="${section}" data-item="${idx}" data-skill="${si}">
                    ${escapeHtml(s)}
                    <span class="tag-actions">
                        ${!isFirst ? '<button class="tag-action tag-up" title="Move up">&uarr;</button>' : ''}
                        ${!isLast ? '<button class="tag-action tag-down" title="Move down">&darr;</button>' : ''}
                        <button class="tag-action tag-edit" title="Edit">&#9998;</button>
                        <button class="tag-action tag-delete" title="Delete">&times;</button>
                    </span>
                </span>`;
        });
        skillsHtml += `<button class="tag-action tag-add" data-section="${section}" data-item="${idx}" title="Add skill">+</button>`;
        skillsHtml += '</div>';

        // Bullets
        let bulletsHtml = '<ul class="editable-bullets">';
        entry.bullets.forEach((b, bi) => {
            const isFirst = bi === 0;
            const isLast = bi === entry.bullets.length - 1;
            bulletsHtml += `
                <li class="editable-bullet" data-section="${section}" data-item="${idx}" data-bullet="${bi}">
                    <span class="bullet-text">${escapeHtml(b)}</span>
                    <span class="bullet-actions">
                        ${!isFirst ? '<button class="bullet-action bullet-up" title="Move up">&uarr;</button>' : ''}
                        ${!isLast ? '<button class="bullet-action bullet-down" title="Move down">&darr;</button>' : ''}
                        <button class="bullet-action bullet-edit" title="Edit">&#9998;</button>
                        <button class="bullet-action bullet-delete" title="Delete">&times;</button>
                    </span>
                </li>`;
        });
        bulletsHtml += '</ul>';
        bulletsHtml += `<button class="btn btn-sm bullet-add" data-section="${section}" data-item="${idx}">+ Add Bullet</button>`;

        return `
            <div class="editable-item-card" data-section="${section}" data-item="${idx}">
                <div class="editable-item-header">
                    <div class="editable-item-title">${title}</div>
                    <div class="editable-item-header-actions">
                        <button class="btn btn-sm item-regenerate" data-section="${section}" data-item="${idx}" title="Regenerate">&#8635; Regenerate</button>
                        <div class="ranked-item-score ${scoreClass}">${score}</div>
                    </div>
                </div>
                <div class="editable-item-skills">
                    <h5>Skills</h5>
                    ${skillsHtml}
                </div>
                <div class="editable-item-bullets">
                    <h5>Bullets</h5>
                    ${bulletsHtml}
                </div>
            </div>
        `;
    }

    // --- Editable objective ---

    function renderEditableObjective() {
        if (!editableResults.objective) return;
        resultObjectiveSlot.innerHTML = `
            <div class="editable-objective-card">
                <div class="objective-header">
                    <h4>Objective</h4>
                    <div>
                        <button class="btn btn-sm objective-regenerate">&#8635; Regenerate</button>
                        <button class="btn btn-sm objective-edit">&#9998; Edit</button>
                    </div>
                </div>
                <div class="objective-text">${escapeHtml(editableResults.objective)}</div>
            </div>
        `;
        resultObjectiveSlot.classList.remove('hidden');

        resultObjectiveSlot.querySelector('.objective-regenerate').addEventListener('click', async (e) => {
            if (!cachedJobAnalysis) {
                alert('No job analysis cached. Please run the full generation first.');
                return;
            }
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.textContent = 'Regenerating...';
            try {
                const allBullets = {};
                for (const sec of ['experiences', 'projects']) {
                    for (const entry of editableResults[sec]) {
                        allBullets[entry.key] = entry.bullets;
                    }
                }
                const result = await api('selection&step=objective', 'POST', {
                    job_analysis: cachedJobAnalysis,
                    all_bullets: allBullets,
                    experience_ids: cachedSelectedExpIds,
                });
                editableResults.objective = result.objective || '';
                generatedObjective = editableResults.objective;
                renderEditableObjective();
            } catch (err) {
                alert('Objective regeneration failed: ' + err.message);
                btn.disabled = false;
                btn.textContent = '\u21BB Regenerate';
            }
        });

        resultObjectiveSlot.querySelector('.objective-edit').addEventListener('click', () => {
            openModal('Edit Objective', `
                <div class="form-group">
                    <label>Objective</label>
                    <textarea name="objective-value" rows="4" required>${escapeHtml(editableResults.objective)}</textarea>
                </div>
            `, () => {
                const val = document.querySelector('#modal-form [name="objective-value"]').value.trim();
                if (val) {
                    editableResults.objective = val;
                    generatedObjective = val;
                    renderEditableObjective();
                }
                closeModal();
            });
        });
    }

    // --- Event delegation for editable items ---

    function attachEditableHandlers(container, section) {
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const tag = btn.closest('.editable-tag');
            const bullet = btn.closest('.editable-bullet');

            // Skill tag actions
            if (tag) {
                const itemIdx = parseInt(tag.dataset.item);
                const skillIdx = parseInt(tag.dataset.skill);
                if (btn.classList.contains('tag-delete')) {
                    deleteSkill(section, itemIdx, skillIdx);
                } else if (btn.classList.contains('tag-edit')) {
                    editSkillModal(section, itemIdx, skillIdx);
                } else if (btn.classList.contains('tag-up')) {
                    moveSkill(section, itemIdx, skillIdx, -1);
                } else if (btn.classList.contains('tag-down')) {
                    moveSkill(section, itemIdx, skillIdx, 1);
                }
                return;
            }

            // Add skill
            if (btn.classList.contains('tag-add')) {
                const itemIdx = parseInt(btn.dataset.item);
                addSkillModal(section, itemIdx);
                return;
            }

            // Bullet actions
            if (bullet) {
                const itemIdx = parseInt(bullet.dataset.item);
                const bulletIdx = parseInt(bullet.dataset.bullet);
                if (btn.classList.contains('bullet-delete')) {
                    deleteBullet(section, itemIdx, bulletIdx);
                } else if (btn.classList.contains('bullet-edit')) {
                    editBulletModal(section, itemIdx, bulletIdx);
                } else if (btn.classList.contains('bullet-up')) {
                    moveBullet(section, itemIdx, bulletIdx, -1);
                } else if (btn.classList.contains('bullet-down')) {
                    moveBullet(section, itemIdx, bulletIdx, 1);
                }
                return;
            }

            // Add bullet
            if (btn.classList.contains('bullet-add')) {
                const itemIdx = parseInt(btn.dataset.item);
                addBulletModal(section, itemIdx);
                return;
            }

            // Regenerate item
            if (btn.classList.contains('item-regenerate')) {
                const itemIdx = parseInt(btn.dataset.item);
                regenerateItem(section, itemIdx, btn);
                return;
            }
        });
    }

    async function regenerateItem(section, itemIdx, btn) {
        if (!cachedJobAnalysis) {
            alert('No job analysis cached. Please run the full generation first.');
            return;
        }

        const entry = editableResults[section][itemIdx];
        const typeName = entry.type;
        const itemId = parseInt(entry.key.split('_')[1]);

        btn.disabled = true;
        btn.textContent = 'Regenerating...';

        try {
            // Step 1: Filter skills
            const filterResult = await api('selection&step=filter-skills', 'POST', {
                job_analysis: cachedJobAnalysis,
                item_type: typeName,
                item_id: itemId,
            });

            // Step 2: Sort skills
            let sortedSkills = filterResult.relevant_skills || [];
            if (sortedSkills.length > 1) {
                const sortResult = await api('selection&step=sort-skills', 'POST', {
                    job_analysis: cachedJobAnalysis,
                    item_key: filterResult.item_key,
                    relevant_skills: sortedSkills,
                });
                sortedSkills = sortResult.sorted_skills || sortedSkills;
            }

            // Step 3: Generate bullets
            const previousBullets = {};
            for (const sec of ['experiences', 'projects']) {
                for (const e of editableResults[sec]) {
                    if (e.key !== entry.key) {
                        previousBullets[e.key] = e.bullets;
                    }
                }
            }

            const bulletResult = await api('selection&step=bullets', 'POST', {
                job_analysis: cachedJobAnalysis,
                item_key: entry.key,
                item: filterResult.item,
                item_type: typeName,
                sorted_skills: sortedSkills,
                previous_bullets: previousBullets,
            });

            // Update editable state
            editableResults[section][itemIdx].skills = [...sortedSkills];
            editableResults[section][itemIdx].bullets = [...(bulletResult.bullets || [])];
            editableResults[section][itemIdx].relevance_score = filterResult.relevance_score;
            editableResults[section][itemIdx].item = filterResult.item;

            rerenderItem(section, itemIdx);
        } catch (err) {
            alert('Regeneration failed: ' + err.message);
            btn.disabled = false;
            btn.textContent = '\u21BB Regenerate';
        }
    }

    // --- Mutation functions ---

    function rerenderItem(section, itemIdx) {
        const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
        const oldCard = slot.querySelector(`.editable-item-card[data-item="${itemIdx}"]`);
        if (!oldCard) return;
        const entry = editableResults[section][itemIdx];
        const temp = document.createElement('div');
        temp.innerHTML = renderEditableItemCard(entry, section, itemIdx);
        oldCard.replaceWith(temp.firstElementChild);
    }

    // Skills

    function deleteSkill(section, itemIdx, skillIdx) {
        editableResults[section][itemIdx].skills.splice(skillIdx, 1);
        rerenderItem(section, itemIdx);
    }

    function moveSkill(section, itemIdx, skillIdx, direction) {
        const skills = editableResults[section][itemIdx].skills;
        const newIdx = skillIdx + direction;
        if (newIdx < 0 || newIdx >= skills.length) return;
        [skills[skillIdx], skills[newIdx]] = [skills[newIdx], skills[skillIdx]];
        rerenderItem(section, itemIdx);
    }

    function editSkillModal(section, itemIdx, skillIdx) {
        const current = editableResults[section][itemIdx].skills[skillIdx];
        openModal('Edit Skill', `
            <div class="form-group">
                <label>Skill</label>
                <input type="text" name="skill-value" value="${escapeHtml(current)}" required>
            </div>
        `, () => {
            const val = document.querySelector('#modal-form [name="skill-value"]').value.trim();
            if (val) {
                editableResults[section][itemIdx].skills[skillIdx] = val;
                rerenderItem(section, itemIdx);
            }
            closeModal();
        });
    }

    function addSkillModal(section, itemIdx) {
        const entry = editableResults[section][itemIdx];
        const allSkills = entry.item.skills || [];
        const currentSkills = entry.skills || [];
        const currentSkillsLower = currentSkills.map(s => s.toLowerCase());
        const availableSkills = allSkills.filter(s => !currentSkillsLower.includes(s.toLowerCase()));

        let fieldsHtml = '';

        if (availableSkills.length > 0) {
            fieldsHtml += '<div class="form-group"><label>Select from existing skills</label><div class="skill-options">';
            availableSkills.forEach(skill => {
                fieldsHtml += `<label class="skill-option">
                    <input type="checkbox" name="skill-select" value="${escapeHtml(skill)}">
                    <span class="skill-option-label">${escapeHtml(skill)}</span>
                </label>`;
            });
            fieldsHtml += '</div></div>';
        }

        fieldsHtml += `<div class="form-group">
            <label>${availableSkills.length > 0 ? 'Or enter a custom skill' : 'Skill'}</label>
            <input type="text" name="skill-value" placeholder="Enter skill name">
        </div>`;

        openModal('Add Skill', fieldsHtml, () => {
            const selectedCheckboxes = Array.from(
                document.querySelectorAll('#modal-form [name="skill-select"]:checked')
            ).map(cb => cb.value);

            const customVal = document.querySelector('#modal-form [name="skill-value"]').value.trim();

            const newSkills = [...selectedCheckboxes];
            if (customVal && !newSkills.includes(customVal)) {
                newSkills.push(customVal);
            }

            if (newSkills.length > 0) {
                editableResults[section][itemIdx].skills.push(...newSkills);
                rerenderItem(section, itemIdx);
            }
            closeModal();
        });
    }

    // Bullets

    function deleteBullet(section, itemIdx, bulletIdx) {
        editableResults[section][itemIdx].bullets.splice(bulletIdx, 1);
        rerenderItem(section, itemIdx);
    }

    function moveBullet(section, itemIdx, bulletIdx, direction) {
        const bullets = editableResults[section][itemIdx].bullets;
        const newIdx = bulletIdx + direction;
        if (newIdx < 0 || newIdx >= bullets.length) return;
        [bullets[bulletIdx], bullets[newIdx]] = [bullets[newIdx], bullets[bulletIdx]];
        rerenderItem(section, itemIdx);
    }

    function editBulletModal(section, itemIdx, bulletIdx) {
        const current = editableResults[section][itemIdx].bullets[bulletIdx];
        openModal('Edit Bullet', `
            <div class="form-group">
                <label>Bullet Point</label>
                <textarea name="bullet-value" rows="3" required>${escapeHtml(current)}</textarea>
            </div>
        `, () => {
            const val = document.querySelector('#modal-form [name="bullet-value"]').value.trim();
            if (val) {
                editableResults[section][itemIdx].bullets[bulletIdx] = val;
                rerenderItem(section, itemIdx);
            }
            closeModal();
        });
    }

    function addBulletModal(section, itemIdx) {
        openModal('Add Bullet', `
            <div class="form-group">
                <label>Bullet Point</label>
                <textarea name="bullet-value" rows="3" required placeholder="Enter bullet point"></textarea>
            </div>
        `, () => {
            const val = document.querySelector('#modal-form [name="bullet-value"]').value.trim();
            if (val) {
                editableResults[section][itemIdx].bullets.push(val);
                rerenderItem(section, itemIdx);
            }
            closeModal();
        });
    }

    // --- Download PDF ---

    downloadPdfBtn.addEventListener('click', async () => {
        downloadPdfBtn.disabled = true;
        downloadPdfBtn.textContent = 'Generating PDF...';

        try {
            const response = await fetch('api/?route=export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ editableResults }),
            });

            if (!response.ok) {
                let errMsg = 'PDF generation failed';
                try {
                    const errData = await response.json();
                    errMsg = errData.error || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resume.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('PDF download failed: ' + err.message);
        } finally {
            downloadPdfBtn.disabled = false;
            downloadPdfBtn.textContent = 'Download PDF';
        }
    });
})();