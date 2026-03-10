# Resume Builder

An AI-powered web tool that helps you create tailored resume descriptions and bullet points for job applications. Store your work experience and projects, then use a local LLM to generate descriptions optimized for specific job postings.

## Features

- **Work Experience Management** — Add, edit, and delete your job history with descriptions and skill tags
- **Projects Management** — Store personal, open-source, or side projects with details and skills
- **AI-Powered Generation** — Paste a target job description and automatically generate tailored bullet points and professional summary
- **No Cloud Dependency** — Uses a local Ollama instance for complete privacy
- **Clean SPA Interface** — Tab-based navigation with instant search and copy-to-clipboard functionality

## Tech Stack

- **Frontend** — Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend** — PHP 8+ (OOP, no frameworks)
- **Database** — MySQL 5.7+
- **LLM** — Ollama (local)
- **Server** — Apache (XAMPP)

## Prerequisites

1. **XAMPP** (PHP + Apache + MySQL)
   - Download from [apachefriends.org](https://www.apachefriends.org/)
   - Ensure Apache and MySQL are running

2. **Ollama**
   - Download from [ollama.com](https://ollama.com/)
   - Install and ensure it runs on `localhost:11434` (default)

3. **MySQL Connection Credentials**
   - Default: `root` / no password
   - Or configure your existing credentials in `config.php`

## Setup

### 1. Import Database Schema

Open phpMyAdmin (`http://localhost/phpmyadmin`) or use the MySQL CLI:

```bash
mysql -u root -p < schema.sql
```

This creates the `resume_tool` database with two tables: `experiences` and `projects`.

### 2. Configure the App

Edit `config.php` with your MySQL credentials and Ollama settings:

```php
return [
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'resume_tool',
        'user' => 'root',
        'pass' => '',  // Your MySQL password
        'charset' => 'utf8mb4',
    ],
    'ollama' => [
        'base_url' => 'http://localhost:11434',
        'model' => 'llama3',  // or 'mistral', 'neural-chat', etc.
        'timeout' => 120,     // seconds
    ],
];
```

### 3. Install Ollama & Pull a Model

```bash
ollama pull llama3
```

For faster inference on CPU, try smaller models:
```bash
ollama pull mistral
ollama pull neural-chat
```

Then update `config.php` to use the model name (e.g., `'model' => 'mistral'`).

### 4. Start Ollama

```bash
ollama serve
```

It will listen on `http://localhost:11434`.

### 5. Open the App

Navigate to:
```
http://localhost/resume/
```

## Usage

### Add Work Experience

1. Click the **Experience** tab
2. Click **+ Add Experience**
3. Fill in company, job title, dates, description, and skills
4. Click **Save**

### Add Projects

1. Click the **Projects** tab
2. Click **+ Add Project**
3. Fill in project name, description, URL (optional), and skills
4. Click **Save**

### Generate Resume Content

1. Click the **Generate** tab
2. Paste the job description you're applying for
3. Select the experiences and projects you want to highlight
4. Click **Generate**
5. Copy the tailored bullet points and professional summary for each item

## API Endpoints

All endpoints accept and return JSON. Base URL: `/api/index.php`

### Experiences

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=experiences` | List all experiences |
| GET | `?route=experiences&id=N` | Get one experience |
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
  "description": "Developed backend APIs...",
  "skills": ["Python", "FastAPI", "PostgreSQL"]
}
```

### Projects

| Method | Route | Description |
|--------|-------|-------------|
| GET | `?route=projects` | List all projects |
| GET | `?route=projects&id=N` | Get one project |
| POST | `?route=projects` | Create project |
| PUT | `?route=projects` | Update project |
| DELETE | `?route=projects` | Delete project |

**POST/PUT Body:**
```json
{
  "name": "Resume Builder",
  "description": "AI-powered tool...",
  "url": "https://github.com/user/resume-builder",
  "skills": ["PHP", "JavaScript", "MySQL"]
}
```

### Generate

| Method | Route | Description |
|--------|-------|-------------|
| POST | `?route=generate` | Generate tailored descriptions |

**POST Body:**
```json
{
  "job_description": "We are looking for a Senior Engineer with 5+ years of Python experience...",
  "experience_ids": [1, 3],
  "project_ids": [2]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": {
      "exp_1": [
        "Designed and deployed microservices reducing latency by 40%",
        "Led team of 3 engineers in agile environment"
      ],
      "proj_2": [
        "Built full-stack resume generator with AI integration",
        "Implemented responsive UI without dependencies"
      ]
    },
    "professional_summary": "Experienced full-stack engineer with 7+ years building scalable applications..."
  }
}
```

## Project Structure

```
resume/
├── index.html                  # Frontend SPA
├── config.php                  # Configuration (edit this!)
├── schema.sql                  # Database schema
├── api/
│   └── index.php               # API bootstrap & router
├── src/
│   ├── Config.php              # Config loader
│   ├── Database.php            # PDO singleton
│   ├── Router.php              # HTTP router
│   ├── Models/
│   │   ├── Experience.php      # Experience model
│   │   └── Project.php         # Project model
│   ├── Controllers/
│   │   ├── ExperienceController.php
│   │   ├── ProjectController.php
│   │   └── GenerateController.php
│   └── Services/
│       └── OllamaService.php   # Ollama client
├── css/
│   └── style.css               # Styling
└── js/
    ├── app.js                  # Frontend setup & utilities
    ├── experience.js           # Experience UI
    ├── projects.js             # Projects UI
    └── generate.js             # Generate UI
```

## Architecture

- **Single-Page App (SPA)** — Three tabs with no page reloads
- **RESTful API** — Each controller handles a resource (experiences, projects, generation)
- **OOP Backend** — Models handle data, controllers handle requests, services handle external calls
- **Modular Design** — Easy to swap out Ollama for OpenAI/Claude by creating a new service class

## Troubleshooting

### "Cannot connect to database"
- Ensure MySQL is running in XAMPP
- Check `config.php` has correct credentials
- Verify `resume_tool` database exists (`schema.sql` imported?)

### "Ollama request failed"
- Ensure Ollama is running: `ollama serve`
- Check the model exists: `ollama list`
- Verify base URL in `config.php` matches Ollama's listening address

### "LLM did not return valid JSON"
- Some models produce inconsistent JSON. Try: `ollama pull llama3.1`
- Increase timeout in `config.php` if inference is slow on CPU

### Generation is slow
- Local LLM inference takes 30-120 seconds depending on model and hardware
- Use a smaller model like `mistral` or `neural-chat`
- Consider GPU acceleration if available

## License

MIT
