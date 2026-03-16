# Resume Builder

AI-powered resume tailoring with multi-provider AI and LaTeX PDF export.

Store your work history, projects, education, testimonials, and personal info, then use the Build Resume wizard to auto-select relevant items, run an AI pipeline that analyzes a job description, and generate a tailored resume. Switch between Ollama (local), OpenAI, Anthropic, and Gemini as your AI provider. Export the final result as a professionally formatted PDF via LaTeX.

## Features

- **Personal Information** -- Contact details, LinkedIn, portfolio URL, header tagline, and languages with proficiency levels
- **Education** -- Degrees with school name and date ranges
- **Work Experience** -- Job history with descriptions, skill tags, and commitment type (full-time, part-time, contract)
- **Projects** -- Project details with URL and skill tags
- **Testimonials** -- Quotes with author name, position, company, and LinkedIn URL
- **Auto-Selection** -- AI analyzes the job description and automatically selects the most relevant experiences and projects
- **AI-Powered Build Resume Wizard** -- 4-step integrated workflow (paste JD, select items, generate via 7-phase pipeline, review & analyze) with a two-column layout and sidebar stepper
- **State Persistence** -- localStorage auto-save with 500ms debounced writes, automatic restoration on reload, and pipeline failure recovery/resume
- **Mobile Responsive Build Workflow** -- Drawer-based sidebar navigation on mobile devices with slide-in animation and overlay
- **PDF Export** -- LaTeX-based compilation into a professionally formatted resume

## Tech Stack

- **Frontend** -- Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend** -- PHP 8+ (OOP, no frameworks)
- **Database** -- MySQL 5.7+
- **AI Providers** -- Ollama (local), OpenAI, Anthropic, Gemini
- **PDF** -- LaTeX (pdflatex)
- **Server** -- Apache (XAMPP)

## Prerequisites

