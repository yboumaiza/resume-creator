(function () {
    const generateBtn = document.getElementById('selection-btn');
    const resultsDiv = document.getElementById('selection-results');
    const resultsContent = document.getElementById('results-content');
    const expCheckboxes = document.getElementById('experience-checkboxes');
    const projCheckboxes = document.getElementById('project-checkboxes');
    const providerSelect = document.getElementById('ai-provider');
    const autoSelectBtn = document.getElementById('auto-select-btn');

    // Editable results DOM refs
    const resultObjectiveSlot = document.getElementById('result-objective');
    const resultExperiencesSlot = document.getElementById('result-experiences');
    const resultProjectsSlot = document.getElementById('result-projects');
    const resultCuratedSkillsSlot = document.getElementById('result-curated-skills');

    const previewEmpty = document.getElementById('preview-empty');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');

    const analyzeBtn = document.getElementById('analyze-resume-btn');
    const holisticBar = document.getElementById('holistic-findings-bar');
    const applyBar = document.getElementById('analyzer-apply-bar');

    let experiences = [];
    let projects = [];

    // --- Editable state ---

    let analyzerFindings = [];
    let cachedJobAnalysis = null;
    let cachedSelectedExpIds = [];
    let pipelineState = null;

    const editableResults = {
        objective: '',
        experiences: [],
        projects: [],
        curatedSkills: [],
    };

    // --- localStorage state cache ---

    const CACHE_KEY = 'resumeBuilder_state';

    function saveStateToCache() {
        const state = {
            jobDescription: document.getElementById('job-description').value,
            selectedExpIds: Array.from(expCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value)),
            selectedProjIds: Array.from(projCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value)),
            provider: providerSelect.value,
            editableResults: {
                objective: editableResults.objective,
                experiences: editableResults.experiences,
                projects: editableResults.projects,
                curatedSkills: editableResults.curatedSkills,
            },
            analyzerFindings,
            cachedJobAnalysis,
            cachedSelectedExpIds,
        };
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(state));
        } catch (e) {
            // Silently fail (quota exceeded, private browsing, etc.)
        }
    }

    function loadStateFromCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function clearStateCache() {
        localStorage.removeItem(CACHE_KEY);
    }

    let _saveTimer = null;
    function debouncedSave() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(saveStateToCache, 500);
    }

    function resetEditableResults() {
        editableResults.objective = '';
        editableResults.experiences = [];
        editableResults.projects = [];
        editableResults.curatedSkills = [];
        cachedJobAnalysis = null;
        cachedSelectedExpIds = [];
        pipelineState = null;
        clearStateCache();
        resultObjectiveSlot.innerHTML = '';
        resultObjectiveSlot.classList.add('hidden');
        resultExperiencesSlot.innerHTML = '';
        resultExperiencesSlot.classList.add('hidden');
        resultProjectsSlot.innerHTML = '';
        resultProjectsSlot.classList.add('hidden');
        resultCuratedSkillsSlot.innerHTML = '';
        resultCuratedSkillsSlot.classList.add('hidden');
        downloadPdfBtn.disabled = true;
        analyzerFindings = [];
        analyzeBtn.disabled = true;
        holisticBar.innerHTML = '';
        holisticBar.classList.add('hidden');
        applyBar.classList.add('hidden');
        clearAllItemFindings();
        document.getElementById('tab-build').classList.remove('analyzer-active');
    }

    function populateEditableItems(section, rankedItems, bulletsMap) {
        editableResults[section] = rankedItems.map(ri => ({
            key: ri.key,
            item: ri.item,
            type: ri.type,
            relevance_score: ri.relevance_score,
            skills: [...(ri.sorted_skills || [])],
            classified_skills: [...(ri.classified_skills || [])],
            bullets: [...(bulletsMap[ri.key] || [])],
        }));
    }

    // --- Provider loading ---

    async function loadProviders() {
        try {
            const result = await api('providers');
            const providers = result.providers || [];
            providerSelect.innerHTML = '';

            let hasSelected = false;
            providers.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id;
                option.textContent = p.name + (p.ready ? '' : ' (not configured)');
                option.disabled = !p.ready;
                if (p.ready && !hasSelected) {
                    option.selected = true;
                    hasSelected = true;
                }
                providerSelect.appendChild(option);
            });

            if (!hasSelected) {
                providerSelect.innerHTML = '<option value="" disabled selected>No providers available</option>';
            }

            // Restore cached provider selection
            const cached = loadStateFromCache();
            if (cached?.provider) {
                const opt = providerSelect.querySelector(`option[value="${cached.provider}"]`);
                if (opt && !opt.disabled) {
                    providerSelect.value = cached.provider;
                }
            }
        } catch (err) {
            providerSelect.innerHTML = '<option value="" disabled selected>Failed to load</option>';
        }
    }

    function selectionApi(step, body = {}) {
        return api('selection&step=' + step, 'POST', {
            ...body,
            provider: providerSelect.value,
        });
    }

    // --- Checkbox loading ---

    window.loadSelectionCheckboxes = async function () {
        // Skip reload if checkboxes already exist (preserves checked state)
        if (expCheckboxes.children.length > 0 || projCheckboxes.children.length > 0) {
            return;
        }
        try {
            loadProviders();
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
            updateButtonStates();
            updateStepper(deriveWorkflowStep());

            // Restore cached state after checkboxes and providers are ready
            restoreFromCache();
        } catch (err) {
            expCheckboxes.innerHTML = '<p class="empty-state">Failed to load.</p>';
            projCheckboxes.innerHTML = '<p class="empty-state">Failed to load.</p>';
        }
    };

    function restoreFromCache() {
        const cached = loadStateFromCache();
        if (!cached) return;

        // 1. Restore job description
        if (cached.jobDescription) {
            document.getElementById('job-description').value = cached.jobDescription;
        }

        // 2. Restore checkbox selections
        if (cached.selectedExpIds?.length) {
            const ids = new Set(cached.selectedExpIds.map(String));
            expCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = ids.has(cb.value);
            });
        }
        if (cached.selectedProjIds?.length) {
            const ids = new Set(cached.selectedProjIds.map(String));
            projCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = ids.has(cb.value);
            });
        }

        // 3. Restore AI provider
        if (cached.provider) {
            const opt = providerSelect.querySelector(`option[value="${cached.provider}"]`);
            if (opt && !opt.disabled) {
                providerSelect.value = cached.provider;
            }
        }

        // 4. Restore generated content
        if (cached.editableResults) {
            const er = cached.editableResults;
            editableResults.objective = er.objective || '';
            editableResults.experiences = er.experiences || [];
            editableResults.projects = er.projects || [];
            editableResults.curatedSkills = er.curatedSkills || [];
        }

        // 5. Restore analysis state
        if (cached.analyzerFindings) analyzerFindings = cached.analyzerFindings;
        if (cached.cachedJobAnalysis) cachedJobAnalysis = cached.cachedJobAnalysis;
        if (cached.cachedSelectedExpIds) cachedSelectedExpIds = cached.cachedSelectedExpIds;

        // 6. Re-render if there's content
        const hasContent = editableResults.objective ||
            editableResults.experiences.length > 0 ||
            editableResults.projects.length > 0;

        if (hasContent) {
            if (previewEmpty) previewEmpty.classList.add('hidden');
            renderEditableObjective();
            if (editableResults.experiences.length) renderEditableSection('experiences');
            if (editableResults.projects.length) renderEditableSection('projects');
            if (editableResults.curatedSkills.length) renderEditableCuratedSkills();
        }

        // 7. If analyzer was active, restore analyzer UI state
        if (analyzerFindings.length) {
            document.getElementById('tab-build').classList.add('analyzer-active');
            renderAnalyzerResults();
        }

        updateButtonStates();
        updateStepper(deriveWorkflowStep());
    }

    // --- Auto-Select ---

    autoSelectBtn.addEventListener('click', async () => {
        const jd = document.getElementById('job-description').value.trim();
        if (!jd) {
            alert('Please paste a job description first.');
            return;
        }

        const hasItems = experiences.length > 0 || projects.length > 0;
        if (!hasItems) {
            alert('No experiences or projects to select from. Add some first.');
            return;
        }

        autoSelectBtn.disabled = true;
        autoSelectBtn.textContent = 'Selecting...';

        try {
            const result = await selectionApi('auto-select', { job_description: jd });
            const selectedExpIds = new Set((result.selected_experience_ids || []).map(String));
            const selectedProjIds = new Set((result.selected_project_ids || []).map(String));

            expCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = selectedExpIds.has(cb.value);
            });
            projCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = selectedProjIds.has(cb.value);
            });
            updateButtonStates();
            updateStepper(deriveWorkflowStep());
            debouncedSave();
        } catch (err) {
            alert('Auto-select failed: ' + (err.message || err));
        } finally {
            autoSelectBtn.disabled = false;
            autoSelectBtn.textContent = 'Auto-Select';
        }
    });

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

    function failStep(stepEl, message, detail = null) {
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

        if (detail) {
            const typeLabels = {
                connection_error: 'Connection Error',
                http_error: 'HTTP Error',
                invalid_json: 'Invalid JSON',
                format_error: 'Format Error',
            };
            const label = typeLabels[detail.type] || detail.type || 'Error';

            let metaHtml = '';
            if (detail.provider) metaHtml += `<span>Provider: ${escapeHtml(detail.provider)}</span>`;
            if (detail.model) metaHtml += `<span>Model: ${escapeHtml(detail.model)}</span>`;
            if (detail.http_code) metaHtml += `<span>HTTP ${detail.http_code}</span>`;
            if (detail.endpoint) metaHtml += `<span>${escapeHtml(detail.endpoint)}</span>`;

            let rawHtml = '';
            if (detail.raw_response) {
                rawHtml = `
                    <details class="error-raw-details">
                        <summary>Raw Response</summary>
                        <pre class="error-raw-response">${escapeHtml(detail.raw_response)}</pre>
                    </details>`;
            }

            body.innerHTML += `
                <div class="step-error-panel">
                    <span class="error-type-badge error-type-${escapeHtml(detail.type || '')}">${escapeHtml(label)}</span>
                    <div class="error-message">${escapeHtml(message)}</div>
                    <div class="error-meta">${metaHtml}</div>
                    ${rawHtml}
                </div>`;
        } else {
            body.innerHTML += `<div class="step-error">${escapeHtml(message)}</div>`;
        }

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

        await runPipeline(null, jobDescription, selectedExpIds, selectedProjIds);

        generateBtn.disabled = false;
    });

    function appendResumeButton() {
        const failedIcons = resultsContent.querySelectorAll('.step-error-icon');
        if (!failedIcons.length) return;
        const failedStep = failedIcons[failedIcons.length - 1].closest('.pipeline-step');
        const body = failedStep.querySelector('.step-body');

        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-resume';
        btn.innerHTML = '&#9654; Resume from here';
        btn.addEventListener('click', handleResume);
        body.appendChild(btn);
    }

    async function handleResume() {
        if (!pipelineState) return;

        const currentJd = document.getElementById('job-description').value.trim();
        const currentExpIds = Array.from(expCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
        const currentProjIds = Array.from(projCheckboxes.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));

        const inputsChanged = (
            currentJd !== pipelineState.inputs.jobDescription ||
            JSON.stringify([...currentExpIds].sort()) !== JSON.stringify([...pipelineState.inputs.selectedExpIds].sort()) ||
            JSON.stringify([...currentProjIds].sort()) !== JSON.stringify([...pipelineState.inputs.selectedProjIds].sort())
        );

        if (inputsChanged) {
            if (!confirm('Inputs have changed since generation started. Resuming may produce inconsistent results.\n\nClick OK to resume anyway, or Cancel to start fresh with Generate.')) {
                return;
            }
        }

        const failedIcons = resultsContent.querySelectorAll('.step-error-icon');
        if (failedIcons.length) {
            failedIcons[failedIcons.length - 1].closest('.pipeline-step').remove();
        }

        generateBtn.disabled = true;
        await runPipeline(
            pipelineState,
            pipelineState.inputs.jobDescription,
            pipelineState.inputs.selectedExpIds,
            pipelineState.inputs.selectedProjIds
        );
        generateBtn.disabled = false;
    }

    async function runPipeline(resumeFrom, jobDescription, selectedExpIds, selectedProjIds) {
        const phases = ['analyzeJd'];
        if (selectedExpIds.length) phases.push('expFilterSort', 'expBullets');
        if (selectedProjIds.length) phases.push('projFilterSort', 'projBullets');
        phases.push('curateSkills', 'objective');

        const startPhaseIdx = resumeFrom ? phases.indexOf(resumeFrom.failedPhase) : 0;

        let jobAnalysis = resumeFrom?.jobAnalysis ?? null;
        let allBullets = resumeFrom ? { ...resumeFrom.allBullets } : {};
        let expRanked = resumeFrom?.expRanked ?? null;
        let expBullets = resumeFrom?.expBullets ?? null;
        let projRanked = resumeFrom?.projRanked ?? null;
        let projBullets = resumeFrom?.projBullets ?? null;
        let stepNum = resumeFrom?.stepNum ?? 1;

        const inputs = { jobDescription, selectedExpIds: [...selectedExpIds], selectedProjIds: [...selectedProjIds] };
        let currentPhase = null;

        try {
            if (!resumeFrom) {
                await selectionApi('unload-model', {}).catch(() => {});
            }

            for (let pi = startPhaseIdx; pi < phases.length; pi++) {
                currentPhase = phases[pi];
                const isResumedPhase = pi === startPhaseIdx && resumeFrom != null;
                const itemStartIdx = isResumedPhase ? (resumeFrom.failedItemIndex || 0) : 0;

                switch (currentPhase) {
                    case 'analyzeJd':
                        stepNum = 1;
                        jobAnalysis = await runAnalyzeJd(jobDescription);
                        cachedJobAnalysis = jobAnalysis;
                        cachedSelectedExpIds = selectedExpIds;
                        stepNum = 2;
                        break;

                    case 'expFilterSort':
                        if (!isResumedPhase) appendStepGroup('Experience');
                        expRanked = await runFilterSort(jobAnalysis, selectedExpIds, 'experience', stepNum,
                            itemStartIdx, isResumedPhase ? (resumeFrom.expRanked || []) : []);
                        stepNum++;
                        break;

                    case 'expBullets':
                        expBullets = await runBullets(jobAnalysis, expRanked, allBullets, 'experience', stepNum,
                            itemStartIdx, isResumedPhase ? (resumeFrom.expBullets || {}) : {});
                        Object.assign(allBullets, expBullets);
                        populateEditableItems('experiences', expRanked, expBullets);
                        stepNum++;
                        break;

                    case 'projFilterSort':
                        if (!isResumedPhase) appendStepGroup('Projects');
                        projRanked = await runFilterSort(jobAnalysis, selectedProjIds, 'project', stepNum,
                            itemStartIdx, isResumedPhase ? (resumeFrom.projRanked || []) : []);
                        stepNum++;
                        break;

                    case 'projBullets':
                        projBullets = await runBullets(jobAnalysis, projRanked, allBullets, 'project', stepNum,
                            itemStartIdx, isResumedPhase ? (resumeFrom.projBullets || {}) : {});
                        Object.assign(allBullets, projBullets);
                        populateEditableItems('projects', projRanked, projBullets);
                        stepNum++;
                        break;

                    case 'curateSkills':
                        await runCurateSkills(jobAnalysis, stepNum);
                        stepNum++;
                        break;

                    case 'objective':
                        await runObjective(jobAnalysis, allBullets, selectedExpIds, stepNum);
                        break;
                }
            }

            // Success — clear resume state, render preview
            pipelineState = null;
            if (previewEmpty) previewEmpty.classList.add('hidden');
            renderEditableObjective();
            if (editableResults.experiences.length) renderEditableSection('experiences');
            if (editableResults.projects.length) renderEditableSection('projects');
            renderEditableCuratedSkills();
            downloadPdfBtn.disabled = false;
            analyzeBtn.disabled = false;
            updateButtonStates();
            updateStepper(deriveWorkflowStep());

        } catch (err) {
            pipelineState = {
                inputs,
                failedPhase: currentPhase,
                failedItemIndex: err._failedItemIndex || 0,
                jobAnalysis,
                allBullets: { ...allBullets },
                expRanked: (currentPhase === 'expFilterSort' && err._partialResult) ? err._partialResult : expRanked,
                expBullets: (currentPhase === 'expBullets' && err._partialResult) ? err._partialResult : expBullets,
                projRanked: (currentPhase === 'projFilterSort' && err._partialResult) ? err._partialResult : projRanked,
                projBullets: (currentPhase === 'projBullets' && err._partialResult) ? err._partialResult : projBullets,
                stepNum,
            };
            appendResumeButton();
        }
    }

    // --- Analyze JD ---

    async function runAnalyzeJd(jobDescription) {
        const stepEl = appendStep('Step 1: Analyzing job description...');
        try {
            const result = await selectionApi('analyze-jd', {
                job_description: jobDescription,
            });
            renderJobAnalysis(getStepBody(stepEl), result.job_analysis);
            completeStep(stepEl);
            return result.job_analysis;
        } catch (err) {
            failStep(stepEl, err.message, err.detail);
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

    async function runFilterSort(jobAnalysis, itemIds, typeName, stepNum, startIndex = 0, priorItems = []) {
        const typeLabel = typeName === 'experience' ? 'Experience' : 'Projects';
        const stepEl = appendStep(`Step ${stepNum}: ${typeLabel} \u2014 Filter & sort skills${startIndex > 0 ? ' (resuming)' : ''}...`);
        const body = getStepBody(stepEl);
        const items = [...priorItems];
        let lastIndex = startIndex;

        try {
            const total = itemIds.length;

            for (let i = startIndex; i < itemIds.length; i++) {
                lastIndex = i;
                const id = itemIds[i];
                updateStepStatus(stepEl, `Filtering ${i + 1}/${total}...`);

                const filterResult = await selectionApi('filter-skills', {
                    job_analysis: jobAnalysis,
                    item_type: typeName,
                    item_id: id,
                });

                updateStepStatus(stepEl, `Sorting ${i + 1}/${total}...`);

                let sortedSkills = filterResult.relevant_skills || [];
                let classifiedSkills = [];
                if (sortedSkills.length > 1) {
                    const sortResult = await selectionApi('sort-skills', {
                        job_analysis: jobAnalysis,
                        item_key: filterResult.item_key,
                        relevant_skills: sortedSkills,
                    });
                    sortedSkills = sortResult.sorted_skills || sortedSkills;
                    classifiedSkills = sortResult.classified_skills || [];
                } else {
                    classifiedSkills = sortedSkills.map(s => ({ name: s, type: 'tool' }));
                }

                items.push({
                    key: filterResult.item_key,
                    type: typeName,
                    item: filterResult.item,
                    relevance_score: filterResult.relevance_score,
                    sorted_skills: sortedSkills,
                    classified_skills: classifiedSkills,
                });
            }

            // Sort by relevance score descending within this type
            items.sort((a, b) => b.relevance_score - a.relevance_score);

            body.innerHTML = `<p class="step-summary">${items.length} item${items.length !== 1 ? 's' : ''} ranked</p>`;
            completeStep(stepEl, false);
            return items;
        } catch (err) {
            err._failedItemIndex = lastIndex;
            err._partialResult = [...items];
            failStep(stepEl, err.message, err.detail);
            throw err;
        }
    }

    // --- Generate bullets ---

    async function runBullets(jobAnalysis, rankedItems, previousBullets, typeName, stepNum, startIndex = 0, priorBullets = {}) {
        const typeLabel = typeName === 'experience' ? 'Experience' : 'Projects';
        const stepEl = appendStep(`Step ${stepNum}: ${typeLabel} \u2014 Generate bullets${startIndex > 0 ? ' (resuming)' : ''}...`);
        const body = getStepBody(stepEl);
        const newBullets = { ...priorBullets };
        const currentBullets = Object.assign({}, previousBullets, priorBullets);
        let lastIndex = startIndex;

        try {
            for (let i = startIndex; i < rankedItems.length; i++) {
                lastIndex = i;
                const item = rankedItems[i];
                updateStepStatus(stepEl, `Item ${i + 1}/${rankedItems.length}...`);

                const result = await selectionApi('bullets', {
                    job_analysis: jobAnalysis,
                    item_key: item.key,
                    item: item.item,
                    item_type: typeName,
                    sorted_skills: item.sorted_skills,
                    classified_skills: item.classified_skills || [],
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
            err._failedItemIndex = lastIndex;
            err._partialResult = { ...newBullets };
            failStep(stepEl, err.message, err.detail);
            throw err;
        }
    }

    // --- Curate Skills (global) ---

    async function runCurateSkills(jobAnalysis, stepNum) {
        const stepEl = appendStep(`Step ${stepNum}: Curating technical skills...`);

        try {
            // Aggregate all classified skills from experiences + projects (deduplicated)
            const skillSet = new Map();
            for (const section of ['experiences', 'projects']) {
                for (const entry of editableResults[section]) {
                    const classified = entry.classified_skills || [];
                    for (const cs of classified) {
                        const lower = cs.name.toLowerCase();
                        if (!skillSet.has(lower)) {
                            skillSet.set(lower, cs);
                        }
                    }
                }
            }
            const allClassifiedSkills = Array.from(skillSet.values());

            const result = await selectionApi('curate-skills', {
                job_analysis: jobAnalysis,
                all_classified_skills: allClassifiedSkills,
            });

            editableResults.curatedSkills = result.curated_skills || allClassifiedSkills;
            completeStep(stepEl, false);
        } catch (err) {
            failStep(stepEl, err.message, err.detail);
            throw err;
        }
    }

    // --- Objective ---

    let generatedObjective = '';

    async function runObjective(jobAnalysis, allBullets, experienceIds, stepNum) {
        const stepEl = appendStep(`Step ${stepNum}: Generating objective...`);

        try {
            const result = await selectionApi('objective', {
                job_analysis: jobAnalysis,
                all_bullets: allBullets,
                experience_ids: experienceIds,
            });

            generatedObjective = result.objective || '';
            editableResults.objective = generatedObjective;
            completeStep(stepEl, false);
        } catch (err) {
            failStep(stepEl, err.message, err.detail);
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
            html += renderEditableItemCard(entry, section, idx, idx === 0, idx === items.length - 1);
        });

        slot.innerHTML = html;
        slot.classList.remove('hidden');
        injectItemFindings(section);
        debouncedSave();
    }

    function renderEditableItemCard(entry, section, idx, isFirst, isLast) {
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
                        <div class="ranked-item-score ${scoreClass}">${score}</div>
                    </div>
                </div>
                <div class="editable-item-actions">
                    ${!isFirst ? `<button class="btn btn-sm item-move-up" data-section="${section}" data-item="${idx}" title="Move up">&uarr; Move Up</button>` : ''}
                    ${!isLast ? `<button class="btn btn-sm item-move-down" data-section="${section}" data-item="${idx}" title="Move down">&darr; Move Down</button>` : ''}
                    <button class="btn btn-sm item-regenerate" data-section="${section}" data-item="${idx}" title="Regenerate">&#8635; Regenerate</button>
                    <button class="btn btn-sm btn-danger item-delete" data-section="${section}" data-item="${idx}" title="Remove">&times; Remove</button>
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
                const result = await selectionApi('objective', {
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

        debouncedSave();

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

        injectObjectiveFindings();
    }

    // --- Editable curated skills ---

    function renderEditableCuratedSkills() {
        const skills = editableResults.curatedSkills;
        if (!skills.length) return;

        let tagsHtml = '<div class="editable-tags">';
        skills.forEach((cs, si) => {
            const isFirst = si === 0;
            const isLast = si === skills.length - 1;
            tagsHtml += `
                <span class="tag editable-tag" data-skill="${si}">
                    ${escapeHtml(cs.name)}
                    <span class="tag-actions">
                        ${!isFirst ? '<button class="tag-action curated-up" title="Move up">&uarr;</button>' : ''}
                        ${!isLast ? '<button class="tag-action curated-down" title="Move down">&darr;</button>' : ''}
                        <button class="tag-action curated-edit" title="Edit">&#9998;</button>
                        <button class="tag-action curated-delete" title="Delete">&times;</button>
                    </span>
                </span>`;
        });
        tagsHtml += '<button class="tag-action tag-add curated-add" title="Add skill">+</button>';
        tagsHtml += '</div>';

        resultCuratedSkillsSlot.innerHTML = `
            <div class="curated-skills-card">
                <div class="curated-skills-header">
                    <h4>Technical Skills</h4>
                    <div>
                        <button class="btn btn-sm curated-regenerate">&#8635; Regenerate</button>
                    </div>
                </div>
                ${tagsHtml}
            </div>
        `;
        resultCuratedSkillsSlot.classList.remove('hidden');
        injectCuratedSkillsFindings();
        debouncedSave();
    }

    function attachCuratedSkillsHandlers() {
        resultCuratedSkillsSlot.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const tag = btn.closest('.editable-tag');
            if (tag) {
                const si = parseInt(tag.dataset.skill);
                if (btn.classList.contains('curated-delete')) {
                    editableResults.curatedSkills.splice(si, 1);
                    renderEditableCuratedSkills();
                } else if (btn.classList.contains('curated-edit')) {
                    const current = editableResults.curatedSkills[si];
                    openModal('Edit Skill', `
                        <div class="form-group">
                            <label>Skill</label>
                            <input type="text" name="skill-value" value="${escapeHtml(current.name)}" required>
                        </div>
                    `, () => {
                        const val = document.querySelector('#modal-form [name="skill-value"]').value.trim();
                        if (val) {
                            editableResults.curatedSkills[si] = { ...current, name: val };
                            renderEditableCuratedSkills();
                        }
                        closeModal();
                    });
                } else if (btn.classList.contains('curated-up')) {
                    if (si > 0) {
                        const skills = editableResults.curatedSkills;
                        [skills[si], skills[si - 1]] = [skills[si - 1], skills[si]];
                        renderEditableCuratedSkills();
                    }
                } else if (btn.classList.contains('curated-down')) {
                    const skills = editableResults.curatedSkills;
                    if (si < skills.length - 1) {
                        [skills[si], skills[si + 1]] = [skills[si + 1], skills[si]];
                        renderEditableCuratedSkills();
                    }
                }
                return;
            }

            if (btn.classList.contains('curated-add')) {
                // Pool: all item skills not already curated
                const curatedLower = editableResults.curatedSkills.map(s => s.name.toLowerCase());
                const pool = [];
                for (const section of ['experiences', 'projects']) {
                    for (const entry of editableResults[section]) {
                        for (const s of (entry.skills || [])) {
                            if (!curatedLower.includes(s.toLowerCase()) && !pool.find(p => p.toLowerCase() === s.toLowerCase())) {
                                pool.push(s);
                            }
                        }
                    }
                }

                let fieldsHtml = '';
                if (pool.length > 0) {
                    fieldsHtml += '<div class="form-group"><label>Select from available skills</label><div class="skill-options">';
                    pool.forEach(skill => {
                        fieldsHtml += `<label class="skill-option">
                            <input type="checkbox" name="skill-select" value="${escapeHtml(skill)}">
                            <span class="skill-option-label">${escapeHtml(skill)}</span>
                        </label>`;
                    });
                    fieldsHtml += '</div></div>';
                }
                fieldsHtml += `<div class="form-group">
                    <label>${pool.length > 0 ? 'Or enter a custom skill' : 'Skill'}</label>
                    <input type="text" name="skill-value" placeholder="Enter skill name">
                </div>`;

                openModal('Add Skill', fieldsHtml, () => {
                    const selected = Array.from(
                        document.querySelectorAll('#modal-form [name="skill-select"]:checked')
                    ).map(cb => cb.value);
                    const custom = document.querySelector('#modal-form [name="skill-value"]').value.trim();

                    const toAdd = [...selected];
                    if (custom && !toAdd.find(s => s.toLowerCase() === custom.toLowerCase())) {
                        toAdd.push(custom);
                    }

                    for (const name of toAdd) {
                        editableResults.curatedSkills.push({ name, type: 'tool' });
                    }
                    if (toAdd.length) renderEditableCuratedSkills();
                    closeModal();
                });
                return;
            }

            if (btn.classList.contains('curated-regenerate')) {
                if (!cachedJobAnalysis) {
                    alert('No job analysis cached. Please run the full generation first.');
                    return;
                }
                btn.disabled = true;
                btn.textContent = 'Regenerating...';

                const skillSet = new Map();
                for (const section of ['experiences', 'projects']) {
                    for (const entry of editableResults[section]) {
                        for (const cs of (entry.classified_skills || [])) {
                            const lower = cs.name.toLowerCase();
                            if (!skillSet.has(lower)) skillSet.set(lower, cs);
                        }
                    }
                }

                selectionApi('curate-skills', {
                    job_analysis: cachedJobAnalysis,
                    all_classified_skills: Array.from(skillSet.values()),
                }).then(result => {
                    editableResults.curatedSkills = result.curated_skills || [];
                    renderEditableCuratedSkills();
                }).catch(err => {
                    alert('Skills curation failed: ' + err.message);
                    btn.disabled = false;
                    btn.textContent = '\u21BB Regenerate';
                });
                return;
            }
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

            // Delete item
            if (btn.classList.contains('item-delete')) {
                const itemIdx = parseInt(btn.dataset.item);
                deleteItem(section, itemIdx);
                return;
            }

            // Move item up
            if (btn.classList.contains('item-move-up')) {
                const itemIdx = parseInt(btn.dataset.item);
                moveItem(section, itemIdx, -1);
                return;
            }

            // Move item down
            if (btn.classList.contains('item-move-down')) {
                const itemIdx = parseInt(btn.dataset.item);
                moveItem(section, itemIdx, 1);
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
            const filterResult = await selectionApi('filter-skills', {
                job_analysis: cachedJobAnalysis,
                item_type: typeName,
                item_id: itemId,
            });

            // Step 2: Sort skills
            let sortedSkills = filterResult.relevant_skills || [];
            let classifiedSkills = [];
            if (sortedSkills.length > 1) {
                const sortResult = await selectionApi('sort-skills', {
                    job_analysis: cachedJobAnalysis,
                    item_key: filterResult.item_key,
                    relevant_skills: sortedSkills,
                });
                sortedSkills = sortResult.sorted_skills || sortedSkills;
                classifiedSkills = sortResult.classified_skills || [];
            } else {
                classifiedSkills = sortedSkills.map(s => ({ name: s, type: 'tool' }));
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

            const bulletResult = await selectionApi('bullets', {
                job_analysis: cachedJobAnalysis,
                item_key: entry.key,
                item: filterResult.item,
                item_type: typeName,
                sorted_skills: sortedSkills,
                classified_skills: classifiedSkills,
                previous_bullets: previousBullets,
            });

            // Update editable state
            editableResults[section][itemIdx].skills = [...sortedSkills];
            editableResults[section][itemIdx].classified_skills = [...classifiedSkills];
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

    // --- Item-level actions ---

    function deleteItem(section, itemIdx) {
        const entry = editableResults[section][itemIdx];
        const name = entry.type === 'experience'
            ? `${entry.item.title} \u2014 ${entry.item.company}`
            : entry.item.name;

        openModal('Remove Item', `<p>Remove <strong>${escapeHtml(name)}</strong> from the resume?</p>`, () => {
            editableResults[section].splice(itemIdx, 1);
            const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
            if (editableResults[section].length === 0) {
                slot.innerHTML = '';
                slot.classList.add('hidden');
            } else {
                renderEditableSection(section);
            }
            closeModal();
        }, 'Remove');
    }

    function moveItem(section, itemIdx, direction) {
        const items = editableResults[section];
        const newIdx = itemIdx + direction;
        if (newIdx < 0 || newIdx >= items.length) return;
        [items[itemIdx], items[newIdx]] = [items[newIdx], items[itemIdx]];
        renderEditableSection(section);
    }

    // --- Mutation functions ---

    function rerenderItem(section, itemIdx) {
        const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
        const oldCard = slot.querySelector(`.editable-item-card[data-item="${itemIdx}"]`);
        if (!oldCard) return;
        const entry = editableResults[section][itemIdx];
        const total = editableResults[section].length;
        const temp = document.createElement('div');
        temp.innerHTML = renderEditableItemCard(entry, section, itemIdx, itemIdx === 0, itemIdx === total - 1);
        oldCard.replaceWith(temp.firstElementChild);
        injectSingleItemFindings(section, itemIdx);
        debouncedSave();
    }

    // Skills

    function deleteSkill(section, itemIdx, skillIdx) {
        const removedSkill = editableResults[section][itemIdx].skills.splice(skillIdx, 1)[0];
        const cs = editableResults[section][itemIdx].classified_skills;
        const csIdx = cs.findIndex(c => c.name.toLowerCase() === removedSkill.toLowerCase());
        if (csIdx !== -1) cs.splice(csIdx, 1);
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
                const cs = editableResults[section][itemIdx].classified_skills;
                const csEntry = cs.find(c => c.name.toLowerCase() === current.toLowerCase());
                if (csEntry) csEntry.name = val;
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
                for (const s of newSkills) {
                    editableResults[section][itemIdx].classified_skills.push({ name: s, type: 'tool' });
                }
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

    // --- Analyzer inject utilities ---

    function clearAllItemFindings() {
        document.querySelectorAll('.item-findings-section').forEach(el => el.remove());
        document.querySelectorAll('.has-findings').forEach(el => el.classList.remove('has-findings'));
    }

    function getFindingsForTarget(section, itemKey) {
        return analyzerFindings.filter(f => {
            if (f.pass !== 'per_item') return false;
            const t = f.target || {};
            if (t.section !== section) return false;
            if (section === 'objective' || section === 'curatedSkills') return true;
            return t.item_key === itemKey;
        });
    }

    function renderItemFindingsSection(findings) {
        if (!findings.length) return '';
        let html = '<div class="item-findings-section">';
        html += `<div class="item-findings-header">${findings.length} finding${findings.length !== 1 ? 's' : ''}</div>`;
        findings.forEach(f => { html += renderFindingCard(f); });
        html += '</div>';
        return html;
    }

    function injectItemFindings(section) {
        if (!analyzerFindings.length) return;
        const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
        editableResults[section].forEach((entry, idx) => {
            const card = slot.querySelector(`.editable-item-card[data-item="${idx}"]`);
            if (!card) return;
            const next = card.nextElementSibling;
            if (next && next.classList.contains('item-findings-section')) next.remove();
            const findings = getFindingsForTarget(section, entry.key);
            if (findings.length) {
                card.classList.add('has-findings');
                card.insertAdjacentHTML('afterend', renderItemFindingsSection(findings));
            } else {
                card.classList.remove('has-findings');
            }
        });
    }

    function injectSingleItemFindings(section, itemIdx) {
        if (!analyzerFindings.length) return;
        const slot = section === 'experiences' ? resultExperiencesSlot : resultProjectsSlot;
        const card = slot.querySelector(`.editable-item-card[data-item="${itemIdx}"]`);
        if (!card) return;
        const next = card.nextElementSibling;
        if (next && next.classList.contains('item-findings-section')) next.remove();
        const entry = editableResults[section][itemIdx];
        const findings = getFindingsForTarget(section, entry.key);
        if (findings.length) {
            card.classList.add('has-findings');
            card.insertAdjacentHTML('afterend', renderItemFindingsSection(findings));
        } else {
            card.classList.remove('has-findings');
        }
    }

    function injectObjectiveFindings() {
        if (!analyzerFindings.length) return;
        const card = resultObjectiveSlot.querySelector('.editable-objective-card');
        if (!card) return;
        const next = card.nextElementSibling;
        if (next && next.classList.contains('item-findings-section')) next.remove();
        const findings = getFindingsForTarget('objective', null);
        if (findings.length) {
            card.classList.add('has-findings');
            card.insertAdjacentHTML('afterend', renderItemFindingsSection(findings));
        } else {
            card.classList.remove('has-findings');
        }
    }

    function injectCuratedSkillsFindings() {
        if (!analyzerFindings.length) return;
        const card = resultCuratedSkillsSlot.querySelector('.curated-skills-card');
        if (!card) return;
        const next = card.nextElementSibling;
        if (next && next.classList.contains('item-findings-section')) next.remove();
        const findings = getFindingsForTarget('curatedSkills', null);
        if (findings.length) {
            card.classList.add('has-findings');
            card.insertAdjacentHTML('afterend', renderItemFindingsSection(findings));
        } else {
            card.classList.remove('has-findings');
        }
    }

    // --- Resume Analyzer ---

    analyzeBtn.addEventListener('click', async () => {
        if (!cachedJobAnalysis) {
            alert('No job analysis cached. Please run the full generation first.');
            return;
        }

        analyzeBtn.disabled = true;
        analyzeBtn.textContent = 'Analyzing...';
        analyzerFindings = [];
        clearAllItemFindings();
        holisticBar.innerHTML = '';
        holisticBar.classList.add('hidden');
        applyBar.classList.add('hidden');
        document.getElementById('tab-build').classList.remove('analyzer-active');

        const items = [];
        for (const section of ['experiences', 'projects']) {
            for (const entry of editableResults[section]) {
                const label = entry.type === 'experience'
                    ? `${entry.item.title} at ${entry.item.company}`
                    : entry.item.name;
                items.push({
                    key: entry.key,
                    type: entry.type,
                    section: section,
                    label: label,
                    skills: entry.skills || [],
                    bullets: entry.bullets || [],
                });
            }
        }

        const curatedSkillNames = editableResults.curatedSkills.map(cs => cs.name);

        try {
            const [perItemResult, holisticResult] = await Promise.all([
                selectionApi('analyze-per-item', {
                    job_analysis: cachedJobAnalysis,
                    objective: editableResults.objective,
                    items: items,
                    curated_skills: curatedSkillNames,
                }),
                selectionApi('analyze-holistic', {
                    job_analysis: cachedJobAnalysis,
                    objective: editableResults.objective,
                    items: items,
                    curated_skills: curatedSkillNames,
                }),
            ]);

            const perItemFindings = (perItemResult.per_item_findings || []).map((f, i) => ({
                ...f,
                id: 'pi_' + i,
                pass: 'per_item',
                status: 'pending',
            }));

            const holisticFindings = (holisticResult.holistic_findings || []).map((f, i) => ({
                ...f,
                id: 'h_' + i,
                pass: 'holistic',
                status: 'pending',
            }));

            // Deduplicate: per-item findings take priority over holistic for same target
            const perItemKeys = new Set();
            perItemFindings.forEach(f => {
                const t = f.target || {};
                if (t.section) {
                    perItemKeys.add(`${t.section}|${t.item_key ?? ''}|${t.index ?? ''}`);
                }
            });
            const dedupedHolistic = holisticFindings.filter(f => {
                const t = f.target || {};
                if (!t.section) return true;
                const key = `${t.section}|${t.item_key ?? ''}|${t.index ?? ''}`;
                return !perItemKeys.has(key);
            });
            analyzerFindings = [...perItemFindings, ...dedupedHolistic];
            renderAnalyzerResults();
            debouncedSave();
        } catch (err) {
            alert('Analysis failed: ' + err.message);
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.textContent = 'Analyze Resume';
        }
    });

    function getLocationLabel(finding) {
        const t = finding.target || {};
        const section = t.section;
        const itemKey = t.item_key;
        const index = t.index;

        if (section === 'objective') return 'Objective';

        if (section === 'curatedSkills') {
            return index != null ? `Curated Skills > [${index}]` : 'Curated Skills';
        }

        let itemLabel = itemKey || '';
        if (itemKey && (section === 'experiences' || section === 'projects')) {
            const entry = editableResults[section]?.find(e => e.key === itemKey);
            if (entry) {
                itemLabel = entry.type === 'experience'
                    ? `${entry.item.title} at ${entry.item.company}`
                    : entry.item.name;
            }
        }

        const sectionLabel = section === 'experiences' ? 'Experience' : 'Project';

        if (finding.type === 'remove_skill' || finding.type === 'rewrite_bullet' || finding.type === 'remove_bullet'
            || finding.type === 'add_bullet' || finding.type === 'add_skill') {
            const itemPart = itemLabel ? `${sectionLabel}: ${itemLabel}` : sectionLabel;
            if (index != null) {
                const kind = finding.type.includes('skill') ? 'Skill' : 'Bullet';
                return `${itemPart} > ${kind} ${index}`;
            }
            return itemPart;
        }

        if (itemLabel) return `${sectionLabel}: ${itemLabel}`;
        return sectionLabel;
    }

    function renderAnalyzerResults() {
        clearAllItemFindings();
        holisticBar.innerHTML = '';
        holisticBar.classList.add('hidden');

        if (!analyzerFindings.length) {
            holisticBar.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:0.9rem;">No issues found. Your resume looks good!</div>';
            holisticBar.classList.remove('hidden');
            applyBar.classList.add('hidden');
            document.getElementById('tab-build').classList.remove('analyzer-active');
            return;
        }

        document.getElementById('tab-build').classList.add('analyzer-active');

        // Render holistic findings into holistic bar
        const holistic = analyzerFindings.filter(f => f.pass === 'holistic');
        if (holistic.length) {
            const counts = { error: 0, warning: 0, info: 0 };
            analyzerFindings.forEach(f => { if (counts[f.severity] !== undefined) counts[f.severity]++; });

            let html = '<div class="holistic-findings-bar-header">';
            html += '<h4>Cross-Cutting Findings</h4>';
            html += '<div class="analyzer-summary">';
            if (counts.error) html += `<span class="badge finding-severity-error">${counts.error} error${counts.error !== 1 ? 's' : ''}</span>`;
            if (counts.warning) html += `<span class="badge finding-severity-warning">${counts.warning} warning${counts.warning !== 1 ? 's' : ''}</span>`;
            if (counts.info) html += `<span class="badge finding-severity-info">${counts.info} info</span>`;
            html += '</div></div>';
            holistic.forEach(f => { html += renderFindingCard(f); });
            holisticBar.innerHTML = html;
            holisticBar.classList.remove('hidden');
        }

        // Inject per-item findings below their cards
        injectObjectiveFindings();
        injectItemFindings('experiences');
        injectItemFindings('projects');
        injectCuratedSkillsFindings();

        // Show apply bar
        applyBar.classList.remove('hidden');
        updateApplyButton();
    }

    function renderFindingCard(f) {
        const location = escapeHtml(getLocationLabel(f));
        const isRemoval = f.type === 'remove_bullet' || f.type === 'remove_skill' || f.type === 'remove_curated_skill';
        const isAddition = f.type === 'add_bullet' || f.type === 'add_skill';

        let html = `<div class="analyzer-finding" data-finding-id="${f.id}" data-status="${f.status}">`;
        html += `<div class="finding-header">`;
        html += `<span class="finding-severity finding-severity-${f.severity}">${escapeHtml(f.severity)}</span>`;
        html += `<span class="finding-location">${location}</span>`;
        html += `</div>`;
        html += `<div class="finding-problem">${escapeHtml(f.problem || '')}</div>`;

        if (isRemoval) {
            html += `<div class="finding-remove-label">Remove this item</div>`;
            html += `<div class="finding-actions">
                <button class="finding-accept">Accept</button>
                <button class="finding-reject">Reject</button>
            </div>`;
        } else if (isAddition) {
            if (f.type === 'add_bullet') {
                html += `<div class="finding-suggestion">
                    <label>Add bullet</label>
                    <textarea class="finding-edit">${escapeHtml(f.suggestion || '')}</textarea>
                </div>`;
            } else {
                html += `<div class="finding-add-label">Add skill: ${escapeHtml(f.suggestion || '')}</div>`;
            }
            html += `<div class="finding-actions">
                <button class="finding-accept">Accept</button>
                <button class="finding-reject">Reject</button>
            </div>`;
        } else {
            html += `<div class="finding-suggestion">
                <label>Suggestion</label>
                <textarea class="finding-edit">${escapeHtml(f.suggestion || '')}</textarea>
            </div>`;
            html += `<div class="finding-actions">
                <button class="finding-accept">Accept</button>
                <button class="finding-reject">Reject</button>
            </div>`;
        }

        html += '</div>';
        return html;
    }

    function updateApplyButton() {
        if (!analyzerFindings.length) {
            applyBar.classList.add('hidden');
            return;
        }
        const btn = applyBar.querySelector('.analyzer-apply-btn');
        const summary = applyBar.querySelector('.analyzer-apply-summary');
        if (!btn) return;
        const acceptedCount = analyzerFindings.filter(f => f.status === 'accepted').length;
        const pendingCount = analyzerFindings.filter(f => f.status === 'pending').length;
        btn.disabled = acceptedCount === 0;
        btn.textContent = acceptedCount > 0
            ? `Apply ${acceptedCount} Accepted Change${acceptedCount !== 1 ? 's' : ''}`
            : 'Apply Accepted Changes';
        if (summary) {
            summary.textContent = `${pendingCount} pending, ${acceptedCount} accepted`;
        }
    }

    document.getElementById('build-main').addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const card = btn.closest('.analyzer-finding');
        if (!card) return;

        const findingId = card.dataset.findingId;
        const finding = analyzerFindings.find(f => f.id === findingId);
        if (!finding) return;

        if (btn.classList.contains('finding-accept')) {
            finding.status = finding.status === 'accepted' ? 'pending' : 'accepted';
            card.dataset.status = finding.status;
            updateApplyButton();
            debouncedSave();
        } else if (btn.classList.contains('finding-reject')) {
            finding.status = finding.status === 'rejected' ? 'pending' : 'rejected';
            card.dataset.status = finding.status;
            updateApplyButton();
            debouncedSave();
        }
    });

    document.getElementById('build-main').addEventListener('input', (e) => {
        if (!e.target.classList.contains('finding-edit')) return;
        const card = e.target.closest('.analyzer-finding');
        if (!card) return;
        const finding = analyzerFindings.find(f => f.id === card.dataset.findingId);
        if (finding) {
            finding._editedSuggestion = e.target.value;
            debouncedSave();
        }
    });

    applyBar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.classList.contains('analyzer-apply-btn')) {
            applyAcceptedFindings();
        }
    });

    function findItemIndex(section, itemKey) {
        return editableResults[section].findIndex(e => e.key === itemKey);
    }

    function applyAcceptedFindings() {
        const accepted = analyzerFindings.filter(f => f.status === 'accepted');
        if (!accepted.length) return;

        const rewrites = accepted.filter(f => f.type === 'rewrite_bullet' || f.type === 'rewrite_objective');
        const removals = accepted.filter(f => f.type === 'remove_bullet' || f.type === 'remove_skill' || f.type === 'remove_curated_skill');
        const additions = accepted.filter(f => f.type === 'add_bullet' || f.type === 'add_skill');

        // Build removal conflict set
        const removalSet = new Set();
        removals.forEach(f => {
            const t = f.target || {};
            removalSet.add(`${t.section}|${t.item_key}|${t.index}`);
        });

        // Apply rewrites first (skip conflicts with removals)
        for (const f of rewrites) {
            const t = f.target || {};
            const effectiveSuggestion = f._editedSuggestion !== undefined ? f._editedSuggestion : f.suggestion;
            if (!effectiveSuggestion) continue;

            const conflictKey = `${t.section}|${t.item_key}|${t.index}`;
            if (removalSet.has(conflictKey)) continue;

            if (f.type === 'rewrite_objective') {
                editableResults.objective = effectiveSuggestion;
            } else if (f.type === 'rewrite_bullet') {
                const section = t.section;
                const itemIdx = findItemIndex(section, t.item_key);
                if (itemIdx === -1) continue;
                if (t.index == null || t.index >= editableResults[section][itemIdx].bullets.length) continue;
                editableResults[section][itemIdx].bullets[t.index] = effectiveSuggestion;
            }
        }

        // Group removals by (section, item_key) and sort descending by index
        const removalGroups = {};
        for (const f of removals) {
            const t = f.target || {};
            if (f.type === 'remove_curated_skill') {
                const gk = 'curatedSkills||';
                if (!removalGroups[gk]) removalGroups[gk] = [];
                removalGroups[gk].push(f);
            } else {
                const gk = `${t.section}|${t.item_key}|`;
                if (!removalGroups[gk]) removalGroups[gk] = [];
                removalGroups[gk].push(f);
            }
        }

        for (const gk of Object.keys(removalGroups)) {
            const group = removalGroups[gk];
            group.sort((a, b) => (b.target?.index ?? 0) - (a.target?.index ?? 0));

            for (const f of group) {
                const t = f.target || {};

                if (f.type === 'remove_curated_skill') {
                    if (t.index != null && t.index < editableResults.curatedSkills.length) {
                        editableResults.curatedSkills.splice(t.index, 1);
                    }
                } else if (f.type === 'remove_bullet') {
                    const section = t.section;
                    const itemIdx = findItemIndex(section, t.item_key);
                    if (itemIdx === -1) continue;
                    if (t.index == null || t.index >= editableResults[section][itemIdx].bullets.length) continue;
                    editableResults[section][itemIdx].bullets.splice(t.index, 1);
                } else if (f.type === 'remove_skill') {
                    const section = t.section;
                    const itemIdx = findItemIndex(section, t.item_key);
                    if (itemIdx === -1) continue;
                    if (t.index == null || t.index >= editableResults[section][itemIdx].skills.length) continue;
                    const removedSkill = editableResults[section][itemIdx].skills.splice(t.index, 1)[0];
                    const cs = editableResults[section][itemIdx].classified_skills;
                    const csIdx = cs.findIndex(c => c.name.toLowerCase() === removedSkill.toLowerCase());
                    if (csIdx !== -1) cs.splice(csIdx, 1);
                }
            }
        }

        // Apply additions
        for (const f of additions) {
            const t = f.target || {};
            const effectiveSuggestion = f._editedSuggestion !== undefined ? f._editedSuggestion : f.suggestion;
            if (!effectiveSuggestion) continue;

            if (f.type === 'add_bullet') {
                const section = t.section;
                const itemIdx = findItemIndex(section, t.item_key);
                if (itemIdx === -1) continue;
                editableResults[section][itemIdx].bullets.push(effectiveSuggestion);
            } else if (f.type === 'add_skill') {
                if (t.section === 'curatedSkills') {
                    const already = editableResults.curatedSkills.some(
                        s => s.name.toLowerCase() === effectiveSuggestion.toLowerCase()
                    );
                    if (!already) {
                        editableResults.curatedSkills.push({ name: effectiveSuggestion, type: 'tool' });
                    }
                } else {
                    const section = t.section;
                    const itemIdx = findItemIndex(section, t.item_key);
                    if (itemIdx === -1) continue;
                    const skills = editableResults[section][itemIdx].skills;
                    const already = skills.some(s => s.toLowerCase() === effectiveSuggestion.toLowerCase());
                    if (!already) {
                        skills.push(effectiveSuggestion);
                        editableResults[section][itemIdx].classified_skills.push({
                            name: effectiveSuggestion,
                            category: 'tool',
                            subcategory: null,
                        });
                    }
                }
            }
        }

        // Clear findings and re-render (inject functions find no findings)
        analyzerFindings = [];
        renderEditableObjective();
        if (editableResults.experiences.length) renderEditableSection('experiences');
        if (editableResults.projects.length) renderEditableSection('projects');
        renderEditableCuratedSkills();

        // Clean up
        holisticBar.innerHTML = '';
        holisticBar.classList.add('hidden');
        applyBar.classList.add('hidden');
        document.getElementById('tab-build').classList.remove('analyzer-active');
        updateButtonStates();
        updateStepper(deriveWorkflowStep());
    }

    // --- Download PDF ---

    downloadPdfBtn.addEventListener('click', async () => {
        downloadPdfBtn.disabled = true;
        downloadPdfBtn.textContent = 'Generating PDF...';
        updateStepper(5);

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

    // --- One-time event delegation setup (prevents listener stacking on re-render) ---
    attachEditableHandlers(resultExperiencesSlot, 'experiences');
    attachEditableHandlers(resultProjectsSlot, 'projects');
    attachCuratedSkillsHandlers();

    // --- Smart button states ---

    function updateButtonStates() {
        const hasJd = document.getElementById('job-description').value.trim().length > 0;
        const hasChecked =
            expCheckboxes.querySelectorAll('input:checked').length > 0 ||
            projCheckboxes.querySelectorAll('input:checked').length > 0;
        const hasContent = editableResults.objective ||
            editableResults.experiences.length > 0 ||
            editableResults.projects.length > 0;

        autoSelectBtn.disabled = !hasJd;
        generateBtn.disabled = !hasChecked;
        analyzeBtn.disabled = !hasContent;
        downloadPdfBtn.disabled = !hasContent;
    }

    document.getElementById('job-description').addEventListener('input', () => {
        updateButtonStates();
        updateStepper(deriveWorkflowStep());
        debouncedSave();
    });

    document.getElementById('build-main').addEventListener('change', (e) => {
        if (e.target.matches('input[type="checkbox"]')) {
            updateButtonStates();
            updateStepper(deriveWorkflowStep());
            debouncedSave();
        }
    });

    providerSelect.addEventListener('change', () => {
        debouncedSave();
    });

    // --- Workflow stepper ---

    function updateStepper(step) {
        document.querySelectorAll('#workflow-stepper .stepper-step').forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.remove('active', 'completed');
            if (s < step) el.classList.add('completed');
            else if (s === step) el.classList.add('active');
        });
    }

    function deriveWorkflowStep() {
        const hasJd = document.getElementById('job-description').value.trim().length > 0;
        const hasChecked =
            expCheckboxes.querySelectorAll('input:checked').length > 0 ||
            projCheckboxes.querySelectorAll('input:checked').length > 0;
        const hasContent = editableResults.objective ||
            editableResults.experiences.length > 0 ||
            editableResults.projects.length > 0;
        if (!hasJd) return 1;
        if (!hasChecked) return 2;
        if (!hasContent) return 3;
        return 4;
    }

    // --- Reset button ---

    const resetBuildBtn = document.getElementById('reset-build-btn');
    resetBuildBtn.addEventListener('click', () => {
        if (!confirm('Clear all generated content and selections?')) return;
        resetEditableResults();
        document.getElementById('job-description').value = '';
        expCheckboxes.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
        projCheckboxes.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
        resultsContent.innerHTML = '';
        resultsDiv.classList.add('hidden');
        if (previewEmpty) previewEmpty.classList.remove('hidden');
        updateButtonStates();
        updateStepper(deriveWorkflowStep());
    });

    // --- Mobile drawer toggle ---

    const drawerToggle = document.getElementById('build-drawer-toggle');
    const sidebar = document.getElementById('build-sidebar');
    if (drawerToggle && sidebar) {
        const overlay = document.createElement('div');
        overlay.className = 'build-drawer-overlay';
        document.body.appendChild(overlay);
        drawerToggle.addEventListener('click', () => {
            sidebar.classList.toggle('drawer-open');
            overlay.classList.toggle('open');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('drawer-open');
            overlay.classList.remove('open');
        });
    }
})();