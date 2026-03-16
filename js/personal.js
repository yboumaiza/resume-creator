(function () {
    const form = document.getElementById('personal-form');
    const languageRows = document.getElementById('language-rows');
    const addLangBtn = document.getElementById('add-language-btn');
    const saveStatus = document.getElementById('personal-save-status');
    let loaded = false;

    window.loadPersonalInfo = async function () {
        if (loaded) return;
        loaded = true;

        try {
            const data = await api('personal');
            populateForm(data);
        } catch (err) {
            // Form stays empty — that's fine for first use
        }
    };

    function populateForm(data) {
        if (!data || !data.full_name) return;
        form.querySelector('[name="full_name"]').value = data.full_name || '';
        form.querySelector('[name="header_text"]').value = data.header_text || '';
        form.querySelector('[name="phone"]').value = data.phone || '';
        form.querySelector('[name="location"]').value = data.location || '';
        form.querySelector('[name="email"]').value = data.email || '';
        form.querySelector('[name="linkedin"]').value = data.linkedin || '';
        form.querySelector('[name="portfolio"]').value = data.portfolio || '';

        const langs = data.languages || [];
        languageRows.innerHTML = langs.map(l => languageRowHtml(l.language, l.proficiency)).join('');
    }

    function languageRowHtml(language, proficiency) {
        return `
            <div class="language-row">
                <input type="text" class="lang-name" placeholder="Language" value="${escapeHtml(language)}">
                <select class="lang-proficiency">
                    <option value="Native"${proficiency === 'Native' ? ' selected' : ''}>Native</option>
                    <option value="Fluent"${proficiency === 'Fluent' ? ' selected' : ''}>Fluent</option>
                    <option value="Intermediate"${proficiency === 'Intermediate' ? ' selected' : ''}>Intermediate</option>
                    <option value="Beginner"${proficiency === 'Beginner' ? ' selected' : ''}>Beginner</option>
                </select>
                <button type="button" class="language-remove" title="Remove">&times;</button>
            </div>
        `;
    }

    addLangBtn.addEventListener('click', () => {
        languageRows.insertAdjacentHTML('beforeend', languageRowHtml('', 'Intermediate'));
    });

    languageRows.addEventListener('click', (e) => {
        if (e.target.closest('.language-remove')) {
            e.target.closest('.language-row').remove();
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const languages = [];
        languageRows.querySelectorAll('.language-row').forEach(row => {
            const lang = row.querySelector('.lang-name').value.trim();
            const prof = row.querySelector('.lang-proficiency').value;
            if (lang) languages.push({ language: lang, proficiency: prof });
        });

        const data = {
            full_name: form.querySelector('[name="full_name"]').value.trim(),
            header_text: form.querySelector('[name="header_text"]').value.trim(),
            phone: form.querySelector('[name="phone"]').value.trim(),
            location: form.querySelector('[name="location"]').value.trim(),
            email: form.querySelector('[name="email"]').value.trim(),
            linkedin: form.querySelector('[name="linkedin"]').value.trim(),
            portfolio: form.querySelector('[name="portfolio"]').value.trim(),
            languages,
        };

        if (!data.full_name) {
            showToast('Full name is required.', 'warning');
            return;
        }

        try {
            await api('personal', 'POST', data);
            saveStatus.textContent = 'Saved!';
            setTimeout(() => { saveStatus.textContent = ''; }, 2000);
        } catch (err) {
            saveStatus.textContent = 'Error: ' + err.message;
        }
    });

    // Load immediately since Personal is the default active tab
    loadPersonalInfo();
})();