1. **XAMPP** (PHP + Apache + MySQL)
   - Download from [apachefriends.org](https://www.apachefriends.org/)
   - Ensure Apache and MySQL are running

2. **Ollama** (optional if using cloud providers)
   - Download from [ollama.com](https://ollama.com/)
   - Runs on `localhost:11434` by default

3. **pdflatex** (for PDF export)
   - Install [MiKTeX](https://miktex.org/), [TeX Live](https://tug.org/texlive/), or any LaTeX distribution that provides `pdflatex`

4. **Cloud AI API Keys** (optional)
   - OpenAI, Anthropic, or Gemini API keys if you want to use cloud providers instead of Ollama

## Setup

### 1. Import Database Schema

Open phpMyAdmin (`http://localhost/phpmyadmin`) or use the MySQL CLI:

```bash
mysql -u root -p < schema.sql
```

This creates the `resume_tool` database with five tables: `personal_info`, `education`, `experiences`, `projects`, and `testimonials`.

### 2. Configure the App

Edit `config.php` with your database credentials, Ollama settings, and AI provider preferences:

```php
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'resume_tool',
        'user' => 'root',
        'pass' => '',
        'charset' => 'utf8mb4',
    ],
    'ollama' => [
        'base_url' => 'http://localhost:11434',
        'model' => 'llama3',
        'timeout' => 120,
    ],
    'ai' => [
        'default_provider' => 'ollama',
        'openai'    => ['model' => 'gpt-5.4', 'timeout' => 120],
        'anthropic' => ['model' => 'claude-haiku-4.5', 'max_tokens' => 4096, 'timeout' => 120],
        'gemini'    => ['model' => 'gemini-3.1-flash-lite-preview', 'timeout' => 120],
    ],
];
```

### 3. Set Up Environment Variables

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...
```

Only the keys for providers you plan to use are required. Ollama needs no API key.

### 4. Install Ollama & Pull a Model

```bash
ollama pull llama3
ollama serve
```

For faster inference on CPU, try smaller models:

```bash
ollama pull mistral
ollama pull neural-chat
```

Then update the `ollama.model` value in `config.php` accordingly.

### 5. Open the App

Navigate to:

```
http://localhost/resume/
```

## Usage

### Personal Info

Click the **Personal** tab to enter your name, phone, email, location, LinkedIn, portfolio URL, header tagline, and languages with proficiency levels. This is a singleton record -- saving overwrites the previous entry.

### Education

Click the **Education** tab to add degrees with school name and date range. Add, edit, or delete entries as needed.

### Experience

Click the **Experience** tab to manage your job history. Each entry includes company, title, dates, commitment type, a free-text description, and skill tags.

### Projects

Click the **Projects** tab to add personal or professional projects. Each entry includes name, description, optional URL, and skill tags.

### Testimonials

Click the **Testimonials** tab to store recommendation quotes. Each entry includes the author's name, position, company, message, and optional LinkedIn URL.

### Build Resume

Click the **Build Resume** tab to launch the integrated wizard workflow:

1. **Paste Job Description** -- Enter the target job description, then click Next
2. **Select Items** -- Check the experiences and projects to include, or click **Auto-Select** to let AI pick the most relevant ones based on the job description
3. **Generate** -- Click Generate to run the 7-phase AI pipeline (analyze JD, filter/sort skills per item, generate bullets, curate technical skills, write objective, ATS check, review). A progress stepper shows each phase in real time. If a phase fails, click **Resume** to retry from that point
4. **Review & Analyze** -- Edit generated bullets, skills, and objective inline. Run the AI analyzer for per-item and holistic quality feedback

Your progress is automatically saved to localStorage. You can leave the page and return later -- the wizard restores your job description, selections, generated content, and current step.

### PDF Export

After running the selection pipeline, click **Export PDF** to compile a LaTeX-based resume. The server generates a `.tex` file from your data and compiled results, runs `pdflatex`, and returns the PDF for download.

## AI Providers

| Provider | Type | Configuration | API Key Required |
|----------|------|---------------|------------------|
| Ollama | Local | `config.php` → `ollama` block | No |
| OpenAI | Cloud | `config.php` → `ai.openai` | Yes (`OPENAI_API_KEY` in `.env`) |
| Anthropic | Cloud | `config.php` → `ai.anthropic` | Yes (`ANTHROPIC_API_KEY` in `.env`) |
| Gemini | Cloud | `config.php` → `ai.gemini` | Yes (`GEMINI_API_KEY` in `.env`) |

The default provider is set in `config.php` under `ai.default_provider`. The frontend also lets you switch providers per request.

## Selection Pipeline

| Step | Parameter | Description |
|------|-----------|-------------|
| -- | `auto-select` | AI selects relevant experiences/projects for a job description |
| 1 | `unload-model` | Unload LLM from memory (Ollama only) |
| 2 | `analyze-jd` | Parse job description into structured requirements |
| 3 | `filter-skills` | Identify relevant skills per item |
| 4 | `sort-skills` | Rank and classify skills (language/tool/skill + subcategory) |
| 5 | `bullets` | Generate tailored bullet points per item |
| 6 | `curate-skills` | Select top 10-15 skills for Technical Skills section |
| 7 | `objective` | Generate professional objective with testimonial integration |
| 8 | `ats-check` | ATS keyword coverage analysis |
| 9 | `analyze-per-item` | Per-item quality review |
| 10 | `analyze-holistic` | Cross-cutting resume assessment |

## API Reference

All endpoints accept and return JSON. Base URL: `/api/index.php`

### Personal Info

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=personal` | Get personal info |
| POST | `?route=personal` | Create or update personal info |

**POST Body:**
```json
{
  "full_name": "Jane Doe",
  "header_text": "Full-Stack Engineer",
  "phone": "+1-555-123-4567",
  "location": "New York, NY",
  "email": "jane@example.com",
  "linkedin": "https://linkedin.com/in/janedoe",
  "portfolio": "https://janedoe.dev",
  "languages": [
    { "language": "English", "proficiency": "Native" },
    { "language": "Spanish", "proficiency": "Professional" }
  ]
}
```

### Education

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=education` | List all education entries |
| POST | `?route=education` | Create education entry |
| PUT | `?route=education` | Update education entry |
| DELETE | `?route=education` | Delete education entry |

**POST/PUT Body:**
```json
{
  "degree": "B.Sc. Computer Science",
  "school": "MIT",
  "start_date": "2018-09",
  "end_date": "2022-06"
}
```

### Experiences

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=experiences` | List all experiences |
| POST | `?route=experiences` | Create experience |
| PUT | `?route=experiences` | Update experience |
| DELETE | `?route=experiences` | Delete experience |

**POST/PUT Body:**
```json
{
  "company": "Acme Inc",
  "title": "Software Engineer",
  "start_date": "2022-01-15",
  "end_date": null,
  "commitment": "Full-time",
  "description": "Developed backend APIs...",
  "skills": ["Python", "FastAPI", "PostgreSQL"]
}
```

### Projects

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=projects` | List all projects |
| POST | `?route=projects` | Create project |
| PUT | `?route=projects` | Update project |
| DELETE | `?route=projects` | Delete project |

**POST/PUT Body:**
```json
{
  "name": "Resume Builder",
  "description": "AI-powered tool for tailoring resumes",
  "url": "https://github.com/user/resume-builder",
  "skills": ["PHP", "JavaScript", "MySQL"]
}
```

### Testimonials

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=testimonials` | List all testimonials |
| POST | `?route=testimonials` | Create testimonial |
| PUT | `?route=testimonials` | Update testimonial |
| DELETE | `?route=testimonials` | Delete testimonial |

**POST/PUT Body:**
```json
{
  "name": "John Smith",
  "position": "Engineering Manager",
  "company": "Acme Inc",
  "message": "Jane is an exceptional engineer who...",
  "linkedin": "https://linkedin.com/in/johnsmith"
}
```

### Providers

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=providers` | List available AI providers |

**Response:**
```json
{
  "success": true,
  "providers": ["ollama", "openai", "anthropic", "gemini"]
}
```

### Selection

| Method | Route | Description |
|--------|-------|-------------|
| POST | `?route=selection&step=<step>` | Run a pipeline step |

The `step` query parameter must be one of the steps listed in the [Selection Pipeline](#selection-pipeline) table.

**Example -- `auto-select`:**
```json
{
  "provider": "ollama",
  "job_description": "We are looking for a Senior Engineer with 5+ years of Python experience..."
}
```

**Response:**
```json
{
  "success": true,
  "selected_experience_ids": [1, 3],
  "selected_project_ids": [2]
}
```

**Example -- `analyze-jd`:**
```json
{
  "provider": "ollama",
  "job_description": "We are looking for a Senior Engineer with 5+ years of Python experience...",
  "experience_ids": [1, 3],
  "project_ids": [2]
}
```

See `SelectionController.php` for the full request/response schema of each step.

### PDF Export

| Method | Route | Description |
|--------|-------|-------------|
| POST | `?route=export-pdf` | Generate and download resume PDF |

Accepts the compiled resume data as JSON. Returns a binary PDF file (`Content-Type: application/pdf`).

## Project Structure

```
resume/
├── index.html                          # Frontend SPA
├── config.php                          # App configuration
├── schema.sql                          # Database schema
├── template.tex                        # LaTeX resume template
├── resume.cls                          # LaTeX document class
├── .env.example                        # Environment variable template
├── api/
│   └── index.php                       # API bootstrap & router
├── src/
│   ├── Config.php                      # Config loader
│   ├── Database.php                    # PDO singleton
│   ├── Env.php                         # .env file parser
│   ├── Router.php                      # HTTP router
│   ├── Exceptions/
│   │   └── AiException.php            # AI service exception
│   ├── Models/
│   │   ├── PersonalInfo.php            # Personal info model
│   │   ├── Education.php               # Education model
│   │   ├── Experience.php              # Experience model
│   │   ├── Project.php                 # Project model
│   │   └── Testimonial.php            # Testimonial model
│   ├── Controllers/
│   │   ├── PersonalInfoController.php  # Personal info CRUD
│   │   ├── EducationController.php     # Education CRUD
│   │   ├── ExperienceController.php    # Experience CRUD
│   │   ├── ProjectController.php       # Project CRUD
│   │   ├── TestimonialController.php   # Testimonial CRUD
│   │   ├── SelectionController.php     # AI selection pipeline
│   │   └── PdfController.php          # PDF export endpoint
│   └── Services/
│       ├── AiServiceInterface.php      # AI provider contract
│       ├── AiServiceFactory.php        # Provider factory
│       ├── OllamaService.php           # Ollama client
│       ├── OpenAiService.php           # OpenAI client
│       ├── AnthropicService.php        # Anthropic client
│       ├── GeminiService.php           # Gemini client
│       ├── PromptBuilder.php           # Prompt templates
│       ├── LatexBuilder.php            # LaTeX document builder
│       └── PdfCompiler.php            # pdflatex runner
├── css/
│   └── style.css                       # Styling
└── js/
    ├── app.js                          # Frontend setup & utilities
    ├── personal.js                     # Personal info UI
    ├── education.js                    # Education UI
    ├── experience.js                   # Experience UI
    ├── projects.js                     # Projects UI
    ├── testimonials.js                 # Testimonials UI
    └── selection.js                    # Selection pipeline UI
```

## Architecture

- **Single-Page App (SPA)** -- Tab-based navigation with no page reloads
- **RESTful API** -- Each controller handles one resource via a simple query-string router
- **OOP Backend** -- Models handle data access, controllers handle HTTP, services handle external integrations
- **Factory Pattern** -- `AiServiceFactory` creates the active provider from `AiServiceInterface` implementations
- **LaTeX PDF Pipeline** -- `LatexBuilder` assembles a `.tex` document, `PdfCompiler` runs `pdflatex` and returns the binary
- **Wizard Workflow** -- 4-step progression with localStorage persistence, 500ms debounced auto-save, and pipeline failure recovery

## Troubleshooting

### "Cannot connect to database"
- Ensure MySQL is running in XAMPP
- Check `config.php` has correct credentials
- Verify `resume_tool` database exists (`schema.sql` imported?)

### "Ollama request failed"
- Ensure Ollama is running: `ollama serve`
- Check the model exists: `ollama list`
- Verify `ollama.base_url` in `config.php` matches Ollama's listening address

### "LLM did not return valid JSON"
- Some models produce inconsistent JSON output -- try a larger model like `llama3.1`
- Increase `timeout` in `config.php` if inference is slow on CPU

### "pdflatex not found"
- Install a LaTeX distribution (MiKTeX, TeX Live) and ensure `pdflatex` is on your system PATH
- Restart Apache after installing so the updated PATH is picked up

### API key errors
- Verify the key is set in `.env` (not `.env.example`)
- Check the key is valid and has not expired
- Ensure the provider's model name in `config.php` is a model your API key has access to

### Generation is slow
- Local Ollama inference can take 30-120 seconds depending on model size and hardware
- Use a smaller model (`mistral`, `neural-chat`) for faster results
- Cloud providers (OpenAI, Anthropic, Gemini) are typically faster than local inference

## License

MIT
