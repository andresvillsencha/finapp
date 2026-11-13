# Sencha Ext JS Application

A web application built with **Sencha Ext JS 8 (Modern Toolkit)** and a **Node.js / Express** backend.

## Technologies

- **Frontend:** Sencha Ext JS 8.0 (Modern Toolkit)
- **Backend:** Node.js and Express
- **API:** RESTful services using JSON
- **UI Packages:** Font Awesome, Charts, and UX

## Project Structure

```text
project/
├── ext-js/            # Sencha Ext JS application
├── server/            # Node.js backend
├── db/                # Database scripts or JSON data
├── .gitignore
└── README.md
```

## Prerequisites

Before running the project, install:

- Node.js and npm
- Sencha Cmd
- Sencha Ext JS 8.0 SDK
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

### 2. Start the backend

Navigate to the backend folder:

```bash
cd server
npm install
npm start
```

Configure any required environment variables using a local `.env` file.

### 3. Start the frontend

Open another terminal:

```bash
cd ext-js
sencha app watch
```

Open the application in your browser using the local URL displayed by Sencha Cmd.

## REST API

The frontend communicates with the Node.js backend using REST endpoints.

A typical successful response is:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Example"
    }
  ],
  "total": 1
}
```

Ext JS stores should configure their readers to use the appropriate response properties.

## Development Guidelines

- Prefer built-in Ext JS classes, components, methods, and utilities over native JavaScript alternatives when available.
- Use the Ext JS Modern Toolkit.
- Follow the project's existing naming conventions and folder structure.
- Keep frontend and backend responsibilities separate.
- Never commit credentials, environment secrets, or generated dependencies.

## License

Proprietary software. All rights reserved.